const { default: SignJWT } = require('jose/jwt/sign');
const crypto = require('crypto');
const auth = require('./auth.json');
const { Point3D, AudioAPIData, Communicator } = require("hifi-spatial-audio"); // Used to interface with the High Fidelity Spatial Audio API.
const { RTCAudioSink } = require('wrtc').nonstandard;
const Lame = require("node-lame").Lame;
const wav = require('wav');

// This is your "App ID" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_ID = auth.HIFI_APP_ID;
// This is the "App Secret" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_SECRET = auth.HIFI_APP_SECRET;
const SECRET_KEY_FOR_SIGNING = crypto.createSecretKey(Buffer.from(APP_SECRET, "utf8"));

async function generateHiFiJWT(userID, spaceName, isAdmin) {
    let hiFiJWT;
    try {
        let jwtArgs = {
            "user_id": userID,
            "app_id": APP_ID
        };

        if (spaceName) {
            jwtArgs["space_name"] = spaceName;
        }

        if (isAdmin) {
            jwtArgs["admin"] = true;
        }

        hiFiJWT = await new SignJWT(jwtArgs)
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .sign(SECRET_KEY_FOR_SIGNING);

        return hiFiJWT;
    } catch (error) {
        console.error(`Couldn't create JWT! Error:${error}`);
        return;
    }
}

class ServerSpaceInfo {
    constructor({ spaceName, spatialMicrophone } = {}) {
        this.spaceName = spaceName;
        this.spatialMicrophone = spatialMicrophone;
        this.participants = [];
    }
}

class Participant {
    constructor({ visitIDHash } = {}) {
        this.visitIDHash = visitIDHash;
    }
}

class SpatialMicrophone {
    constructor({ spaceName, position } = {}) {
        this.spaceName = spaceName;
        // Define the initial HiFi Audio API Data used when connecting to the Spatial Audio API.
        this.audioAPIData = new AudioAPIData({
            position: new Point3D(position)
        });
        // Set up the HiFiCommunicator used to communicate with the Spatial Audio API.
        this.communicator = new Communicator({ initialHiFiAudioAPIData: this.audioAPIData });
        this.monoSamples = new Int16Array();
        this.startRecordTime = undefined;
    }

    async init() {
        // Generate the JWT used to connect to our High Fidelity Space.
        let hiFiJWT = await generateHiFiJWT("spatial-microphone", this.spaceName);
        if (!hiFiJWT) {
            console.error(`Couldn't get HiFi JWT! Spatial microphone will not function.`)
            return;
        }

        // Connect to our High Fidelity Space.
        try {
            let connectResponse = await this.communicator.connectToHiFiAudioAPIServer(hiFiJWT);
        } catch (e) {
            console.error(`Call to \`connectToHiFiAudioAPIServer()\` failed! Error:\n${JSON.stringify(e)}`);
            return;
        }
        this.outputAudioMediaStreamTrack = this.communicator.getOutputAudioMediaStream().getTracks()[0];
        console.log(`Spatial microphone is connected to Space named \`${this.spaceName}\` at ${JSON.stringify(this.audioAPIData.position)}!`);
    }

    deinit() {
        this.outputAudioMediaStreamTrack = null;
    }

    downmixStereoToMono(samples) {
        let outputInt16Array = new Int16Array(samples.length / 2);
        for (let i = 0; i < outputInt16Array.length; i++) {
            outputInt16Array[i] = samples[i * 2] / 2 + samples[i * 2 + 1] / 2;
        }

        return outputInt16Array;
    }

    startRecording() {
        console.log(`Starting to record from spatial microphone in \`${this.spaceName}\`...`);

        this.startRecordTime = Date.now();

        this.rtcAudioSink = new RTCAudioSink(this.outputAudioMediaStreamTrack);
        this.rtcAudioSink.ondata = (data) => {
            if (this.monoSamples.length === 0) {
                console.log(`\`rtcAudioSink\` received initial audio data!`);
            }

            let newMonoSamples = this.downmixStereoToMono(data.samples);
            let temp = new Int16Array(this.monoSamples.length + newMonoSamples.length);
            temp.set(this.monoSamples, 0);
            temp.set(newMonoSamples, this.monoSamples.length);
            this.monoSamples = temp;
        };
    }

    finishRecording(filetype) {
        console.log(`Stopping the recording from spatial microphone in \`${this.spaceName}\`...`);
        console.log(`Recording length: ${(Date.now() - this.startRecordTime) / 1000}s`);

        const finalBuffer = Buffer.from(this.monoSamples.buffer);

        if (!filetype || filetype === "wav") {
            const filename = `./output/${Date.now()}.wav`;
            const writer = new wav.FileWriter(filename, {
                sampleRate: 48000,
                channels: 1,
                bitDepth: 16,
            });
            writer.write(finalBuffer);
            writer.end();
        } else if (filetype === "mp3") {
            const filename = `./output/${Date.now()}.mp3`;
            this.encoder = new Lame({
                "output": filename,
                "raw": true,
                "bitwidth": 16,
                "sfreq": 48,
                "mode": "m",
                "signed": true,
                "unsigned": false,
                "little-endian": true,
                "big-endian": false,
                "no-replaygain": true,
                "bitrate": 128, // Output bitrate
            }).setBuffer(finalBuffer);
    
            this.encoder.encode()
                .then(() => {
                    console.log(`Successfully encoded \`${filename}\`!`);
                    this.monoSamples = null;
                })
                .catch((error) => {
                    console.error(`Couldn't encode samples from Spatial Microphone! Error:\n${error}`)
                    this.monoSamples = null;
                });
        }

        if (this.rtcAudioSink) {
            this.rtcAudioSink.stop();
            this.rtcAudioSink.ondata = null;
        }
        this.rtcAudioSink = null;
    }
}

const httpServer = require("http").createServer();

const io = require("socket.io")(httpServer, {
    path: '/spatial-microphone/socket.io',
    cors: {
        origin: `*`,
        methods: ["GET", "POST"]
    }
});

io.on("error", (e) => {
    console.error(e);
});

let spaceInformation = {};
io.on("connection", (socket) => {
    socket.on("userConnected", async ({ spaceName, visitIDHash, position } = {}) => {
        console.log(`In ${spaceName}, user connected:\nHashed Visit ID: \`${visitIDHash}\``);

        if (!spaceInformation[spaceName]) {
            console.log(`In \`${spaceName}\`, creating a new Spatial Microphone...`);
            let spatialMicrophone = new SpatialMicrophone({ spaceName, position: new Point3D({ x: 0, y: 0, z: 0 }) });
            await spatialMicrophone.init();
            spatialMicrophone.startRecording();
            spaceInformation[spaceName] = new ServerSpaceInfo({ spaceName, spatialMicrophone });
        }

        let me = new Participant({ visitIDHash });

        spaceInformation[spaceName].participants.push(me);

        socket.join(spaceName);

        socket.to(spaceName).emit("onParticipantAdded", [me]);
        socket.emit("onParticipantAdded", spaceInformation[spaceName].participants.filter((participant) => { return participant.visitIDHash !== visitIDHash; }));
    });

    socket.on("userDisconnected", ({ spaceName, visitIDHash } = {}) => {
        if (!spaceInformation[spaceName]) {
            return;
        }

        spaceInformation[spaceName].participants = spaceInformation[spaceName].participants.filter((participant) => { return participant.visitIDHash !== visitIDHash; });

        if (spaceInformation[spaceName].participants.length === 0) {
            console.log(`In \`${spaceName}\`, all users disconnected. Stopping the Spatial Microphone...`);
            spaceInformation[spaceName].spatialMicrophone.finishRecording("mp3");
            spaceInformation[spaceName].spatialMicrophone.deinit();
            if (spaceInformation[spaceName].spatialMicrophone.communicator) {
                spaceInformation[spaceName].spatialMicrophone.communicator.disconnectFromHiFiAudioAPIServer();
            }
            spaceInformation[spaceName].spatialMicrophone.communicator = null;
            delete spaceInformation[spaceName];
        }
    });
});

const PORT = 8125;
httpServer.listen(PORT, async () => {
    console.log(`Spatial Microphone is ready and listening at http://localhost:${PORT}`)
});

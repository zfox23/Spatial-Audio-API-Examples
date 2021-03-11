const { default: SignJWT } = require('jose/jwt/sign');
const express = require('express');
const crypto = require('crypto');
const auth = require('./auth.json');
const { ADJECTIVES, NOUNS } = require('./words');

// This is your "App ID" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_ID = auth.HIFI_APP_ID;
// This is the "App Secret" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_SECRET = auth.HIFI_APP_SECRET;
const SECRET_KEY_FOR_SIGNING = crypto.createSecretKey(Buffer.from(APP_SECRET, "utf8"));

const app = express();
const PORT = 8123;

app.set('view engine', 'ejs');
app.use(express.static('static'))

function uppercaseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

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

let providedUserIDAtSpaceNameToConnectionTimestampMap = new Map();
app.get('/spatial-speaker-space/speaker', async (req, res) => {
    let spaceName = req.query.spaceName || auth.HIFI_DEFAULT_SPACE_NAME;

    let providedUserID = `${uppercaseFirstLetter(ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)])} ${uppercaseFirstLetter(NOUNS[Math.floor(Math.random() * NOUNS.length)])}`;
    providedUserID += Math.floor(Math.random() * Math.floor(1000));

    let hiFiJWT = await generateHiFiJWT(providedUserID, spaceName, false);

    let timestamp = Date.now();
    providedUserIDAtSpaceNameToConnectionTimestampMap.set(`${providedUserID}@${spaceName}`, timestamp);

    console.log(`${timestamp}: Speaker \`${providedUserID}\` connected to the HiFi Space \`${spaceName}\`.`);

    res.render('index', { connectionTimestamp: Date.now(), providedUserID, hiFiJWT, spaceName, participantType: "speaker", endpointUrl: auth.HIFI_ENDPOINT_URL});
});

app.get('/spatial-speaker-space/audience', async (req, res) => {
    let spaceName = req.query.spaceName || auth.HIFI_DEFAULT_SPACE_NAME;

    let providedUserID = `${uppercaseFirstLetter(ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)])} ${uppercaseFirstLetter(NOUNS[Math.floor(Math.random() * NOUNS.length)])}`;
    providedUserID += Math.floor(Math.random() * Math.floor(1000));

    let hiFiJWT = await generateHiFiJWT(providedUserID, spaceName, false);

    let timestamp = Date.now();
    providedUserIDAtSpaceNameToConnectionTimestampMap.set(`${providedUserID}@${spaceName}`, timestamp);

    console.log(`${timestamp}: Audience member \`${providedUserID}\` connected to the HiFi Space \`${spaceName}\`.`);

    res.render('index', { connectionTimestamp: timestamp, providedUserID, hiFiJWT, spaceName, participantType: "audience", endpointUrl: auth.HIFI_ENDPOINT_URL});
});

app.get('/spatial-speaker-space/get-connection-age', (req, res) => {
    let providedUserID = req.query.providedUserID;
    let spaceName = req.query.spaceName;

    if (!providedUserID || !spaceName) {
        return res.status(500).send();
    }

    let timestamp = null;
    if (providedUserIDAtSpaceNameToConnectionTimestampMap.has(`${providedUserID}@${spaceName}`)) {
        timestamp = providedUserIDAtSpaceNameToConnectionTimestampMap.get(`${providedUserID}@${spaceName}`)
    }

    return res.json({
        "providedUserID": providedUserID,
        "spaceName": spaceName,
        "connectionTimestamp": timestamp
    });
});

const http = require("http").createServer(app);

const io = require("socket.io")(http, {
    path: '/spatial-speaker-space/socket.io',
    cors: {
        origin: `http://localhost:${PORT}`,
        methods: ["GET", "POST"]
    }
});

io.on("error", (e) => {
    console.error(e);
});

class ServerSpaceInfo {
    constructor({ spaceName } = {}) {
        this.spaceName = spaceName;
        this.participants = [];
    }
}

class Participant {
    constructor({ visitIDHash, displayName, colorHex, participantType, isRecording } = {}) {
        this.visitIDHash = visitIDHash;
        this.displayName = displayName;
        this.colorHex = colorHex;
        this.participantType = participantType;
        this.isRecording = isRecording;
    }
}

let spaceInformation = {};
io.on("connection", (socket) => {
    socket.on("addParticipant", ({ visitIDHash, displayName, colorHex, participantType, isRecording, spaceName } = {}) => {

        if (!spaceInformation[spaceName]) {
            spaceInformation[spaceName] = new ServerSpaceInfo({ spaceName });
        }

        if (spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === visitIDHash; })) {
            // Already had info about this participant.
            return;
        }

        console.log(`In ${spaceName}, adding participant:\nHashed Visit ID: \`${visitIDHash}\`\nDisplay Name: \`${displayName}\`\nColor: ${colorHex}\nparticipantType: ${participantType}\n`);

        let me = new Participant({ visitIDHash, displayName, colorHex, participantType, isRecording });

        spaceInformation[spaceName].participants.push(me);

        socket.join(spaceName);

        socket.to(spaceName).emit("onParticipantAdded", [me]);
        socket.emit("onParticipantAdded", spaceInformation[spaceName].participants.filter((participant) => { return participant.visitIDHash !== visitIDHash; }));
    });

    socket.on("editParticipant", ({ visitIDHash, displayName, colorHex, isRecording, spaceName } = {}) => {
        let participantToEdit = spaceInformation[spaceName].participants.find((participant) => {
            return participant.visitIDHash === visitIDHash;
        });

        if (participantToEdit) {
            if (typeof (displayName) === "string") {
                participantToEdit.displayName = displayName;
            }
            if (typeof (colorHex) === "string") {
                participantToEdit.colorHex = colorHex;
            }
            if (typeof (isRecording) === "boolean") {
                participantToEdit.isRecording = isRecording;
            }

            socket.to(spaceName).emit("onParticipantAdded", [participantToEdit]);
        }
    });

    socket.on("removeParticipant", ({ visitIDHash, spaceName } = {}) => {
        if (!spaceInformation[spaceName]) {
            return;
        }

        spaceInformation[spaceName].participants = spaceInformation[spaceName].participants.filter((participant) => { return participant.visitIDHash !== visitIDHash; })
    });

    socket.on("addParticle", ({ visitIDHash, spaceName, particleData } = {}) => {
        console.log(`In ${spaceName}, \`${visitIDHash}\` added a particle!.`);
        socket.to(spaceName).emit("requestParticleAdd", { visitIDHash, spaceName, particleData });
    });
});

http.listen(PORT, async () => {
    console.log(`Spatial Speaker Space is ready and listening at http://localhost:${PORT}\nSpeaker link: http://localhost:${PORT}/spatial-speaker-space/speaker\nAudience link: http://localhost:${PORT}/spatial-speaker-space/audience`)
});

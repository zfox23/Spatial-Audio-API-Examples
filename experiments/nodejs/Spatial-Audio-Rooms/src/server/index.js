const isInProdMode = process.argv.slice(2)[0] === "prod";
const isInHTTPSMode = process.argv.slice(2)[1] === "true";

console.warn(`*****\nServer production mode status: ${isInProdMode}\n*****\n`);

const fs = require('fs');
const webpack = require('webpack');
const path = require('path');
const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const auth = require('../../auth.json');

const app = express();
const PORT = 8180;

if (!isInProdMode) {
    const webpackHotMiddleware = require('webpack-hot-middleware');
    const webpackDevMiddleware = require('webpack-dev-middleware');
    const chokidar = require('chokidar');

    const WEBPACK_CONFIG = require('../../webpack.config.js')();
    const WEBPACK_COMPILER = webpack(WEBPACK_CONFIG);

    const devMiddleWare = webpackDevMiddleware(WEBPACK_COMPILER, { publicPath: WEBPACK_CONFIG.output.publicPath, });
    const hotMiddleware = webpackHotMiddleware(WEBPACK_COMPILER, {
        'log': console.log,
        'path': '/__webpack_hmr',
        'heartbeat': 2000,
        'reload': true
    });

    app.use(devMiddleWare);
    app.use(hotMiddleware);

    const watcher = chokidar.watch('./src/server');
    watcher.on('ready', () => {
        watcher.on('all', () => {
            console.log("Clearing server module cache...");
            hotMiddleware.publish({ action: 'reload' });
            Object.keys(require.cache).forEach((id) => {
                if (/[\/\\]server[\/\\]/.test(id)) {
                    delete require.cache[id];
                }
            });
        });
    });

    WEBPACK_COMPILER.hooks.compilation.tap('ClearClientModuleCachePlugin', (stats) => {
        console.log("Clearing client module cache...");
        hotMiddleware.publish({ action: 'reload' });
        Object.keys(require.cache).forEach((id) => {
            if (/[\/\\]client[\/\\]/.test(id)) {
                delete require.cache[id];
            }
        });
    });
}

const DIST_DIR = path.join(__dirname, "..", "..", "dist");
app.use('/spatial-audio-rooms', express.static(DIST_DIR));
app.use('/spatial-audio-rooms', express.static(path.join(__dirname, "static")));
app.use(require('body-parser').urlencoded({ extended: true }));

app.get('/spatial-audio-rooms', async (req, res, next) => {
    require('./serverRender')(isInProdMode, req, async (err, page) => {
        if (err) {
            return next(err);
        }
        res.send(page);
    });
});

app.get('/spatial-audio-rooms/slack', (req, res, next) => {
    let code = req.query.code;
    if (!code) {
        res.sendStatus(500);
        return;
    }

    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', auth.SLACK_CLIENT_ID);
    params.append('client_secret', auth.SLACK_CLIENT_SECRET);

    fetch("https://slack.com/api/oauth.v2.access", { method: 'POST', body: params })
        .then(res => res.json())
        .then(json => {
            console.log(json);
            if (json && json.ok) {
                let okString = `<p>The HiFi Helper bot has been successfully added to the Slack workspace named "${json.team.name}"! Try typing <code>/hifi</code> in any Slack channel.</p>`;
                console.log(okString);
                res.status(200).send(okString)
            } else {
                let errorString = `There was an error authorizing HiFi Helper with Slack. More information:\n${JSON.stringify(json)}`;
                console.error(errorString);
                res.status(500).send(errorString);
            }
        })
        .catch(e => {
            let errorString = `There was an error when contacting Slack. More information:\n${JSON.stringify(e)}`;
            console.error(errorString)
            res.send(errorString);
        });
});

app.get('/spatial-audio-rooms/:spaceName', async (req, res, next) => {
    require('./serverRender')(isInProdMode, req, async (err, page) => {
        if (err) {
            return next(err);
        }
        res.send(page);
    });
});

app.post('/spatial-audio-rooms/create', (req, res, next) => {
    let spaceURL;

    let slackCommandText = req.body.text;
    if (slackCommandText && slackCommandText.length > 0) {
        spaceURL = `https://experiments.highfidelity.com/spatial-audio-rooms/${slackCommandText}/?config=/spatial-audio-rooms/watchParty.json`;

        res.json({
            "response_type": 'in_channel',
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `<${spaceURL}|Click here to join the Spatial Audio Room named "${slackCommandText}".>`
                    }
                }
            ]
        });
    } else {
        let stringToHash;

        let slackChannelID = req.body.channel_id;
        if (slackChannelID) {
            stringToHash = slackChannelID;
        }

        if (!stringToHash) {
            console.error(`Couldn't generate Spatial Audio Room link. Request body:\n${JSON.stringify(req.body)}`);
            res.json({
                "response_type": "ephemeral",
                "text": "Sorry, I couldn't generate a Spatial Audio Room for you."
            });
            return;
        }

        let hash = crypto.createHash('md5').update(stringToHash).digest('hex');
        spaceURL = `https://experiments.highfidelity.com/spatial-audio-rooms/${hash}/?config=/spatial-audio-rooms/watchParty.json`;

        res.json({
            "response_type": 'in_channel',
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `<${spaceURL}|Click here to join the Spatial Audio Room associated with this Slack channel.>`
                    }
                }
            ]
        });
    }
});

let httpOrHttpsServer;
if (isInHTTPSMode) {
    const options = {
        "key": fs.readFileSync('C:/Users/Zach/AppData/Local/mkcert/localhost+2-key.pem'),
        "cert": fs.readFileSync('C:/Users/Zach/AppData/Local/mkcert/localhost+2.pem'),
        "ca": fs.readFileSync('C:/Users/Zach/AppData/Local/mkcert/rootCA.pem')
    };
    httpOrHttpsServer = require("https").createServer(options, app);
} else {
    httpOrHttpsServer = require("http").createServer(app);
}

const socketIOServer = require("socket.io")(httpOrHttpsServer, {
    path: '/spatial-audio-rooms/socket.io',
    cors: {
        origins: [`https://localhost:${PORT}`, `http://localhost:${PORT}`, `https://192.168.1.23:${PORT}`, `http://192.168.1.23:${PORT}`],
        methods: ["GET", "POST"]
    }
});

socketIOServer.on("error", (e) => {
    console.error(e);
});

class ServerSpaceInfo {
    constructor({ spaceName } = {}) {
        this.spaceName = spaceName;
        this.participants = [];
    }
}

class Participant {
    constructor({ socketID, spaceName, visitIDHash, currentSeatID, displayName, colorHex, echoCancellationEnabled, agcEnabled, noiseSuppressionEnabled, hiFiGainSliderValue, volumeThreshold, currentWatchPartyRoomName, } = {}) {
        this.socketID = socketID;
        this.spaceName = spaceName;
        this.visitIDHash = visitIDHash;
        this.currentSeatID = currentSeatID;
        this.displayName = displayName;
        this.colorHex = colorHex;
        this.echoCancellationEnabled = echoCancellationEnabled;
        this.agcEnabled = agcEnabled;
        this.noiseSuppressionEnabled = noiseSuppressionEnabled;
        this.hiFiGainSliderValue = hiFiGainSliderValue;
        this.volumeThreshold = volumeThreshold;
        this.currentWatchPartyRoomName = currentWatchPartyRoomName;
    }
}

function onWatchNewVideo(newVideoURL, spaceName, roomName) {
    if (!spaceInformation[spaceName]["rooms"][roomName]) {
        console.error(`In \`onWatchNewVideo()\`, no \`spaceInformation["${spaceName}"]["rooms"]["${roomName}"]\`!`);
        return;
    }

    let url = new URL(newVideoURL);

    let youTubeVideoID;
    if (url.hostname === "youtu.be") {
        youTubeVideoID = url.pathname.substr(1);
    } else if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
        const params = new URLSearchParams(url.search);
        youTubeVideoID = params.get("v");
    }

    if (youTubeVideoID) {
        spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL = newVideoURL;
        let startTimestamp = (Date.now() - spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp) / 1000 + spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime;
        console.log(`Emitting \`watchNewYouTubeVideo\` with Video ID \`${youTubeVideoID}\` to all users in ${spaceName}/${roomName}, starting at ${startTimestamp}s with state ${spaceInformation[spaceName]["rooms"][roomName].currentPlayerState}...`);

        socketIOServer.sockets.in(spaceName).emit("watchNewYouTubeVideo", roomName, youTubeVideoID, startTimestamp, spaceInformation[spaceName]["rooms"][roomName].currentPlayerState);
    }
}

function onWatchPartyUserLeft(visitIDHash) {
    console.log(`Removing watcher with ID \`${visitIDHash}\`.`);

    let spaceInformationKeys = Object.keys(spaceInformation);
    for (let i = 0; i < spaceInformationKeys.length; i++) {
        let spaceName = spaceInformationKeys[i];
        if (!spaceInformation[spaceName]["rooms"]) {
            break;
        }
        let roomNameKeys = Object.keys(spaceInformation[spaceName]["rooms"]);
        for (let j = 0; j < roomNameKeys.length; j++) {
            let roomName = roomNameKeys[j];
            if (spaceInformation[spaceName]["rooms"][roomName] && spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes) {
                spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes.delete(visitIDHash);

                if (spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes.size === 0) {
                    spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL = undefined;
                    spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = undefined;
                    spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = undefined;
                    spaceInformation[spaceName]["rooms"][roomName].currentPlayerState = 1;
                }

                console.log(`There are now ${spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes.size} watchers present in ${spaceName}/${roomName}`);
            }
        }
    }
}

let spaceInformation = {};
socketIOServer.on("connection", (socket) => {
    socket.on("addParticipant", ({ spaceName, visitIDHash, currentSeatID, displayName, colorHex, echoCancellationEnabled, agcEnabled, noiseSuppressionEnabled, hiFiGainSliderValue, volumeThreshold, currentWatchPartyRoomName, } = {}) => {
        if (!spaceInformation[spaceName]) {
            spaceInformation[spaceName] = new ServerSpaceInfo({ spaceName });
        }

        if (spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === visitIDHash; })) {
            // Already had info about this participant.
            return;
        }

        console.log(`${Date.now()}: In ${spaceName}, adding participant:\nHashed Visit ID: \`${visitIDHash}\`\nDisplay Name: \`${displayName}\`\nColor: ${colorHex}\n`);

        let me = new Participant({
            socketID: socket.id,
            spaceName,
            visitIDHash,
            currentSeatID,
            displayName,
            colorHex,
            echoCancellationEnabled,
            agcEnabled,
            noiseSuppressionEnabled,
            hiFiGainSliderValue,
            volumeThreshold,
            currentWatchPartyRoomName,
        });

        spaceInformation[spaceName].participants.push(me);

        socket.join(spaceName);

        socket.to(spaceName).emit("onParticipantsAddedOrEdited", [me]);
        socket.emit("onParticipantsAddedOrEdited", spaceInformation[spaceName].participants.filter((participant) => { return participant.visitIDHash !== visitIDHash; }));
    });

    socket.on("editParticipant", ({ spaceName, visitIDHash, currentSeatID, displayName, colorHex, echoCancellationEnabled, agcEnabled, noiseSuppressionEnabled, hiFiGainSliderValue, volumeThreshold, currentWatchPartyRoomName, } = {}) => {
        let participantToEdit = spaceInformation[spaceName].participants.find((participant) => {
            return participant.visitIDHash === visitIDHash;
        });

        if (participantToEdit) {
            if (typeof (displayName) === "string") {
                participantToEdit.displayName = displayName;
            }
            if (typeof (currentSeatID) === "string") {
                participantToEdit.currentSeatID = currentSeatID;
            }
            if (typeof (colorHex) === "string") {
                participantToEdit.colorHex = colorHex;
            }
            if (typeof (echoCancellationEnabled) === "boolean") {
                participantToEdit.echoCancellationEnabled = echoCancellationEnabled;
            }
            if (typeof (agcEnabled) === "boolean") {
                participantToEdit.agcEnabled = agcEnabled;
            }
            if (typeof (noiseSuppressionEnabled) === "boolean") {
                participantToEdit.noiseSuppressionEnabled = noiseSuppressionEnabled;
            }
            if (typeof (hiFiGainSliderValue) === "string") {
                participantToEdit.hiFiGainSliderValue = hiFiGainSliderValue;
            }
            if (typeof (volumeThreshold) === "number") {
                participantToEdit.volumeThreshold = volumeThreshold;
            }
            if (typeof (currentWatchPartyRoomName) === "string") {
                participantToEdit.currentWatchPartyRoomName = currentWatchPartyRoomName;
            }
            socket.to(spaceName).emit("onParticipantsAddedOrEdited", [participantToEdit]);
        } else {
            console.error(`editParticipant: Couldn't get participant with visitIDHash: \`${visitIDHash}\`!`);
        }
    });

    socket.on("disconnect", () => {
        let allSpaces = Object.keys(spaceInformation);

        for (let i = 0; i < allSpaces.length; i++) {
            let currentSpace = spaceInformation[allSpaces[i]];
            let participantToRemove = currentSpace.participants.find((participant) => { return participant.socketID === socket.id; });
            if (participantToRemove) {
                onWatchPartyUserLeft(participantToRemove.visitIDHash);
                console.log(`${Date.now()}: In ${allSpaces[i]}, removing participant with Hashed Visit ID: \`${participantToRemove.visitIDHash}\`!`);
                currentSpace.participants = currentSpace.participants.filter((participant) => { return participant.socketID !== socket.id; });
            }
        }
    });

    socket.on("requestToEnableEchoCancellation", ({ spaceName, toVisitIDHash, fromVisitIDHash } = {}) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToEnableEchoCancellation: Couldn't get participant from \`spaceInformation[${spaceName}].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToEnableEchoCancellation: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToEnableEchoCancellation", { fromVisitIDHash });
    });

    socket.on("requestToDisableEchoCancellation", ({ spaceName, toVisitIDHash, fromVisitIDHash } = {}) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToDisableEchoCancellation: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToDisableEchoCancellation: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToDisableEchoCancellation", { fromVisitIDHash });
    });

    socket.on("requestToEnableAGC", ({ spaceName, toVisitIDHash, fromVisitIDHash } = {}) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToEnableAGC: Couldn't get participant from \`spaceInformation[${spaceName}].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToEnableAGC: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToEnableAGC", { fromVisitIDHash });
    });

    socket.on("requestToDisableAGC", ({ spaceName, toVisitIDHash, fromVisitIDHash } = {}) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToDisableAGC: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToDisableAGC: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToDisableAGC", { fromVisitIDHash });
    });

    socket.on("requestToEnableNoiseSuppression", ({ spaceName, toVisitIDHash, fromVisitIDHash } = {}) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToEnableNoiseSuppression: Couldn't get participant from \`spaceInformation[${spaceName}].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToEnableNoiseSuppression: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToEnableNoiseSuppression", { fromVisitIDHash });
    });

    socket.on("requestToDisableNoiseSuppression", ({ spaceName, toVisitIDHash, fromVisitIDHash } = {}) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToDisableNoiseSuppression: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToDisableNoiseSuppression: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToDisableNoiseSuppression", { fromVisitIDHash });
    });

    socket.on("requestToChangeHiFiGainSliderValue", ({ spaceName, toVisitIDHash, fromVisitIDHash, newHiFiGainSliderValue } = {}) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToChangeHiFiGainSliderValue: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToChangeHiFiGainSliderValue: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToChangeHiFiGainSliderValue", { fromVisitIDHash, newHiFiGainSliderValue });
    });

    socket.on("requestToChangeVolumeThreshold", ({ spaceName, toVisitIDHash, fromVisitIDHash, newVolumeThreshold } = {}) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToChangeVolumeThreshold: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToChangeVolumeThreshold: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToChangeVolumeThreshold", { fromVisitIDHash, newVolumeThreshold });
    });

    socket.on("requestToMuteAudioInputDevice", ({ spaceName, toVisitIDHash, fromVisitIDHash } = {}) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToMuteAudioInputDevice: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToMuteAudioInputDevice: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToMuteAudioInputDevice", { fromVisitIDHash });
    });

    socket.on("addParticle", ({ visitIDHash, spaceName, particleData } = {}) => {
        socket.to(spaceName).emit("requestParticleAdd", { visitIDHash, particleData });
    });

    socket.on("addSound", ({ visitIDHash, spaceName, soundParams } = {}) => {
        socket.to(spaceName).emit("requestSoundAdd", { visitIDHash, soundParams });
    });

    socket.on("watchPartyUserJoined", (visitIDHash, spaceName, roomName) => {
        console.log(`In ${spaceName}/${roomName}, adding watcher with ID \`${visitIDHash}\`.`);

        if (!spaceInformation[spaceName]["rooms"]) {
            spaceInformation[spaceName]["rooms"] = {};
        }

        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            spaceInformation[spaceName]["rooms"][roomName] = {
                currentQueuedVideoURL: undefined,
                currentVideoSeekTime: undefined,
                currentVideoSeekTimeSetTimestamp: undefined,
                currentPlayerState: 1,
                watcherVisitIDHashes: new Set(),
            };
        }

        spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes.add(visitIDHash);

        if (spaceInformation[spaceName] && spaceInformation[spaceName]["rooms"][roomName] && spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL) {
            onWatchNewVideo(spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL, spaceName, roomName);
        }
    });

    socket.on("watchPartyUserLeft", (visitIDHash) => {
        onWatchPartyUserLeft(visitIDHash);
    });

    socket.on("enqueueNewVideo", (visitIDHash, newVideoURL, spaceName, roomName) => {
        if (!spaceInformation[spaceName]) {
            return;
        }

        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            return;
        }

        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = 0;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = Date.now();

        console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` requested that a new video be played with URL \`${newVideoURL}\`.`);

        onWatchNewVideo(newVideoURL, spaceName, roomName);
    });

    socket.on("requestVideoSeek", (visitIDHash, seekTimeSeconds, spaceName, roomName) => {
        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            return;
        }

        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = seekTimeSeconds;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = Date.now();

        console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` requested that the video be seeked to ${spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime}s.`);

        socketIOServer.sockets.in(spaceName).emit("videoSeek", roomName, visitIDHash, spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime);
    });

    socket.on("setSeekTime", (visitIDHash, seekTimeSeconds, spaceName, roomName) => {
        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            return;
        }

        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = seekTimeSeconds;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = Date.now();
    });

    socket.on("newPlayerState", (visitIDHash, newPlayerState, seekTimeSeconds, spaceName, roomName) => {
        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            return;
        }

        if (!(newPlayerState === 1 || newPlayerState === 2) || spaceInformation[spaceName]["rooms"][roomName].currentPlayerState === newPlayerState) {
            return;
        }

        if (newPlayerState === 2) { // YT.PlayerState.PAUSED
            console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` requested that the video be paused at ${seekTimeSeconds}s.`);
            socket.broadcast.to(spaceName).emit("videoPause", roomName, visitIDHash, seekTimeSeconds);
        } else if (newPlayerState === 1) { // YT.PlayerState.PLAYING
            console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` requested that the video be played starting at ${seekTimeSeconds}s.`);
            socket.broadcast.to(spaceName).emit("videoPlay", roomName, visitIDHash, seekTimeSeconds);
        }

        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = seekTimeSeconds;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = Date.now();
        spaceInformation[spaceName]["rooms"][roomName].currentPlayerState = newPlayerState;
    });

    socket.on("youTubeVideoEnded", (visitIDHash, spaceName, roomName) => {
        if (!(spaceInformation[spaceName] && spaceInformation[spaceName]["rooms"][roomName])) {
            return;
        }

        spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL = undefined;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = undefined;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = undefined;
        spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL = undefined;
        console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` reported that the video ended.`);
        socketIOServer.sockets.in(spaceName).emit("videoClear", roomName, visitIDHash);
    });
});

httpOrHttpsServer.listen(PORT, (err) => {
    if (err) {
        throw err;
    }
    console.log(`${Date.now()}: Spatial Audio Rooms is ready. Go to this URL in your browser: ${isInHTTPSMode ? "https" : "http"}://localhost:${PORT}/spatial-audio-rooms`);
});

const isInProdMode = process.argv.slice(2)[0] === "prod";

console.warn(`*****\nServer production mode status: ${isInProdMode}\n*****\n`);

const webpack = require('webpack');
const path = require('path');
const express = require('express');

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

app.get('/spatial-audio-rooms', async (req, res, next) => {
    require('./serverRender')(isInProdMode, req, async (err, page) => {
        if (err) {
            return next(err);
        }
        res.send(page);
    });
});

const http = require("http").createServer(app);

const socketIOServer = require("socket.io")(http, {
    path: '/spatial-audio-rooms/socket.io',
    cors: {
        origin: `http://localhost:${PORT}`,
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

const HEARTBEAT_TIMEOUT_MS = 10000;
class Participant {
    constructor({ socketID, spaceName, visitIDHash, displayName, colorHex, echoCancellationEnabled, agcEnabled, hiFiGainSliderValue, volumeThreshold, } = {}) {
        this.socketID = socketID;
        this.spaceName = spaceName;
        this.visitIDHash = visitIDHash;
        this.displayName = displayName;
        this.colorHex = colorHex;
        this.echoCancellationEnabled = echoCancellationEnabled;
        this.agcEnabled = agcEnabled;
        this.hiFiGainSliderValue = hiFiGainSliderValue;
        this.volumeThreshold = volumeThreshold;

        this.heartbeatTimeout = undefined;
        this.restartHeartbeatTimeout();
    }

    restartHeartbeatTimeout() {
        return;

        // Using a heartbeat to the WebSocket server might not be the best way to
        // handle users disconnecting un-cleanly (i.e. without sending "participantDisconnected" to the WSS),
        // but I don't know the best way to do this yet.
        // Also, as of 2021-04-02, this doesn't even work yet.
        let spaceName = JSON.stringify(this.spaceName);
        let visitIDHash = JSON.stringify(this.visitIDHash);

        console.log(`${Date.now()}: Restarting heartbeat timeout for \`${visitIDHash}\` in \`${spaceName}\`...`);
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
        }

        this.heartbeatTimeout = setTimeout(removeParticipant, HEARTBEAT_TIMEOUT_MS, { spaceName, visitIDHash, removalReason: "Heartbeat Timeout" });
    }
}

function removeParticipant({ spaceName, visitIDHash, removalReason }) {
    if (!spaceInformation[spaceName]) {
        return;
    }
    
    console.log(`${Date.now()}: In ${spaceName}, removing participant with Hashed Visit ID: \`${visitIDHash}\` for reason: \`${removalReason}\``);

    spaceInformation[spaceName].participants = spaceInformation[spaceName].participants.filter((participant) => { return participant.visitIDHash !== visitIDHash; });
}

let spaceInformation = {};
socketIOServer.on("connection", (socket) => {
    socket.on("heartbeat", ({ spaceName, visitIDHash } = {}) => {
        if (!spaceInformation[spaceName]) {
            console.log(`${Date.now()}: During \`heartbeat\` handler, couldn't get spaceInformation["${spaceName}"]!`);
            return;
        }

        let participant = spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === visitIDHash; });

        if (!participant) {
            console.log(`${Date.now()}: During \`heartbeat\` handler, couldn't get participant!`);
            return;
        }

        participant.restartHeartbeatTimeout();
    });

    socket.on("addParticipant", ({ spaceName, visitIDHash, displayName, colorHex, echoCancellationEnabled, agcEnabled, hiFiGainSliderValue, volumeThreshold, } = {}) => {
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
            displayName,
            colorHex,
            echoCancellationEnabled,
            agcEnabled,
            hiFiGainSliderValue,
            volumeThreshold,
        });

        spaceInformation[spaceName].participants.push(me);

        socket.join(spaceName);

        socket.to(spaceName).emit("onParticipantAdded", [me]);
        socket.emit("onParticipantAdded", spaceInformation[spaceName].participants.filter((participant) => { return participant.visitIDHash !== visitIDHash; }));
    });

    socket.on("editParticipant", ({ spaceName, visitIDHash, displayName, colorHex, echoCancellationEnabled, agcEnabled, hiFiGainSliderValue, volumeThreshold, } = {}) => {
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
            if (typeof (echoCancellationEnabled) === "boolean") {
                participantToEdit.echoCancellationEnabled = echoCancellationEnabled;
            }
            if (typeof (agcEnabled) === "boolean") {
                participantToEdit.agcEnabled = agcEnabled;
            }
            if (typeof (hiFiGainSliderValue) === "string") {
                participantToEdit.hiFiGainSliderValue = hiFiGainSliderValue;
            }
            if (typeof (volumeThreshold) === "number") {
                participantToEdit.volumeThreshold = volumeThreshold;
            }
            socket.to(spaceName).emit("onParticipantAdded", [participantToEdit]);
        } else {
            console.error(`editParticipant: Couldn't get participant with visitIDHash: \`${visitIDHash}\`!`);
        }
    });

    socket.on("removeParticipant", ({ spaceName, visitIDHash, } = {}) => {
        removeParticipant({ spaceName, visitIDHash, removalReason: "Disconnected" });
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
});

http.listen(PORT, (err) => {
    if (err) {
        throw err;
    }
    console.log(`${Date.now()}: Spatial Audio Rooms is ready. Go to this URL in your browser: http://localhost:${PORT}/spatial-audio-rooms`);
});
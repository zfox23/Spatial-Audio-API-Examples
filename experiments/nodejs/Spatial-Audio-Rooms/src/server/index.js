const webpack = require('webpack');
const express = require('express');
const chokidar = require('chokidar');

const webpackHotMiddleware = require('webpack-hot-middleware');
const webpackDevMiddleware = require('webpack-dev-middleware');

const WEBPACK_CONFIG = require('../../webpack.config');
const WEBPACK_COMPILER = webpack(WEBPACK_CONFIG);

const devMiddleWare = webpackDevMiddleware(WEBPACK_COMPILER, { publicPath: WEBPACK_CONFIG.output.publicPath, });
const hotMiddleware = webpackHotMiddleware(WEBPACK_COMPILER, {
    'log': console.log,
    'path': '/__webpack_hmr',
    'heartbeat': 2000,
    'reload': true
});

const app = express();
const PORT = 8180;

app.use(express.static('./src/server/static'));
app.use(devMiddleWare);
app.use(hotMiddleware);

app.use(async (req, res, next) => {
    require('./routes')(req, res, next);
});

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

app.get('/spatial-audio-rooms', async (req, res, next) => {
    require('./serverRender')(req, async (err, page) => {
        if (err) {
            return next(err);
        }
        res.send(page);
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

class Participant {
    constructor({ visitIDHash, displayName, colorHex } = {}) {
        this.visitIDHash = visitIDHash;
        this.displayName = displayName;
        this.colorHex = colorHex;
    }
}

let spaceInformation = {};
socketIOServer.on("connection", (socket) => {
    socket.on("addParticipant", ({ visitIDHash, displayName, colorHex, spaceName } = {}) => {

        if (!spaceInformation[spaceName]) {
            spaceInformation[spaceName] = new ServerSpaceInfo({ spaceName });
        }

        if (spaceInformation[spaceName].participants.find((participant) => { return participant.visitIDHash === visitIDHash; })) {
            // Already had info about this participant.
            return;
        }

        console.log(`In ${spaceName}, adding participant:\nHashed Visit ID: \`${visitIDHash}\`\nDisplay Name: \`${displayName}\`\nColor: ${colorHex}\n`);

        let me = new Participant({ visitIDHash, displayName, colorHex });

        spaceInformation[spaceName].participants.push(me);

        socket.join(spaceName);

        socket.to(spaceName).emit("onParticipantAdded", [me]);
        socket.emit("onParticipantAdded", spaceInformation[spaceName].participants.filter((participant) => { return participant.visitIDHash !== visitIDHash; }));
    });

    socket.on("editParticipant", ({ visitIDHash, displayName, colorHex, spaceName } = {}) => {
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

http.listen(PORT, (err) => {
    if (err) {
        throw err;
    }
    console.log(`Spatial Audio Rooms is ready. Go to this URL in your browser: http://localhost:${PORT}/spatial-audio-rooms`);
});
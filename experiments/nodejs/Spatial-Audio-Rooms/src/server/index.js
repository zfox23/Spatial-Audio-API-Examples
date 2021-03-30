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
http.listen(PORT, (err) => {
    if (err) {
        throw err;
    }
    console.log(`Spatial Audio Rooms is ready. Go to this URL in your browser: http://localhost:${PORT}/spatial-audio-rooms`);
});
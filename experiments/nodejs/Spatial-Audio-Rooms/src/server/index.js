const webpack = require('webpack');
const webpackConfig = require('../../webpack.config');
const compiler = webpack(webpackConfig);
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const fs = require('fs');
const auth = require('../../auth.json');
const { default: SignJWT } = require('jose/jwt/sign');
const { ADJECTIVES, NOUNS } = require('./words');

// This is your "App ID" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_ID = auth.HIFI_APP_ID;
// This is the "App Secret" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_SECRET = auth.HIFI_APP_SECRET;
const SECRET_KEY_FOR_SIGNING = crypto.createSecretKey(Buffer.from(APP_SECRET, "utf8"));

const app = express();
const PORT = 8180;

const DIST_DIR = path.join(__dirname, '..', '..', 'dist');

app.use(express.static(DIST_DIR));

app.use(require("webpack-dev-middleware")(compiler, {
    publicPath: webpackConfig.output.publicPath
}));
app.use(require("webpack-hot-middleware")(compiler));

function uppercaseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function generateHiFiJWT(userID, spaceName, isAdmin = false) {
    let hiFiJWT;
    try {
        let jwtArgs = {
            "user_id": userID,
            "app_id": APP_ID,
            "space_name": spaceName,
            "admin": isAdmin
        };

        hiFiJWT = await new SignJWT(jwtArgs)
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .sign(SECRET_KEY_FOR_SIGNING);

        return hiFiJWT;
    } catch (error) {
        console.error(`Couldn't create JWT! Error:${error}`);
        return;
    }
}

const template = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
app.get('/spatial-audio-rooms', async (req, res) => {
    let spaceName = req.query.spaceName || auth.HIFI_DEFAULT_SPACE_NAME;

    let providedUserID = `${uppercaseFirstLetter(ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)])} ${uppercaseFirstLetter(NOUNS[Math.floor(Math.random() * NOUNS.length)])}`;
    providedUserID += Math.floor(Math.random() * Math.floor(1000));

    let hiFiJWT = await generateHiFiJWT(providedUserID, spaceName, false);

    console.log(`${Date.now()}: Speaker \`${providedUserID}\` connected to the HiFi Space \`${spaceName}\`.`);

    const page = template
        .replace('$HIFI_PROVIDED_USER_ID', providedUserID)
        .replace('$HIFI_JWT', hiFiJWT)
        .replace('$HIFI_SPACE_NAME', spaceName)
        .replace('$HIFI_ENDPOINT_URL', auth.HIFI_ENDPOINT_URL)

    res.send(page);
});

const http = require("http").createServer(app);

http.listen(PORT, () => {
    console.log(`Spatial Audio Rooms is ready. Go to this URL in your browser: http://localhost:${PORT}/spatial-audio-rooms`);
});
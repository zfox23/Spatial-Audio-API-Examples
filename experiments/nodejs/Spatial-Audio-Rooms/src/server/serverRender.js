const auth = require('../../auth.json');
const { ADJECTIVES, NOUNS } = require('./words');
const { uppercaseFirstLetter, generateHiFiJWT } = require('./utilities');

const template = `<!doctype html>
<html lang="en">

<head>
    <title>Spatial Audio Rooms - High Fidelity Spatial Audio API Demo</title>
    <script>
        const HIFI_PROVIDED_USER_ID = "$HIFI_PROVIDED_USER_ID";
        const HIFI_JWT = "$HIFI_JWT";
        const HIFI_SPACE_NAME = "$HIFI_SPACE_NAME";
        const HIFI_ENDPOINT_URL = "$HIFI_ENDPOINT_URL";
    </script>
</head>

<body>
    <script src="/index.js"></script>
</body>

</html>`;

async function renderApp(req, callback) {
    let spaceName = req.query.spaceName || auth.HIFI_DEFAULT_SPACE_NAME;

    let providedUserID = `${uppercaseFirstLetter(ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)])} ${uppercaseFirstLetter(NOUNS[Math.floor(Math.random() * NOUNS.length)])}`;
    providedUserID += Math.floor(Math.random() * Math.floor(1000));

    let hiFiJWT = await generateHiFiJWT(providedUserID, spaceName, false);

    console.log(`${Date.now()}: Speaker \`${providedUserID}\` connected to the HiFi Space \`${spaceName}\`.`);

    const page = template
        .replace('$HIFI_PROVIDED_USER_ID', providedUserID)
        .replace('$HIFI_JWT', hiFiJWT)
        .replace('$HIFI_SPACE_NAME', spaceName)
        .replace('$HIFI_ENDPOINT_URL', auth.HIFI_ENDPOINT_URL);

    callback(null, page);
}

module.exports = renderApp;
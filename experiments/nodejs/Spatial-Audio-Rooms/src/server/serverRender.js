const auth = require('../../auth.json');
const { ADJECTIVES, NOUNS } = require('./words');
const { uppercaseFirstLetter, generateHiFiJWT, generateTwilioAccessToken } = require('./utilities');

async function renderApp(isInProdMode, req, callback) {
    let spaceName = req.query.spaceName || auth.HIFI_DEFAULT_SPACE_NAME;

    let providedUserID = `${uppercaseFirstLetter(ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)])}${uppercaseFirstLetter(NOUNS[Math.floor(Math.random() * NOUNS.length)])}`;
    providedUserID += Math.floor(Math.random() * Math.floor(1000));

    let hiFiJWT = await generateHiFiJWT(providedUserID, spaceName, false);
    let twilioJWT = generateTwilioAccessToken(providedUserID, spaceName);

    console.log(`${Date.now()}: Speaker \`${providedUserID}\` connected to the HiFi Space \`${spaceName}\`.`);

    const page = `<!doctype html>
<html lang="en">

<head>
    <title>Spatial Audio Rooms - High Fidelity Spatial Audio API Demo</title>
    <meta name='viewport' content='minimal-ui, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' />
    <meta name="theme-color" content="#333333">
    <meta name="msapplication-navbutton-color" content="#333333">
    <script>
        const HIFI_PROVIDED_USER_ID = "${providedUserID}";
        const HIFI_JWT = "${hiFiJWT}";
        const HIFI_SPACE_NAME = "${spaceName}";
        const HIFI_ENDPOINT_URL = "${auth.HIFI_ENDPOINT_URL}";
        const TWILIO_JWT = "${twilioJWT}";
    </script>
    ${isInProdMode ? '<link rel="stylesheet" href="index.css">' : ''}
</head>

<body>
    <div class="loadingScreen">
        <div class="loadingScreen--icon"></div>
        <div class="loadingScreen--text">L O A D I N G</div>
    </div>
    <script src="index.js"></script>
</body>

</html>`;

    callback(null, page);
}

module.exports = renderApp;
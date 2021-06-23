const auth = require('../../../auth.json');
import { ADJECTIVES, NOUNS } from './words';
import { uppercaseFirstLetter, generateHiFiJWT, generateTwilioAccessToken } from './utilities';

export async function renderApp(isInProdMode: boolean, appConfigURL: string, spaceName: string, req: any, callback: any) {
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
        const APP_MODE = "web";
        const APP_CONFIG_URL = "${appConfigURL}";
    </script>
    ${isInProdMode ? '<link rel="stylesheet" href="/spatial-audio-rooms/index.css">' : ''}
</head>

<body>
    <div class="loadingScreen">
        <div class="loadingScreen--icon"></div>
        <div class="loadingScreen--text">L O A D I N G</div>
    </div>
    <script src="/spatial-audio-rooms/index.js"></script>
</body>

</html>`;

    callback(null, page);
}

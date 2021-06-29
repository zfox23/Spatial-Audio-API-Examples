const auth = require('../../auth.json');
const fs = require('fs');
const path = require('path');
const { generateHiFiJWT, generateTwilioAccessToken } = require('../server/utilities');

async function generateElectronApp() {
    let spaceName = auth.HIFI_DEFAULT_SPACE_NAME;
    
    let providedUserID = `SpatialStandupUser`;
    
    let hiFiJWT = await generateHiFiJWT(providedUserID, spaceName, false);
    let twilioJWT = generateTwilioAccessToken(providedUserID, spaceName);
    
    const htmlDocument = `<!doctype html>
    <html lang="en">
    
    <head>
        <title>Spatial Standup</title>
        <script>
            const HIFI_PROVIDED_USER_ID = "${providedUserID}";
            const HIFI_JWT = "${hiFiJWT}";
            const HIFI_SPACE_NAME = "${spaceName}";
            const HIFI_ENDPOINT_URL = "${auth.HIFI_ENDPOINT_URL}";
            const TWILIO_JWT = "${twilioJWT}";
            const APP_MODE = "electron";
        </script>
        <link rel="stylesheet" href="index.css">
    </head>
    
    <body>
        <div class="loadingScreen">
            <div class="loadingScreen--icon"></div>
            <div class="loadingScreen--text">L O A D I N G</div>
        </div>
        <script src="index.js"></script>
    </body>
    
    </html>`;
    const htmlDocumentOutputPath = path.join(__dirname, "..", "..", "dist", "electron.html");
    fs.writeFile(htmlDocumentOutputPath, htmlDocument, (err) => {
        if (err) {
            return console.error(err);
        }
        console.log(`\`electron.html\` written to \`${htmlDocumentOutputPath}\`!`);
    });
    
    const jsFile = `window.addEventListener('DOMContentLoaded', () => {
        const replaceText = (selector, text) => {
            const element = document.getElementById(selector)
            if (element) element.innerText = text
        }
    
        for (const type of ['chrome', 'node', 'electron']) {
            replaceText(\`\${type}-version\`, process.versions[type])
        }
    });`;
    const jsFileOutputPath = path.join(__dirname, "..", "..", "dist", "preload.js");
    fs.writeFile(jsFileOutputPath, jsFile, (err) => {
        if (err) {
            return console.error(err);
        }
        console.log(`\`preload.js\` written to \`${jsFileOutputPath}\`!`);
    });
}

function copyConfigJSON() {
    const destWatchPartyJSONPath = path.join(__dirname, "..", "..", "dist", "watchParty.json");
    fs.copyFileSync(path.join(__dirname, "..", "server", "static", "watchParty.json"), destWatchPartyJSONPath);
    
    fs.readFile(destWatchPartyJSONPath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            process.exit(1);
            return;
        }

        // This isn't needed anymore now that we're hosting the app at the root directory. But that may cause problems for Electron app generation...Will worry about that later.
        // let stringToReplace = `/`;
        // // Replace all instaces of the full path in the CSS with "".
        // data = data.replace(new RegExp(stringToReplace, 'g'), "https://standup.highfidelity.com/");
        // Write the file back out.
        fs.writeFile(destWatchPartyJSONPath, data, (err) => {
            if (err) {
                return console.error(err);
            }
            console.log(`Fixed-up \`watchParty.json\` written to \`${destWatchPartyJSONPath}\`!`);
        });
    });
}

function copyStaticFiles() {
    fs.copyFileSync(path.join(__dirname, "..", "server", "static", "favicon.ico"), path.join(__dirname, "..", "..", "dist", "favicon.ico"));
}

function copyElectronJS() {
    fs.copyFileSync(path.join(__dirname, "electron.js"), path.join(__dirname, "..", "..", "dist", "electron.js"));
}

generateElectronApp();
copyConfigJSON();
copyStaticFiles();
copyElectronJS();

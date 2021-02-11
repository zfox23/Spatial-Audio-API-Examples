const { default: SignJWT } = require('jose/jwt/sign');
const { Point3D, HiFiCommunicator } = require("hifi-spatial-audio");
const crypto = require('crypto');

// This is your "App ID" as obtained from the High Fidelity Audio API Developer Console.
const APP_ID = "aaaaaaaa-1111-bbbb-2222-cccccccccccc";

// This is your "Space ID" as obtained from the High Fidelity Audio API Developer Console.
const SPACE_ID = "aaaaaaaa-1111-bbbb-2222-cccccccccccc";

// This is the "App Secret" as obtained from the High Fidelity Audio API Developer Console.
const APP_SECRET = "aaaaaaaa-1111-bbbb-2222-cccccccccccc";

// Set this string to an arbitrary value. Its value should be unique across all
// clients connecting to a given Space so that other clients can identify this one.
const USER_ID = "steve";

async function start() {    
    let secretKeyForSigning = crypto.createSecretKey(Buffer.from(APP_SECRET, "utf8"));
    
    let hiFiSampleJWT;
    try {
        hiFiSampleJWT = await new SignJWT({
            "user_id": USER_ID,
            "app_id": APP_ID,
            "space_id": SPACE_ID,
            "admin": false
        })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .sign(secretKeyForSigning);
    } catch (error) {
        console.error(`Couldn't create JWT! Error:\n${error}`);
        return;
    }
    
    const communicator = new HiFiCommunicator({
        position: new Point3D({ "x": 0, "y": 0, "z": 0 }),
    });

    try {
        let responseLogString = await communicator.connectToHiFiAudioAPIServer(hiFiSampleJWT);
        console.log(`Successfully connected to HiFi Audio API Server! Response:\n${JSON.stringify(responseLogString)}`);
    } catch (error) {
        console.error(`Couldn't connect to HiFi Audio API Server! Error:\n${JSON.stringify(error)}`);
    }
}

start();
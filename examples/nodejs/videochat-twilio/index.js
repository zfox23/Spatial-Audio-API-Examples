const { default: SignJWT } = require('jose/jwt/sign');
const express = require('express');
const crypto = require('crypto');
const auth = require('./auth.json');
const twilio = require('twilio');
const { ADJECTIVES, NOUNS } = require('./words');

// This is your "App ID" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_ID = auth.HIFI_APP_ID;
// This is your "Space ID" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const SPACE_ID = auth.HIFI_SPACE_ID;
// This is the "App Secret" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_SECRET = auth.HIFI_APP_SECRET;
const SECRET_KEY_FOR_SIGNING = crypto.createSecretKey(Buffer.from(APP_SECRET, "utf8"));

const app = express();
const PORT = 8080;

app.set('view engine', 'ejs');

async function generateHiFiJWT(userID) {
    let hiFiJWT;
    try {
        hiFiJWT = await new SignJWT({
            "user_id": userID,
            "app_id": APP_ID,
            "space_id": SPACE_ID
        })
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .sign(SECRET_KEY_FOR_SIGNING);

        return hiFiJWT;
    } catch (error) {
        console.error(`Couldn't create JWT! Error:\n${error}`);
        return;
    }
}

function generateTwilioAccessToken(providedUserID) {
    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;

    // Create an Access Token
    let accessToken = new AccessToken(
        auth.TWILIO_ACCOUNT_SID,
        auth.TWILIO_API_KEY_SID,
        auth.TWILIO_API_KEY_SECRET
    );

    // Set the Identity of this token
    accessToken.identity = providedUserID;

    // Grant access to Video
    let grant = new VideoGrant();
    grant.room = auth.TWILIO_ROOM_NAME;
    accessToken.addGrant(grant);

    // Serialize the token as a JWT
    return accessToken.toJwt();
}

app.get('/', async (req, res) => {
    let providedUserID = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}-${NOUNS[Math.floor(Math.random() * NOUNS.length)]}${Math.floor(Math.random() * Math.floor(1000))}`;
    let hiFiJWT = await generateHiFiJWT(providedUserID);
    let twilioJWT = generateTwilioAccessToken(providedUserID);
    res.render('index', { providedUserID, hiFiJWT, twilioJWT });
});

app.listen(PORT, () => {
    console.log(`The High Fidelity Sample App is ready and listening at http://localhost:${PORT}`)
});
const { default: SignJWT } = require('jose/jwt/sign');
const express = require('express');
const crypto = require('crypto');
const auth = require('./auth.json');
const fetch = require('node-fetch');
const { ADJECTIVES, NOUNS } = require('./words');

// This is your "App ID" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_ID = auth.HIFI_APP_ID;
// This is the "App Secret" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_SECRET = auth.HIFI_APP_SECRET;
const SECRET_KEY_FOR_SIGNING_HIFI_JWT = crypto.createSecretKey(Buffer.from(APP_SECRET, "utf8"));

const app = express();
const PORT = 8082;

app.set('view engine', 'ejs');

async function generateHiFiJWT(userID, spaceID, isAdmin) {
    let hiFiJWT;
    try {
        let jwtArgs = {
            "user_id": userID,
            "app_id": APP_ID
        };

        if (spaceID) {
            jwtArgs["space_id"] = spaceID;
        }

        if (isAdmin) {
            jwtArgs["admin"] = true;
        }

        hiFiJWT = await new SignJWT(jwtArgs)
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .sign(SECRET_KEY_FOR_SIGNING_HIFI_JWT);

        return hiFiJWT;
    } catch (error) {
        console.error(`Couldn't create JWT! Error:\n${error}`);
        return;
    }
}

async function generateDailyJWT(providedUserID, spaceName) {
    let data = {
        "properties": {
            "user_name": providedUserID,
            "domain_id": auth.DAILY_DOMAIN_ID,
            "start_audio_off": true,
            "room_name": spaceName,
        },
    };
    let dailyMeetingTokensResponse;
    try {
        let fetchData = {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.DAILY_API_KEY}`
            },
            body: JSON.stringify(data)
        };
        dailyMeetingTokensResponse = await fetch(`https://api.daily.co/v1/meeting-tokens`, fetchData);
    } catch (e) {
        console.error(`Error when getting JWT from Daily:\n${e}`);
        return null;
    }

    let dailyMeetingTokensResponseJSON;
    try {
        dailyMeetingTokensResponseJSON = await dailyMeetingTokensResponse.json();
    } catch (e) {
        console.error(`Error when getting JWT from Daily:\n${e}`);
        return null;
    }

    if (!dailyMeetingTokensResponseJSON.token) {
        return null;
    }

    return dailyMeetingTokensResponseJSON.token;

    /*
    // It is theoretically possible to self-sign Daily JWTs, according to the Daily documentation:
    // https://docs.daily.co/reference#self-signing-tokens
    // However, I couldn't find any examples of doing this, so I gave up and am using the REST API to build
    // get our token. I've left some code below for self-signing a JWT - see if you can make it work!

    const SECRET_KEY_FOR_SIGNING_DAILY_JWT = crypto.createSecretKey(Buffer.from(auth.DAILY_API_KEY, "utf8"));
    let dailyJWT = await new SignJWT({
        "ud": providedUserID, // Daily User ID (same as HiFi Provided User ID)
        "r": spaceName, // Daily Room Name
        "iat": Math.round(Date.now() / 1000), // Current timestamp in seconds
        "d": auth.DAILY_DOMAIN_ID, // Daily Domain ID (which is NOT the same as Room ID and must be obtained from the REST API https://docs.daily.co/reference#get-domain-configuration )
        "ao": true, // User joins with mic muted
    })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(SECRET_KEY_FOR_SIGNING_DAILY_JWT);
    
    return dailyJWT;
    */
}

let spaceNameToIDMap = new Map();
app.get('/videochat-daily', async (req, res) => {
    let spaceName = auth.DAILY_DEFAULT_ROOM_NAME;

    let spaceID;
    if (spaceNameToIDMap.has(spaceName)) {
        spaceID = spaceNameToIDMap.get(spaceName);
    } else {
        let createSpaceResponse;
        try {
            createSpaceResponse = await fetch(`https://api.highfidelity.com/api/v1/spaces/create?token=${hifiAdminJWT}&name=${spaceName}`);
        } catch (e) {
            return res.status(500).send();
        }

        let spaceJSON;
        try {
            spaceJSON = await createSpaceResponse.json();
        } catch (e) {
            return res.status(500).send();
        }

        spaceID = spaceJSON["space-id"];
        spaceNameToIDMap.set(spaceName, spaceID);
    }

    console.log(`The HiFi Space ID associated with Space Name \`${spaceName}\` is \`${spaceID}\``);

    let providedUserID = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}-${NOUNS[Math.floor(Math.random() * NOUNS.length)]}${Math.floor(Math.random() * Math.floor(1000))}`;
    let hiFiJWT = await generateHiFiJWT(providedUserID, spaceID, false);
    let dailyJWT = await generateDailyJWT(providedUserID, spaceName);

    if (!dailyJWT) {
        return res.status(500).send();
    }

    res.render('index', { providedUserID, hiFiJWT, dailyJWT, spaceName });
});

let hifiAdminJWT;
app.listen(PORT, async () => {
    hifiAdminJWT = await generateHiFiJWT("daily-example-admin", undefined, true);
    console.log(`The High Fidelity Sample App is ready and listening at http://localhost:${PORT}\nVisit http://localhost:${PORT}/videochat-daily in your browser.`)
});
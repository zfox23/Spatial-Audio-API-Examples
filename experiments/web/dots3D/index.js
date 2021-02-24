const { default: SignJWT } = require('jose/jwt/sign');
const express = require('express');
const crypto = require('crypto');

// This is your "App ID" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_ID = "";
// This is your "Space ID" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const SPACE_ID = "";
// This is the "App Secret" as obtained from the High Fidelity Audio API Developer Console. Do not share this string.
const APP_SECRET = "";
const SECRET_KEY_FOR_SIGNING = crypto.createSecretKey(Buffer.from(APP_SECRET, "utf8"));

const app = express();
const PORT = 8080;

app.set('view engine', 'ejs');

async function generateJWT(userID) {
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

const RANDOM_NAMES = ['Steve', 'Lashawna', 'Erline', 'Connie', 'Keven', 'Tiesha', 'Hoyt', 'Sheldon', 'Jolyn', 'Dorcas', 'Young'];
app.get('/hackathon', async (req, res) => {
    let providedUserID = `${RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]}${Math.floor(Math.random() * Math.floor(100))}`;
    let hiFiJWT = await generateJWT(providedUserID);
    res.render('index', { providedUserID, hiFiJWT });
});

app.listen(PORT, () => {
    console.log(`The High Fidelity Sample App is ready and listening at http://localhost:${PORT}`)
});

app.use(express.static('public'));
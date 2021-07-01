const isInProdMode = process.argv.slice(2)[0] === "prod";
const isInHTTPSMode = process.argv.slice(2)[1] === "true";

console.warn(`*****\nServer production mode status: ${isInProdMode}\n*****\n`);

const fs = require('fs');
const webpack = require('webpack');
const path = require('path');
const express = require('express');
import * as crypto from "crypto";
import fetch from 'node-fetch';
import { URLSearchParams } from "url";
import { ServerAnalyticsController, ServerAnalyticsEventCategory, SlackBotAddedEvent, SlackBotUsedEvent, UserConnectedOrDisconnectedEvent } from "./analytics/ServerAnalyticsController";
const auth = require('../../../auth.json');
const { generateHiFiJWT } = require('./utilities');
import { renderApp } from "./serverRender";

const analyticsController = new ServerAnalyticsController();

// This may need to be configurable in the future.
// For now, all instances of SS will use the "Standard" JSON configuration.
const appConfigURL = "/standard.json";

const app = express();
const PORT = 8180;

if (!isInProdMode) {
    const webpackHotMiddleware = require('webpack-hot-middleware');
    const webpackDevMiddleware = require('webpack-dev-middleware');
    const chokidar = require('chokidar');

    const WEBPACK_CONFIG = require('../../../webpack.config.js')();
    const WEBPACK_COMPILER = webpack(WEBPACK_CONFIG);

    const devMiddleWare = webpackDevMiddleware(WEBPACK_COMPILER, { publicPath: WEBPACK_CONFIG.output.publicPath, });
    const hotMiddleware = webpackHotMiddleware(WEBPACK_COMPILER, {
        'log': console.log,
        'path': '/__webpack_hmr',
        'heartbeat': 2000,
        'reload': true
    });

    app.use(devMiddleWare);
    app.use(hotMiddleware);

    const watcher = chokidar.watch('.');
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

    WEBPACK_COMPILER.hooks.compilation.tap('ClearClientModuleCachePlugin', (stats: any) => {
        console.log("Clearing client module cache...");
        hotMiddleware.publish({ action: 'reload' });
        Object.keys(require.cache).forEach((id) => {
            if (/[\/\\]client[\/\\]/.test(id)) {
                delete require.cache[id];
            }
        });
    });
}

const DIST_DIR = path.join(__dirname, "..", "..", "..", "dist");
app.use('/', express.static(DIST_DIR));
app.use('/', express.static(path.join(__dirname, "static")));
app.use(require('body-parser').urlencoded({ extended: true }));

app.get('/', connectToSpace);
let spaceNamesWithModifiedZonesThisSession: Array<string> = [];
async function connectToSpace(req: any, res: any, next: any) {
    let spaceName = req.params.spaceName || req.query.spaceName || auth.HIFI_DEFAULT_SPACE_NAME;

    renderApp(isInProdMode, appConfigURL, spaceName, req, async (err: any, page: any) => {
        if (err) {
            return next(err);
        }
        res.send(page);

        // This exists so we don't have to do all of the below operations every time someone connects to
        // a SS session.
        // If the zone configuration doesn't get properly set below, it may never get properly set.
        // That would cause a bug.
        // Also, the code below currently assumes that all Rooms in a SS app configuation should be
        // acoustically isolated from each other.
        if (spaceNamesWithModifiedZonesThisSession.indexOf(spaceName) > -1) {
            return;
        }
        spaceNamesWithModifiedZonesThisSession.push(spaceName);

        let adminHiFiJWT = await generateHiFiJWT("Admin", spaceName, true);

        let listSpacesJSON;
        try {
            let listSpaces = await fetch(`https://${auth.HIFI_ENDPOINT_URL}/api/v1/spaces/?token=${adminHiFiJWT}`);
            listSpacesJSON = await listSpaces.json();
        } catch (e) {
            console.error(`There was an error when listing spaces. Error:\n${JSON.stringify(e)}`);
            return;
        }
        
        let spaceID = listSpacesJSON.find((space: any) => { return space["name"] === spaceName; });
        if (!spaceID) {
            console.log(`Creating a new Space with name \`${spaceName}\`...`);
            let createSpaceJSON;
            try {
                let createSpace = await fetch(`https://${auth.HIFI_ENDPOINT_URL}/api/v1/spaces/create?name=${spaceName}&token=${adminHiFiJWT}`);
                createSpaceJSON = await createSpace.json();
            } catch (e) {
                console.error(`There was an error when creating a new space with name \`${spaceName}\`. Error:\n${JSON.stringify(e)}`);
                return;
            }

            spaceID = createSpaceJSON["space-id"];
        } else {
            spaceID = spaceID["space-id"];
        }
        if (!spaceID) {
            console.error(`There was an error when getting the space ID for the space named ${spaceName}.`);
            return;
        }
        
        let listZonesJSON: Array<any>;
        let listZonesFetchURL = `https://${auth.HIFI_ENDPOINT_URL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminHiFiJWT}`;
        try {
            let listZones = await fetch(listZonesFetchURL);
            listZonesJSON = await listZones.json();
        } catch (e) {
            console.error(`There was an error when listing zones. Error:\n${JSON.stringify(e)}`);
            return;
        }

        let appConfigJSON;
        let appConfigFetchURL = `${req.headers.host}${appConfigURL}`;
        if (appConfigFetchURL.indexOf("http") !== 0) {
            appConfigFetchURL = `${(isInHTTPSMode ? "https://" : "http://")}${appConfigFetchURL}`;
        }
        try {
            let appConfig = await fetch(appConfigFetchURL);
            appConfigJSON = await appConfig.json();
        } catch (e) {
            console.error(`There was an error when downloading the App Config JSON from "${appConfigFetchURL}\". Error:\n${JSON.stringify(e)}`);
            return;
        }

        if (!appConfigJSON.rooms || !Array.isArray(appConfigJSON.rooms)) {
            console.error(`The App Config JSON does not contain any rooms.`);
            return;
        }

        let needsZoneUpdate = false;
        appConfigJSON.rooms.forEach((room: any) => {
            let roomName = room.name;
            if (!listZonesJSON.find((zone: any) => { return zone.name === roomName; })) {
                needsZoneUpdate = true;
            }
        });

        if (!needsZoneUpdate) {
            return;
        }

        console.log(`${spaceName}: The space named "${spaceName}" with space-id "${spaceID}" needs its zone attenuation configuration updated.`);

        let deleteZonesJSON;
        try {
            console.log(`${spaceName}: Deleting all existing zones...`);
            let deleteZones = await fetch(`https://${auth.HIFI_ENDPOINT_URL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminHiFiJWT}`, {method: "DELETE"});
            deleteZonesJSON = await deleteZones.json();
        } catch (e) {
            console.error(`There was an error when deleting all zones. Error:\n${JSON.stringify(e)}`);
            return;
        }
        console.log(`${spaceName}: Successfully deleted all existing zones!`);

        let newZonesJSON;
        let params: Array<any> = [];
        try {
            console.log(`${spaceName}: Creating new zones...`);
            appConfigJSON.rooms.forEach((room: any) => {
                params.push({
                    "name": room.name,
                    "x-min": room.roomCenter.x - room.dimensions.x / 2,
                    "y-min": room.roomCenter.y - room.dimensions.y / 2 - 1, // `-1` because this will be `0` otherwise
                    "z-min": room.roomCenter.z - room.dimensions.z / 2,
                    "x-max": room.roomCenter.x + room.dimensions.x / 2,
                    "y-max": room.roomCenter.y + room.dimensions.y / 2 + 1, // `+1` because this will be `0` otherwise
                    "z-max": room.roomCenter.z + room.dimensions.z / 2,
                });
            });
            let newZones = await fetch(`https://${auth.HIFI_ENDPOINT_URL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminHiFiJWT}`, { method: 'POST', body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' }});
            newZonesJSON = await newZones.json();
        } catch (e) {
            console.error(`There was an error when creating new zones. Error:\n${JSON.stringify(e)}`);
            return;
        }
        console.log(`${spaceName}: Successfully created new zones!`);

        console.log(`${spaceName}: Creating new zone attenuation relationships...`);
        let listenerZoneID, sourceZoneID;
        params = [];
        for (let i = 0; i < newZonesJSON.length; i++) {
            listenerZoneID = newZonesJSON[i]["id"];
            for (let j = 0; j < newZonesJSON.length; j++) {
                sourceZoneID = newZonesJSON[j]["id"];

                if (listenerZoneID === sourceZoneID) {
                    continue;
                }

                params.push({
                    "source-zone-id": sourceZoneID,
                    "listener-zone-id": listenerZoneID,
                    "za-offset": 0,
                    "attenuation": -0.000001,
                    "frequency-rolloff": 0.0001
                });
            }
        }
        let newZoneAttenuationsJSON;
        try {
            let newZoneAttenuations = await fetch(`https://${auth.HIFI_ENDPOINT_URL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${adminHiFiJWT}`, { method: 'POST', body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' }});
            newZoneAttenuationsJSON = await newZoneAttenuations.json();
        } catch (e) {
            console.error(`There was an error when creating new zone attenuations. Error:\n${JSON.stringify(e)}`);
            return;
        }
        console.log(`${spaceName}: Created new zone attenuation relationships!`);
    });
}

app.get('/slack', (req: any, res: any, next: any) => {
    let code = req.query.code;
    if (!code) {
        res.sendStatus(500);
        return;
    }

    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', auth.SLACK_CLIENT_ID);
    params.append('client_secret', auth.SLACK_CLIENT_SECRET);

    fetch("https://slack.com/api/oauth.v2.access", { method: 'POST', body: params })
        .then((res: any) => res.json())
        .then((json: any) => {
            console.log(json);
            if (json && json.ok) {
                analyticsController.logEvent(ServerAnalyticsEventCategory.SlackBotAdded, new SlackBotAddedEvent());
                let okString = `<p>The Spatial Standup bot has been successfully added to the Slack workspace named "${json.team.name}"! Try typing <code>/standup</code> in any Slack channel.</p>`;
                console.log(okString);
                res.status(200).send(okString)

                const usersListParams = new URLSearchParams();
                usersListParams.append("token", json.access_token);
                usersListParams.append("team_id", json.team.id);
                fetch("https://slack.com/api/users.list", { method: 'POST', body: usersListParams })
                    .then((res: any) => res.json())
                    .then((usersListJSON: any) => {
                        console.log("LISTING SLACK USERS:");
                        console.log(usersListJSON);
                    })
                    .catch((e: any) => {
                        let errorString = `There was an error when listing users for the Slack team with ID \`${json.team.id}\`. More information:\n${JSON.stringify(e)}`;
                        console.error(errorString);
                    })
            } else {
                let errorString = `There was an error authorizing Spatial Standup with Slack. More information:\n${JSON.stringify(json)}`;
                console.error(errorString);
                res.status(500).send(errorString);
            }
        })
        .catch((e: any) => {
            let errorString = `There was an error when contacting Slack. More information:\n${JSON.stringify(e)}`;
            console.error(errorString);
            res.send(errorString);
        });
});

app.post('/create', (req: any, res: any, next: any) => {
    let slackChannelID = req.body.channel_id;
    if (!slackChannelID) {
        console.error(`Couldn't generate Spatial Standup link. Request body:\n${JSON.stringify(req.body)}`);
        res.json({
            "response_type": "ephemeral",
            "text": "Sorry, I couldn't generate a Spatial Standup for you."
        });
        return;
    }

    let isHiFiEmployee = false;
    let slackTeamID = req.body.team_id;
    if (slackTeamID && slackTeamID === "T025Q3X6R") {
        isHiFiEmployee = true;
    }
    
    let stringToHash = slackChannelID;
    let hash = crypto.createHash('md5').update(stringToHash).digest('hex');
    let spaceURL, channelText;
    if (isHiFiEmployee) {
        spaceURL = `https://standup-staging.highfidelity.com/${hash}/`;
        channelText = `<${spaceURL}|Click here to join the _staging_ Spatial Standup associated with this Slack channel.>`;
    } else {
        spaceURL = `https://standup.highfidelity.com/${hash}/`;
        channelText = `<${spaceURL}|Click here to join the Spatial Standup associated with this Slack channel.>`;
    }

    analyticsController.logEvent(ServerAnalyticsEventCategory.SlackBotUsed, new SlackBotUsedEvent(req.body.user_id, req.body.team_id, false));

    res.json({
        "response_type": 'in_channel',
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": channelText
                }
            }
        ]
    });
});

app.get('/:spaceName', connectToSpace);

let httpOrHttpsServer;
if (isInHTTPSMode) {
    const options = {
        "key": fs.readFileSync('C:/Users/Zach/AppData/Local/mkcert/localhost+2-key.pem'),
        "cert": fs.readFileSync('C:/Users/Zach/AppData/Local/mkcert/localhost+2.pem'),
        "ca": fs.readFileSync('C:/Users/Zach/AppData/Local/mkcert/rootCA.pem')
    };
    httpOrHttpsServer = require("https").createServer(options, app);
} else {
    httpOrHttpsServer = require("http").createServer(app);
}

const socketIOServer = require("socket.io")(httpOrHttpsServer, {
    path: '/socket.io',
    cors: {
        origins: [`https://localhost:${PORT}`, `http://localhost:${PORT}`, `https://192.168.1.23:${PORT}`, `http://192.168.1.23:${PORT}`],
        methods: ["GET", "POST"]
    }
});

socketIOServer.on("error", (e: any) => {
    console.error(e);
});

class ServerSpaceInfo {
    spaceName: string;
    participants: Array<Participant> = [];

    constructor({ spaceName }: { spaceName: string }) {
        this.spaceName = spaceName;
    }
}

class Participant {
    userUUID: string;
    sessionStartTimestamp: number;
    socketID: string;
    spaceName: string;
    visitIDHash: string;
    currentSeatID: string;
    displayName: string;
    colorHex: string;
    profileImageURL: string;
    isAudioInputMuted: boolean;
    echoCancellationEnabled: boolean;
    agcEnabled: boolean;
    noiseSuppressionEnabled: boolean;
    hiFiGainSliderValue: string;
    volumeThreshold: number;
    currentWatchPartyRoomName: string;

    constructor({
        userUUID,
        sessionStartTimestamp,
        socketID,
        spaceName,
        visitIDHash,
        currentSeatID,
        displayName,
        colorHex,
        profileImageURL,
        isAudioInputMuted,
        echoCancellationEnabled,
        agcEnabled,
        noiseSuppressionEnabled,
        hiFiGainSliderValue,
        volumeThreshold,
        currentWatchPartyRoomName,
    }: {
        userUUID: string,
        sessionStartTimestamp: number,
        socketID: string,
        spaceName: string,
        visitIDHash: string,
        currentSeatID: string,
        displayName: string,
        colorHex: string,
        profileImageURL: string,
        isAudioInputMuted: boolean,
        echoCancellationEnabled: boolean,
        agcEnabled: boolean,
        noiseSuppressionEnabled: boolean,
        hiFiGainSliderValue: string,
        volumeThreshold: number,
        currentWatchPartyRoomName: string,
    }) {
        this.userUUID = userUUID;
        this.sessionStartTimestamp = sessionStartTimestamp;
        this.socketID = socketID;
        this.spaceName = spaceName;
        this.visitIDHash = visitIDHash;
        this.currentSeatID = currentSeatID;
        this.displayName = displayName;
        this.colorHex = colorHex;
        this.profileImageURL = profileImageURL;
        this.isAudioInputMuted = isAudioInputMuted;
        this.echoCancellationEnabled = echoCancellationEnabled;
        this.agcEnabled = agcEnabled;
        this.noiseSuppressionEnabled = noiseSuppressionEnabled;
        this.hiFiGainSliderValue = hiFiGainSliderValue;
        this.volumeThreshold = volumeThreshold;
        this.currentWatchPartyRoomName = currentWatchPartyRoomName;
    }
}

function onWatchNewVideo(newVideoURL: string, spaceName: string, roomName: string) {
    if (!spaceInformation[spaceName]["rooms"][roomName]) {
        console.error(`In \`onWatchNewVideo()\`, no \`spaceInformation["${spaceName}"]["rooms"]["${roomName}"]\`!`);
        return;
    }

    let url = new URL(newVideoURL);

    let youTubeVideoID;
    if (url.hostname === "youtu.be") {
        youTubeVideoID = url.pathname.substr(1);
    } else if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
        const params = new URLSearchParams(url.search);
        youTubeVideoID = params.get("v");
    }

    if (youTubeVideoID) {
        spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL = newVideoURL;
        let startTimestamp = (Date.now() - spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp) / 1000 + spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime;
        console.log(`Emitting \`watchNewYouTubeVideo\` with Video ID \`${youTubeVideoID}\` to all users in ${spaceName}/${roomName}, starting at ${startTimestamp}s with state ${spaceInformation[spaceName]["rooms"][roomName].currentPlayerState}...`);

        socketIOServer.sockets.in(spaceName).emit("watchNewYouTubeVideo", roomName, youTubeVideoID, startTimestamp, spaceInformation[spaceName]["rooms"][roomName].currentPlayerState);
    }
}

function onWatchPartyUserLeft(visitIDHash: string) {
    console.log(`Removing watcher with ID \`${visitIDHash}\`.`);

    let spaceInformationKeys = Object.keys(spaceInformation);
    for (let i = 0; i < spaceInformationKeys.length; i++) {
        let spaceName = spaceInformationKeys[i];
        if (!spaceInformation[spaceName]["rooms"]) {
            break;
        }
        let roomNameKeys = Object.keys(spaceInformation[spaceName]["rooms"]);
        for (let j = 0; j < roomNameKeys.length; j++) {
            let roomName = roomNameKeys[j];
            if (spaceInformation[spaceName]["rooms"][roomName] && spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes) {
                spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes.delete(visitIDHash);

                if (spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes.size === 0) {
                    spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL = undefined;
                    spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = undefined;
                    spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = undefined;
                    spaceInformation[spaceName]["rooms"][roomName].currentPlayerState = 1;
                }

                console.log(`There are now ${spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes.size} watchers present in ${spaceName}/${roomName}`);
            }
        }
    }
}

let spaceInformation: any = {};
socketIOServer.on("connection", (socket: any) => {
    socket.on("addParticipant", ({
        userUUID,
        sessionStartTimestamp,
        spaceName,
        visitIDHash,
        currentSeatID,
        displayName,
        colorHex,
        profileImageURL,
        isAudioInputMuted,
        echoCancellationEnabled,
        agcEnabled,
        noiseSuppressionEnabled,
        hiFiGainSliderValue,
        volumeThreshold,
        currentWatchPartyRoomName,
    }: {
        userUUID: string,
        sessionStartTimestamp: number,
        spaceName: string,
        visitIDHash: string,
        currentSeatID: string,
        displayName: string,
        colorHex: string,
        profileImageURL: string,
        isAudioInputMuted: boolean,
        echoCancellationEnabled: boolean,
        agcEnabled: boolean,
        noiseSuppressionEnabled: boolean,
        hiFiGainSliderValue: string,
        volumeThreshold: number,
        currentWatchPartyRoomName: string,
    }) => {
        if (!spaceInformation[spaceName]) {
            spaceInformation[spaceName] = new ServerSpaceInfo({ spaceName });
        }

        if (spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === visitIDHash; })) {
            // Already had info about this participant.
            return;
        }

        let me = new Participant({
            userUUID,
            sessionStartTimestamp,
            socketID: socket.id,
            spaceName,
            visitIDHash,
            currentSeatID,
            displayName,
            colorHex,
            profileImageURL,
            isAudioInputMuted,
            echoCancellationEnabled,
            agcEnabled,
            noiseSuppressionEnabled,
            hiFiGainSliderValue,
            volumeThreshold,
            currentWatchPartyRoomName,
        });

        spaceInformation[spaceName].participants.push(me);

        socket.join(spaceName);

        socket.to(spaceName).emit("onParticipantsAddedOrEdited", [me]);
        socket.emit("onParticipantsAddedOrEdited", spaceInformation[spaceName].participants.filter((participant: Participant) => { return participant.visitIDHash !== visitIDHash; }));

        analyticsController.logEvent(ServerAnalyticsEventCategory.UserConnected, new UserConnectedOrDisconnectedEvent(spaceName, userUUID, sessionStartTimestamp));
    });

    socket.on("editParticipant", ({
        spaceName,
        visitIDHash,
        currentSeatID,
        displayName,
        colorHex,
        profileImageURL,
        isAudioInputMuted,
        echoCancellationEnabled,
        agcEnabled,
        noiseSuppressionEnabled,
        hiFiGainSliderValue,
        volumeThreshold,
        currentWatchPartyRoomName,
    }: {
        spaceName: string,
        visitIDHash: string,
        currentSeatID: string,
        displayName: string,
        colorHex: string,
        profileImageURL: string,
        isAudioInputMuted: boolean,
        echoCancellationEnabled: boolean,
        agcEnabled: boolean,
        noiseSuppressionEnabled: boolean,
        hiFiGainSliderValue: string,
        volumeThreshold: number,
        currentWatchPartyRoomName: string,
    }) => {
        let participantToEdit = spaceInformation[spaceName].participants.find((participant: Participant) => {
            return participant.visitIDHash === visitIDHash;
        });

        if (participantToEdit) {
            if (typeof (displayName) === "string") {
                participantToEdit.displayName = displayName;
            }
            if (typeof (currentSeatID) === "string") {
                participantToEdit.currentSeatID = currentSeatID;
            }
            if (typeof (colorHex) === "string") {
                participantToEdit.colorHex = colorHex;
            }
            if (typeof (profileImageURL) === "string") {
                participantToEdit.profileImageURL = profileImageURL;
            }
            if (typeof (isAudioInputMuted) === "boolean") {
                participantToEdit.isAudioInputMuted = isAudioInputMuted;
            }
            if (typeof (echoCancellationEnabled) === "boolean") {
                participantToEdit.echoCancellationEnabled = echoCancellationEnabled;
            }
            if (typeof (agcEnabled) === "boolean") {
                participantToEdit.agcEnabled = agcEnabled;
            }
            if (typeof (noiseSuppressionEnabled) === "boolean") {
                participantToEdit.noiseSuppressionEnabled = noiseSuppressionEnabled;
            }
            if (typeof (hiFiGainSliderValue) === "string") {
                participantToEdit.hiFiGainSliderValue = hiFiGainSliderValue;
            }
            if (typeof (volumeThreshold) === "number") {
                participantToEdit.volumeThreshold = volumeThreshold;
            }
            if (typeof (currentWatchPartyRoomName) === "string") {
                participantToEdit.currentWatchPartyRoomName = currentWatchPartyRoomName;
            }
            socket.to(spaceName).emit("onParticipantsAddedOrEdited", [participantToEdit]);
        } else {
            console.error(`editParticipant: Couldn't get participant with visitIDHash: \`${visitIDHash}\`!`);
        }
    });

    socket.on("disconnect", () => {
        let allSpaces = Object.keys(spaceInformation);

        for (let i = 0; i < allSpaces.length; i++) {
            let currentSpace = spaceInformation[allSpaces[i]];
            let participantToRemove = currentSpace.participants.find((participant: Participant) => { return participant.socketID === socket.id; });
            if (participantToRemove) {
                analyticsController.logEvent(ServerAnalyticsEventCategory.UserDisconnected, new UserConnectedOrDisconnectedEvent(participantToRemove.spaceName, participantToRemove.userUUID, participantToRemove.sessionStartTimestamp));
                onWatchPartyUserLeft(participantToRemove.visitIDHash);
                currentSpace.participants = currentSpace.participants.filter((participant: Participant) => { return participant.socketID !== socket.id; });
            }
        }
    });

    socket.on("requestToEnableEchoCancellation", ({
        spaceName,
        toVisitIDHash,
        fromVisitIDHash
    }: {
        spaceName: string,
        toVisitIDHash: string,
        fromVisitIDHash: string
    }) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToEnableEchoCancellation: Couldn't get participant from \`spaceInformation[${spaceName}].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToEnableEchoCancellation: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToEnableEchoCancellation", { fromVisitIDHash });
    });

    socket.on("requestToDisableEchoCancellation", ({
        spaceName,
        toVisitIDHash,
        fromVisitIDHash
    }: {
        spaceName: string,
        toVisitIDHash: string,
        fromVisitIDHash: string
    }) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToDisableEchoCancellation: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToDisableEchoCancellation: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToDisableEchoCancellation", { fromVisitIDHash });
    });

    socket.on("requestToEnableAGC", ({
        spaceName,
        toVisitIDHash,
        fromVisitIDHash
    }: {
        spaceName: string,
        toVisitIDHash: string,
        fromVisitIDHash: string
    }) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToEnableAGC: Couldn't get participant from \`spaceInformation[${spaceName}].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToEnableAGC: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToEnableAGC", { fromVisitIDHash });
    });

    socket.on("requestToDisableAGC", ({
        spaceName,
        toVisitIDHash,
        fromVisitIDHash
    }: {
        spaceName: string,
        toVisitIDHash: string,
        fromVisitIDHash: string
    }) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToDisableAGC: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToDisableAGC: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToDisableAGC", { fromVisitIDHash });
    });

    socket.on("requestToEnableNoiseSuppression", ({
        spaceName,
        toVisitIDHash,
        fromVisitIDHash
    }: {
        spaceName: string,
        toVisitIDHash: string,
        fromVisitIDHash: string
    }) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToEnableNoiseSuppression: Couldn't get participant from \`spaceInformation[${spaceName}].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToEnableNoiseSuppression: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToEnableNoiseSuppression", { fromVisitIDHash });
    });

    socket.on("requestToDisableNoiseSuppression", ({
        spaceName,
        toVisitIDHash,
        fromVisitIDHash
    }: {
        spaceName: string,
        toVisitIDHash: string,
        fromVisitIDHash: string
    }) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToDisableNoiseSuppression: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToDisableNoiseSuppression: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToDisableNoiseSuppression", { fromVisitIDHash });
    });

    socket.on("requestToChangeHiFiGainSliderValue", ({
        spaceName,
        toVisitIDHash,
        fromVisitIDHash,
        newHiFiGainSliderValue
    }: {
        spaceName: string,
        toVisitIDHash: string,
        fromVisitIDHash: string,
        newHiFiGainSliderValue: number
    }) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToChangeHiFiGainSliderValue: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToChangeHiFiGainSliderValue: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToChangeHiFiGainSliderValue", { fromVisitIDHash, newHiFiGainSliderValue });
    });

    socket.on("requestToChangeVolumeThreshold", ({
        spaceName,
        toVisitIDHash,
        fromVisitIDHash,
        newVolumeThreshold
    }: {
        spaceName: string,
        toVisitIDHash: string,
        fromVisitIDHash: string,
        newVolumeThreshold: number
    }) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToChangeVolumeThreshold: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToChangeVolumeThreshold: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToChangeVolumeThreshold", { fromVisitIDHash, newVolumeThreshold });
    });

    socket.on("requestToMuteAudioInputDevice", ({
        spaceName,
        toVisitIDHash,
        fromVisitIDHash
    }: {
        spaceName: string,
        toVisitIDHash: string,
        fromVisitIDHash: string
    }) => {
        if (!spaceInformation[spaceName]) { return; }
        let participant = spaceInformation[spaceName].participants.find((participant: Participant) => { return participant.visitIDHash === toVisitIDHash; });
        if (!participant) {
            console.error(`requestToMuteAudioInputDevice: Couldn't get participant from \`spaceInformation[spaceName].participants[]\` with Visit ID Hash \`${toVisitIDHash}\`!`);
            return;
        }
        if (!participant.socketID) {
            console.error(`requestToMuteAudioInputDevice: Participant didn't have a \`socketID\`!`);
            return;
        }
        socketIOServer.to(participant.socketID).emit("onRequestToMuteAudioInputDevice", { fromVisitIDHash });
    });

    socket.on("addParticle", ({
        visitIDHash,
        spaceName,
        particleData
    }: {
        visitIDHash: string,
        spaceName: string,
        particleData: any
    }) => {
        socket.to(spaceName).emit("requestParticleAdd", { visitIDHash, particleData });
    });

    socket.on("addSound", ({
        visitIDHash,
        spaceName,
        soundParams
    }: {
        visitIDHash: string,
        spaceName: string,
        soundParams: any
    }) => {
        socket.to(spaceName).emit("requestSoundAdd", { visitIDHash, soundParams });
    });

    socket.on("watchPartyUserJoined", (visitIDHash: string, spaceName: string, roomName: string) => {
        console.log(`In ${spaceName}/${roomName}, adding watcher with ID \`${visitIDHash}\`.`);

        if (!spaceInformation[spaceName]["rooms"]) {
            spaceInformation[spaceName]["rooms"] = {};
        }

        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            spaceInformation[spaceName]["rooms"][roomName] = {
                currentQueuedVideoURL: undefined,
                currentVideoSeekTime: undefined,
                currentVideoSeekTimeSetTimestamp: undefined,
                currentPlayerState: 1,
                watcherVisitIDHashes: new Set(),
            };
        }

        spaceInformation[spaceName]["rooms"][roomName].watcherVisitIDHashes.add(visitIDHash);

        if (spaceInformation[spaceName] && spaceInformation[spaceName]["rooms"][roomName] && spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL) {
            onWatchNewVideo(spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL, spaceName, roomName);
        }
    });

    socket.on("watchPartyUserLeft", (visitIDHash: string) => {
        onWatchPartyUserLeft(visitIDHash);
    });

    socket.on("enqueueNewVideo", (visitIDHash: string, newVideoURL: string, spaceName: string, roomName: string) => {
        if (!spaceInformation[spaceName]) {
            return;
        }

        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            return;
        }

        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = 0;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = Date.now();

        console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` requested that a new video be played with URL \`${newVideoURL}\`.`);

        onWatchNewVideo(newVideoURL, spaceName, roomName);
    });

    socket.on("requestVideoSeek", (visitIDHash: string, seekTimeSeconds: number, spaceName: string, roomName: string) => {
        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            return;
        }

        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = seekTimeSeconds;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = Date.now();

        console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` requested that the video be seeked to ${spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime}s.`);

        socketIOServer.sockets.in(spaceName).emit("videoSeek", roomName, visitIDHash, spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime);
    });

    socket.on("setSeekTime", (visitIDHash: string, seekTimeSeconds: number, spaceName: string, roomName: string) => {
        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            return;
        }

        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = seekTimeSeconds;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = Date.now();
    });

    socket.on("newPlayerState", (visitIDHash: string, newPlayerState: number, seekTimeSeconds: number, spaceName: string, roomName: string) => {
        if (!spaceInformation[spaceName]["rooms"][roomName]) {
            return;
        }

        if (!(newPlayerState === 1 || newPlayerState === 2) || spaceInformation[spaceName]["rooms"][roomName].currentPlayerState === newPlayerState) {
            return;
        }

        if (newPlayerState === 2) { // YT.PlayerState.PAUSED
            console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` requested that the video be paused at ${seekTimeSeconds}s.`);
            socket.broadcast.to(spaceName).emit("videoPause", roomName, visitIDHash, seekTimeSeconds);
        } else if (newPlayerState === 1) { // YT.PlayerState.PLAYING
            console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` requested that the video be played starting at ${seekTimeSeconds}s.`);
            socket.broadcast.to(spaceName).emit("videoPlay", roomName, visitIDHash, seekTimeSeconds);
        }

        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = seekTimeSeconds;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = Date.now();
        spaceInformation[spaceName]["rooms"][roomName].currentPlayerState = newPlayerState;
    });

    socket.on("youTubeVideoEnded", (visitIDHash: string, spaceName: string, roomName: string) => {
        if (!(spaceInformation[spaceName] && spaceInformation[spaceName]["rooms"][roomName])) {
            return;
        }

        spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL = undefined;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTime = undefined;
        spaceInformation[spaceName]["rooms"][roomName].currentVideoSeekTimeSetTimestamp = undefined;
        spaceInformation[spaceName]["rooms"][roomName].currentQueuedVideoURL = undefined;
        console.log(`In ${spaceName}/${roomName}, \`${visitIDHash}\` reported that the video ended.`);
        socketIOServer.sockets.in(spaceName).emit("videoClear", roomName, visitIDHash);
    });
});

httpOrHttpsServer.listen(PORT, (err: any) => {
    if (err) {
        throw err;
    }
    console.log(`${Date.now()}: Spatial Standup is ready. Go to this URL in your browser: ${isInHTTPSMode ? "https" : "http"}://localhost:${PORT}/`);
});

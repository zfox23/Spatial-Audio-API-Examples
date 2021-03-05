const socket = io('', { path: '/spatial-speaker-space/socket.io' });
let webSocketStuffInitialized = false;

function initWebSocketStuff() {
    webSocketStuffInitialized = true;
    socket.emit("addParticipant", { visitIDHash: myVisitIDHash, displayName: myUserData.displayName, colorHex: myUserData.colorHex, isSpeaker: IS_SPEAKER, spaceName });
}

function updateRemoteParticipant() {
    if (!webSocketStuffInitialized) {
        return;
    }
    let dataToUpdate = { visitIDHash: myVisitIDHash, displayName: myUserData.displayName, colorHex: myUserData.colorHex, spaceName };
    console.log(`Updating data about me on server:\n${JSON.stringify(dataToUpdate)}`);
    socket.emit("editParticipant", dataToUpdate);
}

function stopWebSocketStuff() {
    socket.emit("removeParticipant", { visitIDHash: myVisitIDHash, spaceName });
    webSocketStuffInitialized = false;
}

socket.on("onParticipantAdded", (participantArray) => {
    console.log(`Retrieved information about ${participantArray.length} participants from the server:\n${JSON.stringify(participantArray)}`);
    participantArray.forEach((participant) => {
        let { visitIDHash, displayName, colorHex, isSpeaker } = participant;
        let localUserData = allLocalUserData.find((participant) => { return participant.visitIDHash === visitIDHash; });
        if (localUserData) {
            console.log(`Updating participant with hash \`${localUserData.visitIDHash}\`:\nDisplay Name: \`${displayName}\`\nColor: ${colorHex}\nisSpeaker: ${isSpeaker}`)
            localUserData.displayName = displayName;
            localUserData.colorHex = colorHex;
            localUserData.isSpeaker = isSpeaker;
        } else if (visitIDHash && displayName) {
            allLocalUserData.push(new SpeakerSpaceUserData({ visitIDHash, displayName, colorHex, isSpeaker }));
        }

        recomputeSpeakerAndAudienceCount();
    });
});

socket.on("requestParticleAdd", ({ visitIDHash, spaceName, particleData } = {}) => {
    let particleParams = JSON.parse(particleData);

    if (particleParams.signalName) {
        console.log(`"${visitIDHash}" added a signal particle!`);
        signalsController.addSignal(particleParams);
    }
});

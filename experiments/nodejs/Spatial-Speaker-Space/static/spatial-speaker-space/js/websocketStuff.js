const spatialSpeakerSpaceSocket = io('', { path: '/spatial-speaker-space/socket.io' });
// This Experiment plays nicely with the Spatial Microphone example found elsewhere in this repository! :)
// But, if you aren't running that example, that's OK; Spatial-Speaker-Space will still work.
const spatialMicrophoneSocket = io(':8125', { path: '/spatial-microphone/socket.io', reconnectionAttempts: 1 });
let webSocketStuffInitialized = false;

function initWebSocketStuff() {
    webSocketStuffInitialized = true;
    spatialSpeakerSpaceSocket.emit("addParticipant", { visitIDHash: myVisitIDHash, displayName: myUserData.displayName, colorHex: myUserData.colorHex, isSpeaker: IS_SPEAKER, spaceName });
    spatialMicrophoneSocket.emit("userConnected", { spaceName, visitIDHash: myVisitIDHash, position: myUserData.position });
}

function updateRemoteParticipant() {
    if (!webSocketStuffInitialized) {
        return;
    }
    let dataToUpdate = { visitIDHash: myVisitIDHash, displayName: myUserData.displayName, colorHex: myUserData.colorHex, spaceName };
    console.log(`Updating data about me on server:\n${JSON.stringify(dataToUpdate)}`);
    spatialSpeakerSpaceSocket.emit("editParticipant", dataToUpdate);
}

function stopWebSocketStuff() {
    spatialSpeakerSpaceSocket.emit("removeParticipant", { visitIDHash: myVisitIDHash, spaceName });
    spatialMicrophoneSocket.emit("userDisconnected", { spaceName, visitIDHash: myVisitIDHash });
    webSocketStuffInitialized = false;
}

spatialSpeakerSpaceSocket.on("onParticipantAdded", (participantArray) => {
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

spatialSpeakerSpaceSocket.on("requestParticleAdd", ({ visitIDHash, spaceName, particleData } = {}) => {
    let particleParams = JSON.parse(particleData);

    if (particleParams.signalName) {
        console.log(`"${visitIDHash}" added a signal particle!`);
        signalsController.addSignal(particleParams);
    }
});

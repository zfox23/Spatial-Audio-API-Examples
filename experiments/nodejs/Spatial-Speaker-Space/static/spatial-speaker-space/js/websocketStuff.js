const spatialSpeakerSpaceSocket = io(':8123', { path: '/spatial-speaker-space/socket.io' });
let readyToSendWebSocketData = false;

spatialSpeakerSpaceSocket.on("connect", (socket) => {
    maybeSendInitialWebSocketData();
});

function maybeSendInitialWebSocketData() {
    if (!readyToSendWebSocketData) {
        return;
    }
    spatialSpeakerSpaceSocket.emit("addParticipant", { visitIDHash: myVisitIDHash, displayName: myUserData.displayName, colorHex: myUserData.colorHex, participantType: IS_SPEAKER ? "speaker" : "audience", spaceName });
}

function updateRemoteParticipant() {
    if (!readyToSendWebSocketData) {
        return;
    }
    let dataToUpdate = { visitIDHash: myVisitIDHash, displayName: myUserData.displayName, colorHex: myUserData.colorHex, spaceName };
    console.log(`Updating data about me on server:\n${JSON.stringify(dataToUpdate)}`);
    spatialSpeakerSpaceSocket.emit("editParticipant", dataToUpdate);
}

function stopWebSocketStuff() {
    spatialSpeakerSpaceSocket.emit("removeParticipant", { visitIDHash: myVisitIDHash, spaceName });
    readyToSendWebSocketData = false;
}

spatialSpeakerSpaceSocket.on("onParticipantAdded", (participantArray) => {
    console.log(`Retrieved information about ${participantArray.length} participant(s) from the server:\n${JSON.stringify(participantArray)}`);
    participantArray.forEach((participant) => {
        let { visitIDHash, displayName, colorHex, participantType, isRecording } = participant;
        let localUserData = allLocalUserData.find((participant) => { return participant.visitIDHash === visitIDHash; });
        if (localUserData) {
            console.log(`Updating participant with hash \`${localUserData.visitIDHash}\`:\nDisplay Name: \`${displayName}\`\nColor: ${colorHex}\nparticipantType: ${participantType}`)
            if (typeof (displayName) === "string") {
                localUserData.displayName = displayName;
            }
            if (typeof (colorHex) === "string") {
                localUserData.colorHex = colorHex;
            }
            if (typeof (participantType) === "string") {
                localUserData.participantType = participantType;
            }
            if (typeof (isRecording) === "boolean") {
                localUserData.isRecording = isRecording;
            }
        } else if (visitIDHash && displayName) {
            allLocalUserData.push(new SpeakerSpaceUserData({ visitIDHash, displayName, colorHex, participantType, isRecording }));
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

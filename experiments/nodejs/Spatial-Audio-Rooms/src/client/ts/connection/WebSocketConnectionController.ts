import { avDevicesController, connectionController, roomController, uiController, userDataController, userInputController } from "..";
declare var HIFI_SPACE_NAME: string;

const io = require("socket.io-client");

interface WebSocketParticipantData {
    visitIDHash: string;
    currentSeatID: string;
    displayName: string;
    colorHex: string;
    echoCancellationEnabled: boolean;
    agcEnabled: boolean;
    hiFiGainSliderValue: string;
    volumeThreshold: number;
}

export class WebSocketConnectionController {
    socket: SocketIOClient.Socket;
    readyToSendWebSocketData: boolean = false;
    retrievedInitialWebSocketServerData: boolean = false;

    constructor() {
        this.socket = io('', { path: '/spatial-audio-rooms/socket.io' });

        this.socket.on("connect", (socket: any) => {
            console.log(`Connected to Socket.IO WebSocket server!`);
            this.maybeSendInitialWebSocketData();
        });

        this.socket.on("disconnect", (socket: any) => {
            console.log(`Disconnected from Socket.IO WebSocket server!`);
        });

        this.socket.on("onParticipantsAddedOrEdited", (participantArray: Array<WebSocketParticipantData>) => {
            console.log(`Retrieved information about ${participantArray.length} participant(s) from the server:\n${JSON.stringify(participantArray)}`);
            participantArray.forEach((participant) => {
                let {
                    visitIDHash,
                    currentSeatID,
                    displayName,
                    colorHex,
                    echoCancellationEnabled,
                    agcEnabled,
                    hiFiGainSliderValue,
                    volumeThreshold,
                } = participant;

                let localUserData = userDataController.allOtherUserData.find((userData) => { return userData.visitIDHash === visitIDHash; });
                if (localUserData) {
                    if (typeof (displayName) === "string") {
                        localUserData.displayName = displayName;
                    }
                    if (typeof (colorHex) === "string") {
                        localUserData.colorHex = colorHex;
                    }
                    if (typeof (echoCancellationEnabled) === "boolean") {
                        localUserData.echoCancellationEnabled = echoCancellationEnabled;
                    }
                    if (typeof (agcEnabled) === "boolean") {
                        localUserData.agcEnabled = agcEnabled;
                    }
                    if (typeof (hiFiGainSliderValue) === "string") {
                        localUserData.hiFiGainSliderValue = hiFiGainSliderValue;
                        localUserData.hiFiGain = uiController.hiFiGainFromSliderValue(localUserData.hiFiGainSliderValue);
                    }
                    if (typeof (volumeThreshold) === "number") {
                        localUserData.volumeThreshold = volumeThreshold;
                    }
                    if (typeof (currentSeatID) === "string") {
                        if (localUserData.currentSeat) {
                            localUserData.currentSeat.occupiedUserData = undefined;
                        }
                        localUserData.currentSeat = roomController.getSeatFromSeatID(currentSeatID);
                        if (localUserData.currentSeat) {
                            localUserData.currentSeat.occupiedUserData = localUserData;
                            localUserData.currentRoom = localUserData.currentSeat.room;
                        } else {
                            localUserData.currentRoom = undefined;
                        }
                    }

                    console.log(`Updated participant:\nVisit ID Hash \`${localUserData.visitIDHash}\`:\nDisplay Name: \`${displayName}\`\nColor: ${colorHex}\nCurrent Seat ID: ${localUserData.currentSeat ? localUserData.currentSeat.seatID : "undefined"}\nCurrent Room Name: ${localUserData.currentRoom ? localUserData.currentRoom.name : "undefined"}\nechoCancellationEnabled: ${echoCancellationEnabled}\nagcEnabled: ${agcEnabled}\nhiFiGainSliderValue: ${hiFiGainSliderValue}\nvolumeThreshold:${volumeThreshold}\n`);
                } else if (visitIDHash && displayName) {
                    localUserData = {
                        visitIDHash,
                        displayName,
                        colorHex,
                        echoCancellationEnabled,
                        agcEnabled,
                        hiFiGainSliderValue,
                        volumeThreshold,
                        tempData: {}
                    };
                    localUserData.hiFiGain = uiController.hiFiGainFromSliderValue(localUserData.hiFiGainSliderValue);

                    if (localUserData.currentSeat) {
                        localUserData.currentSeat.occupiedUserData = undefined;
                    }
                    localUserData.currentSeat = roomController.getSeatFromSeatID(currentSeatID);
                    if (localUserData.currentSeat) {
                        localUserData.currentSeat.occupiedUserData = localUserData;
                        localUserData.currentRoom = localUserData.currentSeat.room;
                    } else {
                        localUserData.currentRoom = undefined;
                    }

                    userDataController.allOtherUserData.push(localUserData);
                }

                uiController.maybeUpdateAvatarContextMenu(localUserData);
                roomController.updateRoomList();
            });

            if (!this.retrievedInitialWebSocketServerData) {
                this.retrievedInitialWebSocketServerData = true;
                
                if (connectionController.receivedInitialOtherUserDataFromHiFi) {
                    userDataController.myAvatar.positionSelfInRoom(roomController.getStartingRoomName());
                }
            }
        });

        this.socket.on("onRequestToEnableEchoCancellation", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to enable echo cancellation!`);
            avDevicesController.audioConstraints.echoCancellation = true;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToDisableEchoCancellation", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to disable echo cancellation!`);
            avDevicesController.audioConstraints.echoCancellation = false;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToEnableAGC", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to enable AGC!`);
            avDevicesController.audioConstraints.autoGainControl = true;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToDisableAGC", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to disable AGC!`);
            avDevicesController.audioConstraints.autoGainControl = false;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToChangeHiFiGainSliderValue", ({ fromVisitIDHash, newHiFiGainSliderValue }: { fromVisitIDHash: string, newHiFiGainSliderValue: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to change HiFiGainSliderValue to \`${newHiFiGainSliderValue}\`!`);
            userInputController.setHiFiGainFromSliderValue(newHiFiGainSliderValue);
        });

        this.socket.on("onRequestToChangeVolumeThreshold", ({ fromVisitIDHash, newVolumeThreshold }: { fromVisitIDHash: string, newVolumeThreshold: number }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to change Volume Threshold to \`${newVolumeThreshold}\`!`);
            userInputController.setVolumeThreshold(newVolumeThreshold);
        });
    }

    maybeSendInitialWebSocketData() {
        if (!this.readyToSendWebSocketData) {
            return;
        }

        const myUserData = userDataController.myAvatar.myUserData;

        this.socket.emit("addParticipant", {
            spaceName: HIFI_SPACE_NAME,
            visitIDHash: myUserData.visitIDHash,
            currentSeatID: myUserData.currentSeat ? myUserData.currentSeat.seatID : "",
            displayName: myUserData.displayName,
            colorHex: myUserData.colorHex,
            echoCancellationEnabled: myUserData.echoCancellationEnabled,
            agcEnabled: myUserData.agcEnabled,
            hiFiGainSliderValue: myUserData.hiFiGainSliderValue,
            volumeThreshold: myUserData.volumeThreshold,
        });
    }

    updateMyUserDataOnWebSocketServer() {
        if (!this.readyToSendWebSocketData) {
            return;
        }

        const myUserData = userDataController.myAvatar.myUserData;

        let dataToUpdate = {
            spaceName: HIFI_SPACE_NAME,
            visitIDHash: myUserData.visitIDHash,
            currentSeatID: myUserData.currentSeat ? myUserData.currentSeat.seatID : "",
            displayName: myUserData.displayName,
            colorHex: myUserData.colorHex,
            echoCancellationEnabled: myUserData.echoCancellationEnabled,
            agcEnabled: myUserData.agcEnabled,
            hiFiGainSliderValue: myUserData.hiFiGainSliderValue,
            volumeThreshold: myUserData.volumeThreshold,
        };

        console.log(`Updating data about me on server:\n${JSON.stringify(dataToUpdate)}`);

        this.socket.emit("editParticipant", dataToUpdate);
    }

    requestToEnableEchoCancellation(visitIDHash: string) {
        this.socket.emit("requestToEnableEchoCancellation", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToDisableEchoCancellation(visitIDHash: string) {
        this.socket.emit("requestToDisableEchoCancellation", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToEnableAGC(visitIDHash: string) {
        this.socket.emit("requestToEnableAGC", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToDisableAGC(visitIDHash: string) {
        this.socket.emit("requestToDisableAGC", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToChangeHiFiGainSliderValue(visitIDHash: string, newHiFiGainSliderValue: string) {
        this.socket.emit("requestToChangeHiFiGainSliderValue", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash, newHiFiGainSliderValue });
    }

    requestToChangeVolumeThreshold(visitIDHash: string, newVolumeThreshold: number) {
        this.socket.emit("requestToChangeVolumeThreshold", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash, newVolumeThreshold });
    }

    stopWebSocketStuff() {
        console.log(`Disconnecting from WebSocket server...`);
        this.socket.disconnect();
        this.readyToSendWebSocketData = false;
    }
}
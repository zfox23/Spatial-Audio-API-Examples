import { connectionController, roomController, uiController, userDataController, userInputController } from "..";
import { HEARTBEAT_INTERVAL_MS } from "../constants/constants";
declare var HIFI_SPACE_NAME: string;

const io = require("socket.io-client");

interface WebSocketParticipantData {
    visitIDHash: string;
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
    heartbeatInterval: NodeJS.Timeout;

    constructor() {
        this.socket = io('', { path: '/spatial-audio-rooms/socket.io' });

        this.socket.on("connect", (socket: any) => {
            console.log(`Connected to Socket.IO WebSocket server!`);
            this.maybeSendInitialWebSocketData();
            // TODO: Fix the WSS heartbeat functionality, or remove it and replace it with something more robust.
            //this.startHeartbeatInterval();
        });

        this.socket.on("disconnect", (socket: any) => {
            console.log(`Disconnected from Socket.IO WebSocket server!`);
            this.stopHeartbeatInterval();
        });

        this.socket.on("onParticipantAdded", (participantArray: Array<WebSocketParticipantData>) => {
            console.log(`Retrieved information about ${participantArray.length} participant(s) from the server:\n${JSON.stringify(participantArray)}`);
            participantArray.forEach((participant) => {
                let {
                    visitIDHash,
                    displayName,
                    colorHex,
                    echoCancellationEnabled,
                    agcEnabled,
                    hiFiGainSliderValue,
                    volumeThreshold,
                } = participant;

                let localUserData = userDataController.allOtherUserData.find((userData) => { return userData.visitIDHash === visitIDHash; });
                if (localUserData) {
                    console.log(`Updating participant with hash \`${localUserData.visitIDHash}\`:\nDisplay Name: \`${displayName}\`\nColor: ${colorHex}\nechoCancellationEnabled: ${echoCancellationEnabled}\nagcEnabled: ${agcEnabled}\nhiFiGainSliderValue: ${hiFiGainSliderValue}\nvolumeThreshold:${volumeThreshold}\n`);
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
                } else if (visitIDHash && displayName) {
                    localUserData = {
                        visitIDHash,
                        displayName,
                        colorHex,
                        echoCancellationEnabled,
                        agcEnabled,
                        hiFiGainSliderValue,
                        volumeThreshold,
                    };
                    localUserData.hiFiGain = uiController.hiFiGainFromSliderValue(localUserData.hiFiGainSliderValue);
                    userDataController.allOtherUserData.push(localUserData);
                }

                uiController.maybeUpdateAvatarContextMenu(localUserData)

                roomController.updateAllRoomSeats();
            });
        });

        this.socket.on("onRequestToEnableEchoCancellation", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to enable echo cancellation!`);
            connectionController.audioConstraints.echoCancellation = true;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToDisableEchoCancellation", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to disable echo cancellation!`);
            connectionController.audioConstraints.echoCancellation = false;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToEnableAGC", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to enable AGC!`);
            connectionController.audioConstraints.autoGainControl = true;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToDisableAGC", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to disable AGC!`);
            connectionController.audioConstraints.autoGainControl = false;
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

    // Using a heartbeat to the WebSocket server might not be the best way to
    // handle users disconnecting un-cleanly (i.e. without sending "participantDisconnected" to the WSS),
    // but I don't know the best way to do this yet.
    // Also, as of 2021-04-02, this doesn't even work yet.
    startHeartbeatInterval() {
        console.log("Starting WebSocket server heartbeat interval...");

        this.heartbeatInterval = setInterval(() => {
            const myUserData = userDataController.myAvatar.myUserData;

            if (!(myUserData && myUserData.visitIDHash)) {
                return;
            }

            this.socket.emit("heartbeat", {
                spaceName: HIFI_SPACE_NAME,
                visitIDHash: myUserData.visitIDHash,
            });
        }, HEARTBEAT_INTERVAL_MS);
    }

    stopHeartbeatInterval() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.heartbeatInterval = undefined;
    }

    maybeSendInitialWebSocketData() {
        if (!this.readyToSendWebSocketData) {
            return;
        }

        const myUserData = userDataController.myAvatar.myUserData;

        this.socket.emit("addParticipant", {
            spaceName: HIFI_SPACE_NAME,
            visitIDHash: myUserData.visitIDHash,
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
        if (this.socket.connected) {
            console.log("Emitting \`removeParticipant\` over \`this.socket\`...")
            try {
                this.socket.emit("removeParticipant", { spaceName: HIFI_SPACE_NAME, visitIDHash: userDataController.myAvatar.myUserData.visitIDHash, });
            } catch (e) {
                console.warn(`Couldn't emit \`removeParticipant\` over \`this.socket\`:\n${e}`);
            }
            this.readyToSendWebSocketData = false;
        } else {
            console.warn(`Couldn't emit \`removeParticipant\` over \`this.socket\`: \`this.socket.connected\` is falsey!`);
        }
    }
}
import { roomController, userDataController } from "..";
declare var HIFI_SPACE_NAME: string;

const io = require("socket.io-client");

interface WebSocketParticipant {
    visitIDHash: string;
    displayName: string;
    colorHex: string;
}

export class WebSocketConnectionController {
    socket: SocketIOClient.Socket;
    readyToSendWebSocketData: boolean = false;

    constructor() {
        this.socket = io('', { path: '/spatial-audio-rooms/socket.io' });

        this.socket.on("connect", (socket: any) => {
            this.maybeSendInitialWebSocketData();
        });

        this.socket.on("onParticipantAdded", (participantArray: Array<WebSocketParticipant>) => {
            console.log(`Retrieved information about ${participantArray.length} participant(s) from the server:\n${JSON.stringify(participantArray)}`);
            participantArray.forEach((participant) => {
                let { visitIDHash, displayName, colorHex } = participant;
                let localUserData = userDataController.allOtherUserData.find((userData) => { return userData.visitIDHash === visitIDHash; });
                if (localUserData) {
                    console.log(`Updating participant with hash \`${localUserData.visitIDHash}\`:\nDisplay Name: \`${displayName}\`\nColor: ${colorHex}`)
                    if (typeof (displayName) === "string") {
                        localUserData.displayName = displayName;
                    }
                    if (typeof (colorHex) === "string") {
                        localUserData.colorHex = colorHex;
                    }
                } else if (visitIDHash && displayName) {
                    userDataController.allOtherUserData.push({ visitIDHash, displayName, colorHex });
                }
                
                roomController.updateAllRoomSeats();
            });
        });
    }

    maybeSendInitialWebSocketData() {
        if (!this.readyToSendWebSocketData) {
            return;
        }

        const myUserData = userDataController.myAvatar.myUserData;

        this.socket.emit("addParticipant", { spaceName: HIFI_SPACE_NAME, visitIDHash: myUserData.visitIDHash, displayName: myUserData.displayName, colorHex: myUserData.colorHex, });
    }

    updateRemoteParticipant() {
        if (!this.readyToSendWebSocketData) {
            return;
        }

        const myUserData = userDataController.myAvatar.myUserData;

        let dataToUpdate = { spaceName: HIFI_SPACE_NAME, visitIDHash: myUserData.visitIDHash, displayName: myUserData.displayName, colorHex: myUserData.colorHex, };

        console.log(`Updating data about me on server:\n${JSON.stringify(dataToUpdate)}`);

        this.socket.emit("editParticipant", dataToUpdate);
    }

    stopWebSocketStuff() {
        const myUserData = userDataController.myAvatar.myUserData;
        this.socket.emit("removeParticipant", { spaceName: HIFI_SPACE_NAME, visitIDHash: myUserData.visitIDHash, });
        this.readyToSendWebSocketData = false;
    }
}
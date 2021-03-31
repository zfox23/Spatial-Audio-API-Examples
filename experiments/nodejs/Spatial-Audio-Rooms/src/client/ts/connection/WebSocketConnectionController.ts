import { userDataController } from "..";
declare var HIFI_SPACE_NAME: string;

const io = require("socket.io-client");

export class WebSocketConnectionController {
    socket: SocketIOClient.Socket;
    readyToSendWebSocketData: boolean = false;

    constructor() {
        this.socket = io('', { path: '/spatial-audio-rooms/socket.io' });

        this.socket.on("connect", (socket: any) => {
            this.maybeSendInitialWebSocketData();
        });
    }

    maybeSendInitialWebSocketData() {
        if (!this.readyToSendWebSocketData) {
            return;
        }

        const myUserData = userDataController.myAvatar.myUserData;

        this.socket.emit("addParticipant", { visitIDHash: myUserData.visitIDHash, displayName: myUserData.displayName, colorHex: myUserData.colorHex, HIFI_SPACE_NAME });
    }
}
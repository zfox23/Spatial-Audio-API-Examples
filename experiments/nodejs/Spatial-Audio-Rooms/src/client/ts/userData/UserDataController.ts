import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { userDataController, connectionController, roomController, physicsController } from "..";

declare var HIFI_PROVIDED_USER_ID: string;

export interface UserData {
    visitIDHash?: string;
    providedUserID?: string;
    currentRoomName?: string;
    displayName?: string;
    colorHex?: string;
    motionStartTimestamp?: number;
    positionStart?: Point3D;
    positionCurrent?: Point3D;
    positionTarget?: Point3D;
    orientationEuler?: OrientationEuler3D;
    volumeDecibels?: number;
    volumeDecibelsPeak?: number;
    hiFiGain?: number;
    hiFiGainSliderValue?: string;
    volumeThreshold?: number;
    isMuted?: boolean;
    echoCancellationEnabled?: boolean;
    agcEnabled?: boolean;
}

interface DataToTransmitToHiFi {
    position?: Point3D;
    orientationEuler?: OrientationEuler3D;
}

class MyAvatar {
    myUserData: UserData;

    constructor() {
        this.myUserData = {
            visitIDHash: undefined,
            providedUserID: HIFI_PROVIDED_USER_ID,
            currentRoomName: undefined,
            displayName: undefined,
            colorHex: undefined,
            motionStartTimestamp: undefined,
            positionStart: undefined,
            positionCurrent: undefined,
            positionTarget: undefined,
            orientationEuler: undefined,
            volumeDecibels: undefined,
            volumeDecibelsPeak: undefined,
            volumeThreshold: -60,
            hiFiGain: 1.0,
            hiFiGainSliderValue: "11",
            isMuted: false,
            echoCancellationEnabled: false,
            agcEnabled: false,
        };

        if (localStorage.getItem('myDisplayName')) {
            this.onMyDisplayNameChanged(localStorage.getItem('myDisplayName'));
        } else {
            this.onMyDisplayNameChanged(HIFI_PROVIDED_USER_ID);
        }
    }

    positionSelfInRoom(roomName: string) {
        if (this.myUserData.currentRoomName === roomName) {
            return;
        }

        this.myUserData.currentRoomName = roomName;

        let currentRoom = roomController.rooms.find((room) => {
            return room.name === this.myUserData.currentRoomName;
        });

        if (!currentRoom) {
            console.error(`\`positionSelfInRoom()\`: Couldn't determine current room!`);
            return;
        }
        
        console.log(`Positioning self in room ${currentRoom.name}...`);

        let newSeat = currentRoom.findOpenSpotForSelf();
        console.log(`Found an open spot in room ${currentRoom.name} at ${JSON.stringify(newSeat.position)} orientation ${JSON.stringify(newSeat.orientation)}.`);
        this.updateMyPositionAndOrientation(newSeat.position, newSeat.orientation.yawDegrees);
    }

    updateMyPositionAndOrientation(targetPosition?: Point3D, targetYawOrientationDegrees?: number) {
        let hifiCommunicator = connectionController.hifiCommunicator;
        if (!hifiCommunicator || !userDataController.myAvatar) {
            return;
        }

        let myUserData = userDataController.myAvatar.myUserData;

        let needToTransmit = false;
        let dataToTransmit: DataToTransmitToHiFi = {
            orientationEuler: undefined,
            position: undefined
        };

        if (!myUserData.orientationEuler) {
            myUserData.orientationEuler = new OrientationEuler3D();
        }

        if (typeof (targetYawOrientationDegrees) === "number") {
            myUserData.orientationEuler.yawDegrees = targetYawOrientationDegrees;
            dataToTransmit.orientationEuler = new OrientationEuler3D();
            Object.assign(dataToTransmit.orientationEuler, myUserData.orientationEuler);
            needToTransmit = true;
        }

        if (targetPosition) {
            if (!myUserData.positionTarget) {
                myUserData.positionTarget = new Point3D();
            }
            Object.assign(myUserData.positionTarget, targetPosition);

            if (!myUserData.positionStart) {
                myUserData.positionStart = new Point3D();
            }
            if (myUserData.positionCurrent) {
                Object.assign(myUserData.positionStart, myUserData.positionCurrent);
            } else {
                Object.assign(myUserData.positionStart, targetPosition);
            }

            let targetRoom = roomController.getRoomFromPoint3DInsideBoundaries(targetPosition);

            if (targetRoom) {
                this.myUserData.currentRoomName = targetRoom.name;
            } else {
                console.error("\`updateMyPositionAndOrientation()\`: Couldn't determine current room!");
            }

            roomController.updateAllRoomSeats();
            physicsController.autoComputePXPerMFromRoom(targetRoom);
        }

        if (needToTransmit) {
            hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);
        }
    }

    onMyDisplayNameChanged(newDisplayName?: string) {
        localStorage.setItem('myDisplayName', newDisplayName);
        this.myUserData.displayName = newDisplayName;
        connectionController.webSocketConnectionController.updateMyUserDataOnWebSocketServer();
        try {
            roomController.updateRoomList();
        } catch (e) { } 
    }
}

export class UserDataController {
    allOtherUserData: Array<UserData>;
    myAvatar: MyAvatar;

    constructor() {
        this.allOtherUserData = [];
        this.myAvatar = new MyAvatar();
    }
}

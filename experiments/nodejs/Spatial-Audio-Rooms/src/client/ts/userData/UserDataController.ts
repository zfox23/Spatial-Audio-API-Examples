import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { userDataController, connectionController, uiController, roomController } from "..";
import { CLOSE_ENOUGH_M } from "../constants/constants";

export interface UserData {
    visitIDHash?: string;
    currentRoomName?: string;
    displayName?: string;
    colorHex?: string;
    position?: Point3D;
    orientationEuler?: OrientationEuler3D;
    volumeDecibels?: number;
    volumeDecibelsPeak?: number;
    hiFiGain?: number;
    volumeThreshold?: number;
    isMuted?: boolean;
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
            currentRoomName: roomController.lobby.name,
            displayName: undefined,
            colorHex: undefined,
            position: undefined,
            orientationEuler: undefined,
            volumeDecibels: undefined,
            volumeDecibelsPeak: undefined,
            hiFiGain: undefined,
            volumeThreshold: undefined,
            isMuted: false,
        };
    }

    positionSelfInRoom() {
        let currentRoom = roomController.rooms.find((room) => {
            return room.name === this.myUserData.currentRoomName;
        });

        if (!currentRoom) {
            console.error(`Couldn't determine current room!`);
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

        if (!myUserData.position) {
            myUserData.position = new Point3D();
        }

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
            Object.assign(myUserData.position, targetPosition);
            dataToTransmit.position = new Point3D();
            Object.assign(dataToTransmit.position, myUserData.position);
            needToTransmit = true;

            uiController.canvasRenderer.canvasRotationDegrees = Math.atan2(-myUserData.position.x, -myUserData.position.z) * 180 / Math.PI;
            
            roomController.updateAllRoomSeats();
        }

        if (needToTransmit) {
            hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);
        }
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

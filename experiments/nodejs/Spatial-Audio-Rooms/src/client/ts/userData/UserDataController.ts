import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { userDataController, connectionController, roomController, physicsController, pathsController } from "..";
import { DataToTransmitToHiFi } from "../utilities/Utilities";

declare var HIFI_PROVIDED_USER_ID: string;

interface TempUserData {
    circleRadius?: number;
    startTheta?: number;
    targetTheta?: number;
}

export interface UserData {
    visitIDHash?: string;
    providedUserID?: string;
    currentRoomName?: string;
    displayName?: string;
    colorHex?: string;
    motionStartTimestamp?: number;
    positionCircleCenter?: Point3D;
    positionStart?: Point3D;
    positionCurrent?: Point3D;
    positionTarget?: Point3D;
    orientationEulerStart?: OrientationEuler3D;
    orientationEulerCurrent?: OrientationEuler3D;
    orientationEulerTarget?: OrientationEuler3D;
    volumeDecibels?: number;
    volumeDecibelsPeak?: number;
    hiFiGain?: number;
    hiFiGainSliderValue?: string;
    volumeThreshold?: number;
    isMuted?: boolean;
    echoCancellationEnabled?: boolean;
    agcEnabled?: boolean;
    tempData?: TempUserData;
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
            positionCircleCenter: undefined,
            positionStart: undefined,
            positionCurrent: undefined,
            positionTarget: undefined,
            orientationEulerStart: undefined,
            orientationEulerCurrent: undefined,
            orientationEulerTarget: undefined,
            volumeDecibels: undefined,
            volumeDecibelsPeak: undefined,
            volumeThreshold: -60,
            hiFiGain: 1.0,
            hiFiGainSliderValue: "11",
            isMuted: false,
            echoCancellationEnabled: false,
            agcEnabled: false,
            tempData: {},
        };

        if (localStorage.getItem('myDisplayName')) {
            this.onMyDisplayNameChanged(localStorage.getItem('myDisplayName'));
        } else {
            this.onMyDisplayNameChanged(HIFI_PROVIDED_USER_ID);
        }
    }

    positionSelfInRoom(targetRoomName: string) {
        if (pathsController.currentPath) {
            return;
        }

        let currentRoom = roomController.rooms.find((room) => {
            return room.name === targetRoomName;
        });

        if (!currentRoom) {
            console.error(`\`positionSelfInRoom()\`: Couldn't determine current room!`);
            return;
        }
        
        console.log(`Positioning self in room ${currentRoom.name}...`);

        let newSeat = currentRoom.findOpenSpotForSelf();
        console.log(`Found an open spot in room ${currentRoom.name} at ${JSON.stringify(newSeat.position)} orientation ${JSON.stringify(newSeat.orientation)}.`);
        this.moveToNewSeat(newSeat.position, newSeat.orientation.yawDegrees);
    }

    moveToNewSeat(targetSeatPosition: Point3D, targetSeatYawOrientationDegrees: number) {
        if (pathsController.currentPath || !userDataController.myAvatar) {
            return;
        }

        let myUserData = userDataController.myAvatar.myUserData;
        let dataToTransmit: DataToTransmitToHiFi = {};

        myUserData.motionStartTimestamp = undefined;

        // We enter this case if this is the first time we're moving to a new seat.
        if (!myUserData.positionCurrent) {
            myUserData.positionStart = undefined;
            myUserData.positionCurrent = new Point3D();
            Object.assign(myUserData.positionCurrent, targetSeatPosition);
            myUserData.positionTarget = undefined;
            
            dataToTransmit.position = myUserData.positionCurrent;
        }
        // We enter this case if this is the first time we're moving to a new seat.
        if (!myUserData.orientationEulerCurrent) {
            myUserData.orientationEulerStart = undefined;
            myUserData.orientationEulerCurrent = new OrientationEuler3D();
            myUserData.orientationEulerCurrent.yawDegrees = targetSeatYawOrientationDegrees;
            myUserData.orientationEulerTarget = undefined;

            dataToTransmit.orientationEuler = myUserData.orientationEulerCurrent;
        }
        if (dataToTransmit.position || dataToTransmit.orientationEuler) {
            let hifiCommunicator = connectionController.hifiCommunicator;
            if (hifiCommunicator) {
                hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);
            }
        }

        if (dataToTransmit.position || dataToTransmit.orientationEuler) {
            physicsController.autoComputePXPerMFromRoom(roomController.getRoomFromPoint3DInsideBoundaries(targetSeatPosition));
            roomController.updateAllRoomSeats();
            return;
        }

        if (!myUserData.positionStart) {
            myUserData.positionStart = new Point3D();
        }
        Object.assign(myUserData.positionStart, myUserData.positionCurrent);
        if (!myUserData.positionTarget) {
            myUserData.positionTarget = new Point3D();
        }
        Object.assign(myUserData.positionTarget, targetSeatPosition);

        if (!myUserData.orientationEulerStart) {
            myUserData.orientationEulerStart = new OrientationEuler3D();
        }
        Object.assign(myUserData.orientationEulerStart, myUserData.orientationEulerCurrent);
        if (!myUserData.orientationEulerTarget) {
            myUserData.orientationEulerTarget = new OrientationEuler3D();
        }
        myUserData.orientationEulerTarget.yawDegrees = targetSeatYawOrientationDegrees;
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

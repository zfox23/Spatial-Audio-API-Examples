import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { userDataController, connectionController, roomController, physicsController, pathsController } from "..";
import { Path, Waypoint } from "../ai/PathsController";
import { DataToTransmitToHiFi, Utilities } from "../utilities/Utilities";

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
        if (!userDataController.myAvatar) {
            console.warn(`Can't move to new seat - \`userDataController.myAvatar\` is falsey!`);
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

        let shouldTransmit = dataToTransmit.position || dataToTransmit.orientationEuler;

        if (shouldTransmit) {
            let hifiCommunicator = connectionController.hifiCommunicator;
            if (hifiCommunicator) {
                hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);
            } else {
                console.warn(`\`moveToNewSeat()\`: Couldn't transmit user data!`);
            }

            roomController.updateAllRoomSeats();
        }
        
        let currentRoom = roomController.getRoomFromPoint3DInsideBoundaries(myUserData.positionCurrent);
        let targetRoom = roomController.getRoomFromPoint3DOnCircle(targetSeatPosition);

        if (shouldTransmit || currentRoom !== targetRoom) {
            physicsController.autoComputePXPerMFromRoom(targetRoom);
        }

        if (!shouldTransmit) {
            if (pathsController.currentPath) {
                pathsController.resetCurrentPath();
            }

            let transitionCircleCenter;
            if (currentRoom === targetRoom) {
                transitionCircleCenter = new Point3D({x: currentRoom.center.x, z: currentRoom.center.z});
            } 

            let newPath = new Path();
            newPath.pathWaypoints.push(new Waypoint({
                positionStart: new Point3D({x: myUserData.positionCurrent.x, z: myUserData.positionCurrent.z}),
                positionTarget: new Point3D({x: targetSeatPosition.x, z: targetSeatPosition.z}),
                positionCircleCenter: transitionCircleCenter,
                orientationEulerStart: new OrientationEuler3D({yawDegrees: myUserData.orientationEulerCurrent.yawDegrees}),
                orientationEulerTarget: new OrientationEuler3D({yawDegrees: targetSeatYawOrientationDegrees}),
                durationMS: 2000,
                easingFunction: Utilities.easeLinear
            }));
            pathsController.setCurrentPath(newPath);
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

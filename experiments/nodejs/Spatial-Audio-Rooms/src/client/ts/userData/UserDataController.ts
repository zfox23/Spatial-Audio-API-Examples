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
    rotationStartTimestamp?: number;
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
            rotationStartTimestamp: undefined,
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
        };

        if (localStorage.getItem('myDisplayName')) {
            this.onMyDisplayNameChanged(localStorage.getItem('myDisplayName'));
        } else {
            this.onMyDisplayNameChanged(HIFI_PROVIDED_USER_ID);
        }
    }

    positionSelfInRoom(roomName: string) {
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

    updateMyPositionAndOrientation(targetPosition?: Point3D, targetYawOrientationDegrees?: number, forceOrientation: boolean = false) {
        let hifiCommunicator = connectionController.hifiCommunicator;
        if (!hifiCommunicator || !userDataController.myAvatar) {
            return;
        }

        let myUserData = userDataController.myAvatar.myUserData;
        
        let mustTransmit = false;
        let dataToTransmit: DataToTransmitToHiFi = {};
        
        if (targetPosition) {
            myUserData.motionStartTimestamp = undefined;

            if (!myUserData.positionCurrent) {
                myUserData.positionStart = undefined;
                myUserData.positionCurrent = new Point3D();
                Object.assign(myUserData.positionCurrent, targetPosition);
                myUserData.positionTarget = undefined;
                
                dataToTransmit.position = myUserData.positionCurrent;
            } else {
                if (!myUserData.positionStart) {
                    myUserData.positionStart = new Point3D();
                }
                Object.assign(myUserData.positionStart, myUserData.positionCurrent);

                if (!myUserData.positionTarget) {
                    myUserData.positionTarget = new Point3D();
                }
                Object.assign(myUserData.positionTarget, targetPosition);
                
                dataToTransmit.position = myUserData.positionTarget;
            }

            mustTransmit = true;

            let targetRoom = roomController.getRoomFromPoint3DInsideBoundaries(targetPosition);

            if (targetRoom) {
                this.myUserData.currentRoomName = targetRoom.name;
            } else {
                console.error("\`updateMyPositionAndOrientation()\`: Couldn't determine current room!");
            }

            roomController.updateAllRoomSeats();
            physicsController.autoComputePXPerMFromRoom(targetRoom);
        }

        if (typeof (targetYawOrientationDegrees) === "number") {
            myUserData.rotationStartTimestamp = undefined;

            if (forceOrientation || !myUserData.orientationEulerCurrent) {
                if (!myUserData.orientationEulerCurrent) {
                    myUserData.orientationEulerCurrent = new OrientationEuler3D();
                }
                
                myUserData.orientationEulerStart = undefined;
                myUserData.orientationEulerCurrent.yawDegrees = targetYawOrientationDegrees;
                myUserData.orientationEulerTarget = undefined;

                if (forceOrientation) {
                    dataToTransmit.orientationEuler = myUserData.orientationEulerCurrent;
                    mustTransmit = true;
                }
            } else if (myUserData.orientationEulerCurrent) {
                if (!myUserData.orientationEulerStart) {
                    myUserData.orientationEulerStart = new OrientationEuler3D();
                }
                Object.assign(myUserData.orientationEulerStart, myUserData.orientationEulerCurrent);

                if (!myUserData.orientationEulerTarget) {
                    myUserData.orientationEulerTarget = new OrientationEuler3D();
                }
                myUserData.orientationEulerTarget.yawDegrees = targetYawOrientationDegrees;
                
                dataToTransmit.orientationEuler = myUserData.orientationEulerTarget;
                mustTransmit = true;
            }
        }

        if (mustTransmit) {
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

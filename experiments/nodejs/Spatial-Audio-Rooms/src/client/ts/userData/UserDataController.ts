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
        }

        let allOtherUserData = userDataController.allOtherUserData;

        console.log(`${allOtherUserData.length} other user(s) present.`);

        let foundOpenSpot = false;
        let numSeatsInRoom = 2;
        let positionsChecked = Array<Point3D>();
        while (!foundOpenSpot) {
            for (let theta = 0; theta < 2 * Math.PI; theta += ((2 * Math.PI) / numSeatsInRoom)) {
                let currentPotentialPosition = {
                    "x": currentRoom.seatingRadius * Math.cos(theta) + currentRoom.center.x,
                    "y": 0,
                    "z": currentRoom.seatingRadius * Math.sin(theta) + currentRoom.center.z
                };

                currentPotentialPosition.x = Math.round((currentPotentialPosition.x + Number.EPSILON) * 100) / 100;
                currentPotentialPosition.z = Math.round((currentPotentialPosition.z + Number.EPSILON) * 100) / 100;

                if (positionsChecked.find((position) => { return currentPotentialPosition.x === position.x && currentPotentialPosition.z === position.z; })) {
                    continue;
                }

                let occupied = allOtherUserData.find((element) => { return element.position && Math.abs(element.position.x - currentPotentialPosition.x) < CLOSE_ENOUGH_M && Math.abs(element.position.z - currentPotentialPosition.z) < CLOSE_ENOUGH_M; });

                if (!occupied) {
                    let orientationYawRadians = Math.atan2(currentPotentialPosition.x, currentPotentialPosition.z);
                    let orientationYawDegrees = orientationYawRadians * 180 / Math.PI;
                    orientationYawDegrees %= 360;
                    let computedYawOrientationDegrees = Math.round((orientationYawDegrees + Number.EPSILON) * 100) / 100;
                    console.log(`Found an open spot in room ${currentRoom.name} at ${JSON.stringify(currentPotentialPosition)} with yaw orientation ${JSON.stringify(computedYawOrientationDegrees)} degrees.`);
                    this.updateMyPositionAndOrientation(currentPotentialPosition, computedYawOrientationDegrees);
                    foundOpenSpot = true;
                    currentRoom.updateSeats(numSeatsInRoom);
                    break;
                } else {
                    positionsChecked.push(currentPotentialPosition);
                }
            }

            numSeatsInRoom *= 2;
        }
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

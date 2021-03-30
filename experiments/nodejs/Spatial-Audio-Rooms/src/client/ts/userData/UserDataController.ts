import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { userDataController, connectionController, uiController } from "..";
import { ROOM_SEATING_RADIUS_M, CLOSE_ENOUGH_M } from "../constants/constants";

export interface UserData {
    visitIDHash?: string;
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

    positionSelfInCrowd() {
        let allLocalUserData = userDataController.allOtherUserData;

        console.log(`${allLocalUserData.length} other user(s) present, excluding ourselves.`);

        let foundOpenSpot = false;
        let currentCircleDivisions = 1;
        let positionsChecked = Array<Point3D>();
        while (!foundOpenSpot) {
            for (let theta = 0; theta < 2 * Math.PI; theta += ((2 * Math.PI) / currentCircleDivisions)) {
                let currentPotentialPosition = {
                    "x": (ROOM_SEATING_RADIUS_M) * Math.cos(theta),
                    "y": 0,
                    "z": (ROOM_SEATING_RADIUS_M) * Math.sin(theta)
                };

                currentPotentialPosition.x = Math.round((currentPotentialPosition.x + Number.EPSILON) * 100) / 100;
                currentPotentialPosition.z = Math.round((currentPotentialPosition.z + Number.EPSILON) * 100) / 100;

                if (positionsChecked.find((position) => { return currentPotentialPosition.x === position.x && currentPotentialPosition.z === position.z; })) {
                    continue;
                }

                let occupied = allLocalUserData.find((element) => { return element.position && Math.abs(element.position.x - currentPotentialPosition.x) < CLOSE_ENOUGH_M && Math.abs(element.position.z - currentPotentialPosition.z) < CLOSE_ENOUGH_M; });

                if (!occupied) {
                    let orientationYawRadians = Math.atan2(currentPotentialPosition.x, currentPotentialPosition.z);
                    let orientationYawDegrees = orientationYawRadians * 180 / Math.PI;
                    orientationYawDegrees %= 360;
                    let computedYawOrientationDegrees = Math.round((orientationYawDegrees + Number.EPSILON) * 100) / 100;
                    console.log(`Found an open spot at ${JSON.stringify(currentPotentialPosition)} with yaw orientation ${JSON.stringify(computedYawOrientationDegrees)} degrees.`);
                    this.updateMyPositionAndOrientation(currentPotentialPosition, computedYawOrientationDegrees);
                    foundOpenSpot = true;
                    break;
                } else {
                    positionsChecked.push(currentPotentialPosition);
                }
            }

            currentCircleDivisions *= 2;
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

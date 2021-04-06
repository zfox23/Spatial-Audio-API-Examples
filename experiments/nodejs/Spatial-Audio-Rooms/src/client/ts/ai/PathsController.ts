import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { connectionController, pathsController, userDataController } from "..";
import { DataToTransmitToHiFi } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";

export class Waypoint {
    positionStart: Point3D;
    positionTarget: Point3D;
    orientationEulerStart: OrientationEuler3D;
    orientationEulerTarget: OrientationEuler3D;
    durationMS: number;
    easingFunction: (progressFraction: number) => number;

    constructor({positionStart, positionTarget, orientationEulerStart, orientationEulerTarget, durationMS, easingFunction = Utilities.easeInOutQuart}: {positionStart: Point3D, positionTarget: Point3D, orientationEulerStart: OrientationEuler3D, orientationEulerTarget: OrientationEuler3D, durationMS: number, easingFunction?: (progressFraction: number) => number}) {
        this.positionStart = positionStart;
        this.positionTarget = positionTarget;
        this.orientationEulerStart = orientationEulerStart;
        this.orientationEulerTarget = orientationEulerTarget;
        this.durationMS = durationMS;
        this.easingFunction = easingFunction;
    }
}

export class Path {
    pathWaypoints: Array<Waypoint>;
    currentWaypointIndex: number;
    repeats: boolean = false;

    constructor() {
        this.pathWaypoints = [];
        this.currentWaypointIndex = -1;
    }

    incrementWaypointIndex() {
        if (this.pathWaypoints.length - 1 > this.currentWaypointIndex) {
            this.currentWaypointIndex++;
        } else if (this.repeats) {
            this.currentWaypointIndex = 0;
        } else {
            pathsController.resetCurrentPath();
        }


        let hifiCommunicator = connectionController.hifiCommunicator;
        if (!hifiCommunicator) {
            return;
        }

        let dataToTransmit: DataToTransmitToHiFi = {};
        
        dataToTransmit.position = this.pathWaypoints[this.currentWaypointIndex].positionTarget;
        dataToTransmit.orientationEuler = this.pathWaypoints[this.currentWaypointIndex].orientationEulerTarget;

        hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);
    }
}

export class PathsController {
    currentPath: Path;

    constructor() {
        this.currentPath = undefined;
    }

    setCurrentPath(newPath: Path) {
        this.currentPath = newPath;
        this.currentPath.incrementWaypointIndex();
        userDataController.myAvatar.myUserData.motionStartTimestamp = undefined;
    }

    resetCurrentPath() {
        this.currentPath.currentWaypointIndex = -1;
        this.currentPath = undefined;
    }
}
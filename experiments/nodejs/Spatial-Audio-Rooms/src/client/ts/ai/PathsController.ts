import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { pathsController, userDataController } from "..";
import { EasingFunctions } from "../utilities/Utilities";

export class Waypoint {
    positionStart: Point3D;
    positionTarget: Point3D;
    positionCircleCenter?: Point3D;
    orientationEulerStart: OrientationEuler3D;
    orientationEulerTarget: OrientationEuler3D;
    durationMS: number;
    easingFunction?: (progressFraction: number) => number;

    constructor({positionStart, positionTarget, positionCircleCenter, orientationEulerStart, orientationEulerTarget, durationMS, easingFunction = EasingFunctions.easeInOutQuart}: {positionStart: Point3D, positionTarget: Point3D, positionCircleCenter?: Point3D, orientationEulerStart: OrientationEuler3D, orientationEulerTarget: OrientationEuler3D, durationMS: number, easingFunction?: (progressFraction: number) => number}) {
        this.positionStart = positionStart;
        this.positionTarget = positionTarget;
        this.positionCircleCenter = positionCircleCenter;
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
    onActivated?: () => void;
    onDeactivated?: () => void;

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
            return;
        }
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

        if (this.currentPath.onActivated) {
            this.currentPath.onActivated();
        }
    }

    resetCurrentPath() {
        if (this.currentPath) {
            this.currentPath.currentWaypointIndex = -1;
        }

        if (this.currentPath.onDeactivated) {
            this.currentPath.onDeactivated();
        }

        this.currentPath = undefined;
    }
}
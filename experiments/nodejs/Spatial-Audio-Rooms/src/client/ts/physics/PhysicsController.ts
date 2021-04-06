import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { connectionController, pathsController, roomController, uiController, userDataController, userInputController } from "..";
import { AVATAR, PHYSICS } from "../constants/constants";
import { SpatialAudioRoom } from "../ui/RoomController";
import { Utilities, DataToTransmitToHiFi } from "../utilities/Utilities";

export class PhysicsController {
    mainCanvas: HTMLCanvasElement;
    lastNow: number = 0;

    pxPerMStart: number;
    pxPerMCurrent: number;
    pxPerMTarget: number;

    onWheelTimestampDeltaMS: number;

    smoothZoomDurationMS: number = PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS;
    smoothZoomStartTimestamp: number;

    constructor() {
        setInterval(this.physicsLoop.bind(this), PHYSICS.PHYSICS_TICKRATE_MS);
        this.mainCanvas = document.querySelector('.mainCanvas');
    }

    physicsLoop() {
        let now = performance.now();
        let dt = now - this.lastNow;
        this.lastNow = now;

        this.computeAvatarPositionsAndOrientations(now);
        this.computePXPerM(now);
    }

    computeAvatarPositionsAndOrientations(timestamp: number) {
        let hifiCommunicator = connectionController.hifiCommunicator;
        if (!hifiCommunicator || !userDataController.myAvatar) {
            return;
        }
        
        let mustTransmit = false;
        let dataToTransmit: DataToTransmitToHiFi = {};

        let otherAvatarMoved = false;
        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        allUserData.forEach((userData) => {
            let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;
            let easingFunction = isMine ? Utilities.easeOutQuad : Utilities.easeLinear;
            let motionDurationMS = isMine ? PHYSICS.POSITION_TWEENING_DURATION_MS : PHYSICS.PHYSICS_TICKRATE_MS;

            if (isMine && pathsController.currentPath) {
                let waypoint = pathsController.currentPath.pathWaypoints[pathsController.currentPath.currentWaypointIndex];
                userData.positionCircleCenter = waypoint.positionCircleCenter;
                userData.positionStart = waypoint.positionStart;
                userData.positionTarget = waypoint.positionTarget;
                userData.orientationEulerStart = waypoint.orientationEulerStart;
                userData.orientationEulerTarget = waypoint.orientationEulerTarget;
                motionDurationMS = waypoint.durationMS;
                easingFunction = waypoint.easingFunction;

                if (pathsController.currentPath.currentWaypointIndex === 0) {
                    if (!userData.positionCurrent) {
                        userData.positionCurrent = new Point3D();
                    }
                    Object.assign(userData.positionCurrent, userData.positionStart);
                    if (!userData.orientationEulerCurrent) {
                        userData.orientationEulerCurrent = new OrientationEuler3D();
                    }
                    Object.assign(userData.orientationEulerCurrent, userData.orientationEulerStart);
                }
            }

            if ((userData.positionTarget || userData.orientationEulerTarget) && !userData.motionStartTimestamp) {
                userData.motionStartTimestamp = timestamp;

                if (isMine && !pathsController.currentPath && userData.positionTarget) {
                    this.smoothZoomDurationMS = motionDurationMS;
                }
            }

            if (userData.motionStartTimestamp && (timestamp - userData.motionStartTimestamp) > motionDurationMS) {
                if (userData.positionTarget) {
                    if (!userData.positionCurrent) {
                        userData.positionCurrent = new Point3D();
                    }
                    Object.assign(userData.positionCurrent, userData.positionTarget);

                    if (!isMine) {
                        otherAvatarMoved = true;
                    }
                }
                userData.positionCircleCenter = undefined;
                userData.positionStart = undefined;
                userData.positionTarget = undefined;
                
                if (userData.orientationEulerTarget) {
                    if (!userData.orientationEulerCurrent) {
                        userData.orientationEulerCurrent = new OrientationEuler3D();
                    }
                    Object.assign(userData.orientationEulerCurrent, userData.orientationEulerTarget);
                }
                userData.orientationEulerStart = undefined;
                userData.orientationEulerTarget = undefined;

                userData.motionStartTimestamp = undefined;
                userData.tempData.circleRadius = undefined;
                userData.tempData.startTheta = undefined;
                userData.tempData.targetTheta = undefined;

                if (isMine && pathsController.currentPath) {
                    pathsController.currentPath.incrementWaypointIndex();
                }
                
                if (isMine) {
                    dataToTransmit.position = userData.positionCurrent;
                    dataToTransmit.orientationEuler = userData.orientationEulerCurrent;
                    mustTransmit = true;
                }
            } else if (userData.motionStartTimestamp) {
                if (userData.positionStart && userData.positionTarget) {
                    let newPosition;
                    if (userData.positionCircleCenter) {
                        if (!userData.tempData.circleRadius) {
                            userData.tempData.circleRadius = Utilities.getDistanceBetween2DPoints(userData.positionCircleCenter.x, userData.positionCircleCenter.z, userData.positionStart.x, userData.positionStart.z);
                        }
                        if (!userData.tempData.startTheta) {
                            userData.tempData.startTheta = Math.atan2(userData.positionStart.x - userData.positionCircleCenter.x, userData.positionStart.z - userData.positionCircleCenter.z);
                        }
                        if (!userData.tempData.targetTheta) {
                            userData.tempData.targetTheta = Math.atan2(userData.positionTarget.x - userData.positionCircleCenter.x, userData.positionTarget.z - userData.positionCircleCenter.z);
                        }
                        newPosition = new Point3D({
                            "x": userData.tempData.circleRadius * Math.cos(Utilities.linearScale(easingFunction((timestamp - userData.motionStartTimestamp) / motionDurationMS), 0, 1, userData.tempData.startTheta, userData.tempData.targetTheta)) + userData.positionCircleCenter.x,
                            "z": userData.tempData.circleRadius * Math.sin(Utilities.linearScale(easingFunction((timestamp - userData.motionStartTimestamp) / motionDurationMS), 0, 1, userData.tempData.startTheta, userData.tempData.targetTheta)) + userData.positionCircleCenter.z
                        });
                    } else {
                        newPosition = new Point3D({
                            x: Utilities.linearScale(easingFunction((timestamp - userData.motionStartTimestamp) / motionDurationMS), 0, 1, userData.positionStart.x, userData.positionTarget.x),
                            z: Utilities.linearScale(easingFunction((timestamp - userData.motionStartTimestamp) / motionDurationMS), 0, 1, userData.positionStart.z, userData.positionTarget.z),
                        });
                    }
                    if (!userData.positionCurrent) {
                        userData.positionCurrent = new Point3D();
                    }
                    Object.assign(userData.positionCurrent, newPosition);

                    if (!isMine) {
                        otherAvatarMoved = true;
                    } else {
                        dataToTransmit.position = userData.positionCurrent;
                        mustTransmit = true;
                    }
                }

                if (userData.orientationEulerStart && userData.orientationEulerTarget) {
                    let startYawDegrees = userData.orientationEulerStart.yawDegrees;
                    let targetYawDegrees = userData.orientationEulerTarget.yawDegrees;

                    // Get start and target angles within 180 degrees of each other to prevent
                    // over-rotation during animation.
                    while (targetYawDegrees - startYawDegrees > 180) {
                        startYawDegrees += 360;
                    }
                    while (targetYawDegrees - startYawDegrees < -180) {
                        startYawDegrees -= 360;
                    }

                    let newOrientationEuler = new OrientationEuler3D({
                        yawDegrees: Utilities.linearScale(easingFunction((timestamp - userData.motionStartTimestamp) / motionDurationMS), 0, 1, startYawDegrees, targetYawDegrees),
                    });
                    if (!userData.orientationEulerCurrent) {
                        userData.orientationEulerCurrent = new OrientationEuler3D();
                    }
                    Object.assign(userData.orientationEulerCurrent, newOrientationEuler);

                    if (isMine) {
                        dataToTransmit.orientationEuler = userData.orientationEulerCurrent;
                        mustTransmit = true;
                    }
                }
            }

            if (isMine && mustTransmit) {
                hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);
            }
        });

        if (otherAvatarMoved) {
            roomController.updateAllRoomSeats();
        }
    }

    autoComputePXPerMFromRoom(room: SpatialAudioRoom) {
        if (!room) {
            return;
        }

        this.smoothZoomDurationMS = PHYSICS.SMOOTH_ZOOM_DURATION_SWITCH_ROOMS_MS;
        this.smoothZoomStartTimestamp = undefined;
        this.pxPerMTarget = Math.min(this.mainCanvas.width, this.mainCanvas.height) / (2 * room.seatingRadiusM + 3 * AVATAR.RADIUS_M);
    }

    computePXPerM(timestamp: number) {
        if (!this.pxPerMTarget) {
            return;
        }

        this.pxPerMTarget = Utilities.clamp(this.pxPerMTarget, PHYSICS.MIN_PX_PER_M, PHYSICS.MAX_PX_PER_M);

        if (!this.smoothZoomStartTimestamp) {
            this.smoothZoomStartTimestamp = timestamp;
            this.pxPerMStart = this.pxPerMCurrent;
        }

        let slam = false;
        if ((!this.onWheelTimestampDeltaMS || this.onWheelTimestampDeltaMS >= PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS) &&
            this.pxPerMTarget &&
            this.pxPerMStart &&
            (this.pxPerMTarget !== this.pxPerMStart)) {
            this.pxPerMCurrent = Utilities.linearScale(Utilities.easeOutExponential((timestamp - this.smoothZoomStartTimestamp) / this.smoothZoomDurationMS), 0, 1, this.pxPerMStart, this.pxPerMTarget);
        } else {
            slam = true;
        }

        if (slam || (this.smoothZoomStartTimestamp && (timestamp > (this.smoothZoomStartTimestamp + this.smoothZoomDurationMS)))) {
            this.pxPerMCurrent = this.pxPerMTarget;
            this.pxPerMTarget = undefined;
            this.pxPerMStart = undefined;
            this.onWheelTimestampDeltaMS = undefined;
            this.smoothZoomStartTimestamp = undefined;
            this.smoothZoomDurationMS = PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS;
        }

        uiController.canvasRenderer.updateCanvasParams();
    }
}

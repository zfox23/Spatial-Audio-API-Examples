import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { connectionController, localSoundsController, particleController, pathsController, roomController, uiController, userDataController, userInputController } from "..";
import { PHYSICS, UI, ROOM, CONTROLS, TIME } from "../constants/constants";
import { SpatialAudioRoom } from "../ui/RoomController";
import { Utilities, DataToTransmitToHiFi, EasingFunctions } from "../utilities/Utilities";

export class PhysicsController {
    normalModeCanvas: HTMLCanvasElement;
    lastNow: number = 0;

    pxPerMMin: number = PHYSICS.MIN_PX_PER_M;
    pxPerMMax: number = PHYSICS.MAX_PX_PER_M;
    pxPerMStart: number;
    pxPerMCurrent: number;
    pxPerMTarget: number;

    smoothZoomDurationMS: number = PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS;
    smoothZoomStartTimestamp: number;

    constructor() {
        setInterval(this.physicsLoop.bind(this), PHYSICS.PHYSICS_TICKRATE_MS);
        this.normalModeCanvas = document.querySelector('.normalModeCanvas');
    }

    physicsLoop() {
        let now = performance.now();
        let dt = now - this.lastNow;
        this.lastNow = now;

        this.computeAvatarPositionsAndOrientations(now, dt);
        particleController.updateAllParticles(now, dt);
        this.computePXPerM(now);
    }

    computeAvatarPositionsAndOrientations(timestamp: number, deltaTimestampMS: number) {
        let hifiCommunicator = connectionController.hifiCommunicator;
        if (!hifiCommunicator || !userDataController.myAvatar) {
            return;
        }
        
        let mustTransmit = false;
        let dataToTransmit: DataToTransmitToHiFi = {};

        let myAvatarMoved = false;
        let otherAvatarMoved = false;
        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        allUserData.forEach((userData) => {
            let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;
            let easingFunction = isMine ? EasingFunctions.easeOutQuad : EasingFunctions.easeLinear;
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

                    if (isMine) {
                        myAvatarMoved = true;
                    } else {
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
                userData.tempData.willMoveClockwise = undefined;

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
                        if (userData.tempData.circleRadius === undefined || userData.tempData.startTheta === undefined || userData.tempData.targetTheta === undefined) {
                            userData.tempData.circleRadius = Utilities.getDistanceBetween2DPoints(userData.positionCircleCenter.x, userData.positionCircleCenter.z, userData.positionStart.x, userData.positionStart.z);

                            userData.tempData.startTheta = Math.atan2(userData.positionStart.z - userData.positionCircleCenter.z, userData.positionStart.x - userData.positionCircleCenter.x);

                            userData.tempData.targetTheta = Math.atan2(userData.positionTarget.z - userData.positionCircleCenter.z, userData.positionTarget.x - userData.positionCircleCenter.x);

                            // This logic below ensures that the `targetTheta` is always within 180 degrees of the `startTheta`.
                            userData.tempData.startTheta %= (Math.PI * 2);
                            userData.tempData.targetTheta %= (Math.PI * 2);
                            if (Math.abs(userData.tempData.targetTheta - userData.tempData.startTheta) > Math.PI) {
                                if (userData.tempData.startTheta < userData.tempData.targetTheta) {
                                    userData.tempData.targetTheta -= 2 * Math.PI;
                                } else if (userData.tempData.startTheta > userData.tempData.targetTheta) {
                                    userData.tempData.targetTheta += 2 * Math.PI;
                                }
                            }

                            userData.tempData.willMoveClockwise = userData.tempData.targetTheta > userData.tempData.startTheta;
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

                    if (isMine) {
                        dataToTransmit.position = userData.positionCurrent;
                        myAvatarMoved = true;
                        mustTransmit = true;
                    } else {
                        otherAvatarMoved = true;
                    }
                }

                if (userData.orientationEulerStart && userData.orientationEulerTarget) {
                    let startYawDegrees = userData.orientationEulerStart.yawDegrees;

                    let targetYawDegrees = userData.orientationEulerTarget.yawDegrees;

                    // This logic below ensures that the `targetYawDegrees` is always within 180 degrees of the `startYawDegrees`.
                    startYawDegrees %= 360;
                    targetYawDegrees %= 360;
                    if (Math.abs(targetYawDegrees - startYawDegrees) > 180) {
                        if (startYawDegrees < targetYawDegrees) {
                            targetYawDegrees -= 360;
                        } else if (startYawDegrees > targetYawDegrees) {
                            targetYawDegrees += 360;
                        }
                    }
                    let willRotateClockwise = targetYawDegrees > startYawDegrees;

                    // We always need to be rotating the opposite direction from the direction on which we are rotating around the circle.
                    if (userData.tempData.willMoveClockwise !== undefined && (userData.tempData.willMoveClockwise === willRotateClockwise)) {
                        if (userData.tempData.willMoveClockwise) {
                            startYawDegrees += 360;
                        } else {
                            targetYawDegrees += 360;
                        }
                        willRotateClockwise = targetYawDegrees > startYawDegrees;
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
            } else if (isMine && userData.orientationEulerCurrent) {
                userDataController.myAvatar.setMyAvatarVelocity({ 
                    x: -userDataController.myAvatar.linearVelocityMPerS.right * Math.cos(-userData.orientationEulerCurrent.yawDegrees * Math.PI / 180) + userDataController.myAvatar.linearVelocityMPerS.forward * Math.sin(-userData.orientationEulerCurrent.yawDegrees * Math.PI / 180),
                    z: -userDataController.myAvatar.linearVelocityMPerS.right * Math.sin(-userData.orientationEulerCurrent.yawDegrees * Math.PI / 180) - userDataController.myAvatar.linearVelocityMPerS.forward * Math.cos(-userData.orientationEulerCurrent.yawDegrees * Math.PI / 180)
                }, PHYSICS.CHANGING_VELOCITY_UPDATE_TAU)
            }

            if (isMine) {
                let myVelocity = userDataController.myAvatar.linearVelocityMPerS;
                if (myVelocity.x || myVelocity.z) {
                    userDataController.myAvatar.clearCurrentSeat();
                    let newWorldPositionM = {
                        x: 0,
                        y: userDataController.myAvatar.myUserData.positionCurrent.y,
                        z: 0
                    };
                    newWorldPositionM.x = userDataController.myAvatar.myUserData.positionCurrent.x + (myVelocity.x * deltaTimestampMS / TIME.MS_PER_SEC);
                    newWorldPositionM.z = userDataController.myAvatar.myUserData.positionCurrent.z + (myVelocity.z * deltaTimestampMS / TIME.MS_PER_SEC);
                    userData.positionCurrent = newWorldPositionM;

                    dataToTransmit.position = userData.positionCurrent;
                    mustTransmit = true;
                }
                
                let myRotationalVelocity = userDataController.myAvatar.rotationalVelocityDegreesPerS;
                if (myRotationalVelocity && userDataController.myAvatar.myUserData.orientationEulerCurrent) {
                    let newYawOrientationDegrees = userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees + myRotationalVelocity * deltaTimestampMS / TIME.MS_PER_SEC;
                    userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees = newYawOrientationDegrees;
                    dataToTransmit.orientationEuler = userData.orientationEulerCurrent;
                    mustTransmit = true;
                }
            }

            if (isMine && mustTransmit) {
                hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);

                if (dataToTransmit.orientationEuler) {
                    localSoundsController.updateHowlerOrientation(userData.orientationEulerCurrent);
                }

                if (dataToTransmit.position) {
                    localSoundsController.onMyGlobalPositionChanged(userData.positionCurrent);
                }
            }
        });
    }

    autoComputePXPerMFromRoom(room: SpatialAudioRoom) {
        if (!room) {
            return;
        }

        this.smoothZoomDurationMS = PHYSICS.SMOOTH_ZOOM_DURATION_SWITCH_ROOMS_MS;
        this.smoothZoomStartTimestamp = undefined;
        // TODO: Change this to ensure that users can always see all rooms "nearby", instead of just 15m/2 away when fully zoomed out.
        this.pxPerMMin = Math.min(this.normalModeCanvas.width, this.normalModeCanvas.height) / 15;
        this.pxPerMTarget = Math.min(this.normalModeCanvas.width, this.normalModeCanvas.height) / (2 * room.seatingRadiusM + 2 * UI.AVATAR_PADDING_FOR_CAMERA);
        this.pxPerMMax = this.pxPerMTarget;
    }

    computePXPerM(timestamp: number) {
        if (!this.pxPerMTarget) {
            return;
        }

        this.pxPerMTarget = Utilities.clamp(this.pxPerMTarget, this.pxPerMMin, this.pxPerMMax);

        if (!this.smoothZoomStartTimestamp) {
            this.smoothZoomStartTimestamp = timestamp;
            this.pxPerMStart = this.pxPerMCurrent;
        }

        if (this.pxPerMTarget &&
            this.pxPerMStart &&
            this.pxPerMTarget !== this.pxPerMStart &&
            (timestamp <= (this.smoothZoomStartTimestamp + this.smoothZoomDurationMS))) {
            this.pxPerMCurrent = Utilities.linearScale(EasingFunctions.easeOutExponential((timestamp - this.smoothZoomStartTimestamp) / this.smoothZoomDurationMS), 0, 1, this.pxPerMStart, this.pxPerMTarget);
        } else {
            this.pxPerMCurrent = this.pxPerMTarget;
            this.pxPerMTarget = undefined;
            this.pxPerMStart = undefined;
            this.smoothZoomStartTimestamp = undefined;
            this.smoothZoomDurationMS = PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS;
        }

        this.determineZoomedOutTooFarToRenderSeats();
    }

    determineZoomedOutTooFarToRenderSeats() {
        let roomSeatRadiusPX = ROOM.SEAT_RADIUS_M * this.pxPerMCurrent;
        userInputController.zoomedOutTooFarToRenderSeats = roomSeatRadiusPX < UI.MIN_SEAT_RADIUS_FOR_SEAT_VISIBILITY_PX;
    }
}

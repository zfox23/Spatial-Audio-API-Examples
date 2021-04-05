import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { connectionController, roomController, uiController, userDataController, userInputController } from "..";
import { AVATAR, PHYSICS } from "../constants/constants";
import { SpatialAudioRoom } from "../ui/RoomController";
import { Utilities } from "../utilities/Utilities";

export class PhysicsController {
    mainCanvas: HTMLCanvasElement;
    lastNow: number = 0;

    pxPerMStart: number;
    pxPerMCurrent: number;
    pxPerMTarget: number;

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

        let otherAvatarMoved = false;
        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        allUserData.forEach((userData) => {
            let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;
            const easingFunction = Utilities.easeOutQuad;
	    
            // Position logic
            if (!userData.positionCurrent) {
                userData.positionCurrent = new Point3D();
            }
            if (userData.positionTarget && !userData.motionStartTimestamp) {
                userData.motionStartTimestamp = timestamp;

                if (isMine) {
                    this.smoothZoomDurationMS = PHYSICS.POSITION_TWEENING_DURATION_MS;
                }
            }
            if (userData.motionStartTimestamp && (timestamp - userData.motionStartTimestamp) > PHYSICS.POSITION_TWEENING_DURATION_MS) {
                if (userData.positionTarget) {
                    Object.assign(userData.positionCurrent, userData.positionTarget);

                    if (!isMine) {
                        otherAvatarMoved = true;
                    }
                }
                
                userData.positionStart = undefined;
                userData.positionTarget = undefined;

                userData.motionStartTimestamp = undefined;
            } else if (userData.motionStartTimestamp) {
                if (userData.positionStart && userData.positionTarget) {
                    let newPosition = new Point3D({
                        x: Utilities.linearScale(easingFunction((timestamp - userData.motionStartTimestamp) / PHYSICS.POSITION_TWEENING_DURATION_MS), 0, 1, userData.positionStart.x, userData.positionTarget.x),
                        z: Utilities.linearScale(easingFunction((timestamp - userData.motionStartTimestamp) / PHYSICS.POSITION_TWEENING_DURATION_MS), 0, 1, userData.positionStart.z, userData.positionTarget.z),
                    });
                    Object.assign(userData.positionCurrent, newPosition);

                    if (!isMine) {
                        otherAvatarMoved = true;
                    }
                }
            }

            // Orientation logic
            if (!userData.orientationEulerCurrent) {
                userData.orientationEulerCurrent = new OrientationEuler3D();
            }
            if (userData.orientationEulerTarget && !userData.rotationStartTimestamp) {
                userData.rotationStartTimestamp = timestamp;
            }
            if (userData.rotationStartTimestamp && (timestamp - userData.rotationStartTimestamp) > PHYSICS.POSITION_TWEENING_DURATION_MS) {
                if (userData.orientationEulerTarget) {
                    Object.assign(userData.orientationEulerCurrent, userData.orientationEulerTarget);
                }
                
                userData.orientationEulerStart = undefined;
                userData.orientationEulerTarget = undefined;

                userData.rotationStartTimestamp = undefined;
            } else if (userData.rotationStartTimestamp) {                
                if (userData.orientationEulerStart && userData.orientationEulerTarget) {
                    let newOrientationEuler = new OrientationEuler3D({
                        yawDegrees: Utilities.linearScale(easingFunction((timestamp - userData.rotationStartTimestamp) / PHYSICS.POSITION_TWEENING_DURATION_MS), 0, 1, userData.orientationEulerStart.yawDegrees, userData.orientationEulerTarget.yawDegrees),
                    });
                    Object.assign(userData.orientationEulerCurrent, newOrientationEuler);
                }
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

        this.pxPerMTarget = Math.min(this.mainCanvas.width, this.mainCanvas.height) / (2 * room.seatingRadiusM + 3 * AVATAR.RADIUS_M);
        this.smoothZoomDurationMS = PHYSICS.SMOOTH_ZOOM_DURATION_SWITCH_ROOMS_MS;
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

        if ((!userInputController.onWheelTimestampDeltaMS || userInputController.onWheelTimestampDeltaMS >= PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS) &&
            this.pxPerMTarget &&
            this.pxPerMStart &&
            (this.pxPerMTarget !== this.pxPerMStart)) {
            this.pxPerMCurrent = Utilities.linearScale(Utilities.easeOutExponential((timestamp - this.smoothZoomStartTimestamp) / this.smoothZoomDurationMS), 0, 1, this.pxPerMStart, this.pxPerMTarget);
        } else {
            this.pxPerMCurrent = this.pxPerMTarget;
            this.pxPerMTarget = undefined;
            this.pxPerMStart = undefined;
            this.smoothZoomStartTimestamp = undefined;
            this.smoothZoomDurationMS = PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS;
        }

        if (timestamp > (this.smoothZoomStartTimestamp + this.smoothZoomDurationMS)) {
            this.pxPerMCurrent = this.pxPerMTarget;
            this.pxPerMTarget = undefined;
            this.pxPerMStart = undefined;
            this.smoothZoomStartTimestamp = undefined;
            this.smoothZoomDurationMS = PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS;
        }

        uiController.canvasRenderer.updateCanvasParams();
    }
}

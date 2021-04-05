import { Point3D } from "hifi-spatial-audio";
import { connectionController, uiController, userDataController, userInputController } from "..";
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

        this.computePXPerM(now);
        this.computeAvatarPositions(now);
    }

    computeCurrentPosition({ timestamp, motionStartTimestamp, positionStart, positionTarget }: { timestamp: number, motionStartTimestamp: number, positionStart: Point3D, positionTarget: Point3D }) {
        // console.log((timestamp - motionStartTimestamp))
    }

    computeAvatarPositions(timestamp: number) {
        let hifiCommunicator = connectionController.hifiCommunicator;
        if (!hifiCommunicator || !userDataController.myAvatar) {
            return;
        }

        let myAvatarMoved = false;
        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        allUserData.forEach((userData) => {
            if (!(userData.positionStart && userData.positionTarget)) {
                return;
            }

            let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;

            if (isMine) {
                myAvatarMoved = true;
            }

            if (!userData.positionCurrent) {
                userData.positionCurrent = new Point3D();
            }

            if ((timestamp - userData.motionStartTimestamp) > PHYSICS.MOTION_TWEENING_DURATION_MS) {
                userData.positionStart = undefined;
                userData.positionTarget = undefined;
                userData.motionStartTimestamp = undefined;
                Object.assign(userData.positionCurrent, userData.positionTarget);
            } else {
                if (!userData.motionStartTimestamp) {
                    userData.motionStartTimestamp = timestamp;

                    if (isMine) {
                        this.smoothZoomDurationMS = PHYSICS.MOTION_TWEENING_DURATION_MS;
                    }
                }
        
                let newPosition = new Point3D({
                    x: Utilities.linearScale(Utilities.easeOutQuad((timestamp - userData.motionStartTimestamp) / PHYSICS.MOTION_TWEENING_DURATION_MS), 0, 1, userData.positionStart.x, userData.positionTarget.x),
                    z: Utilities.linearScale(Utilities.easeOutQuad((timestamp - userData.motionStartTimestamp) / PHYSICS.MOTION_TWEENING_DURATION_MS), 0, 1, userData.positionStart.z, userData.positionTarget.z),
                });
                Object.assign(userData.positionCurrent, newPosition);
            }
        });

        if (myAvatarMoved) {
            let dataToTransmit = {
                position: userDataController.myAvatar.myUserData.positionCurrent
            };
            hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);
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

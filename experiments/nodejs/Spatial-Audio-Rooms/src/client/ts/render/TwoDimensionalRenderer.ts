declare module '*.png';

import { particleController, physicsController, roomController, uiController, userDataController, userInputController, videoController } from "..";
import { AVATAR, PHYSICS, ROOM, UI, } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";
import { SpatialAudioSeat, SpatialAudioRoom } from "../ui/RoomController";
import SeatIconIdle from '../../images/seat-idle.png';
import SeatIconHover from '../../images/seat-hover.png';
import TableImage from '../../images/table.png';
import { Point3D } from "hifi-spatial-audio";

const seatIconIdle = new Image();
seatIconIdle.src = SeatIconIdle;
const seatIconHover = new Image();
seatIconHover.src = SeatIconHover;
const tableImage = new Image();
tableImage.src = TableImage;

export class TwoDimensionalRenderer {
    mainCanvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    cameraOffsetYPX: number;
    canvasOffsetPX: any;
    cameraPositionNoOffsetM: Point3D;
    canvasRotationDegrees: number = 0;
    canvasScrimOpacity: number = 0.0;

    constructor() {
        this.mainCanvas = document.createElement("canvas");
        this.mainCanvas.classList.add("mainCanvas");
        document.body.appendChild(this.mainCanvas);
        this.ctx = this.mainCanvas.getContext("2d");

        window.addEventListener("resize", this.updateCanvasDimensions.bind(this));
        this.updateCanvasDimensions();

        window.requestAnimationFrame(this.drawLoop.bind(this));
    }

    drawLoop() {
        this.draw();
        window.requestAnimationFrame(this.drawLoop.bind(this));
    }

    updateCanvasDimensions() {
        this.mainCanvas.width = window.innerWidth;
        this.mainCanvas.height = window.innerHeight - 72;

        try {
            physicsController.autoComputePXPerMFromRoom(userDataController.myAvatar.myUserData.currentRoom);
        } catch (e) { }
    }

    drawVolumeBubble({ userData }: { userData: UserData }) {
        if (userData.volumeDecibels < userData.volumeThreshold) {
            return;
        }
        let ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(0, 0, Utilities.linearScale(userData.volumeDecibels, AVATAR.MIN_VOLUME_DB, AVATAR.MAX_VOLUME_DB, AVATAR.RADIUS_M, AVATAR.RADIUS_M * AVATAR.MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER) * physicsController.pxPerMCurrent, 0, 2 * Math.PI);
        ctx.fillStyle = userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash);
        ctx.fill();
        ctx.closePath();
    }

    drawAvatarBase({ userData }: { userData: UserData }) {
        let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;
        let avatarRadiusM = AVATAR.RADIUS_M;
        let avatarRadiusPX = avatarRadiusM * pxPerM;

        let yawDegrees = userData.orientationEulerCurrent ? userData.orientationEulerCurrent.yawDegrees : 0;

        let amtToRotateAvatar = -yawDegrees * Math.PI / 180;
        ctx.rotate(amtToRotateAvatar);

        if (roomController.currentlyHoveringOverVisitIDHash === userData.visitIDHash || (userInputController.hoveredUserData && userInputController.hoveredUserData.visitIDHash === userData.visitIDHash)) {
            ctx.beginPath();
            ctx.arc(0, 0, (avatarRadiusM + UI.HOVER_HIGHLIGHT_RADIUS_ADDITION_M) * pxPerM, 0, 2 * Math.PI);
            let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, (avatarRadiusM + UI.HOVER_HIGHLIGHT_RADIUS_ADDITION_M) * pxPerM);
            grad.addColorStop(0.0, UI.HOVER_GLOW_HEX);
            grad.addColorStop(1.0, UI.HOVER_GLOW_HEX + "00");
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.closePath();
        }

        let colorHex = userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash);

        if (userData.orientationEulerCurrent) {
            ctx.beginPath();
            ctx.arc(0, -avatarRadiusM * AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, avatarRadiusM * AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, 0, Math.PI, false);
            let grad = ctx.createLinearGradient(0, 0, 0, -avatarRadiusM * AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM);
            grad.addColorStop(0.0, colorHex);
            grad.addColorStop(1.0, colorHex + "00");
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.closePath();
        }

        ctx.lineWidth = AVATAR.STROKE_WIDTH_PX;
        ctx.fillStyle = colorHex;
        ctx.beginPath();
        ctx.arc(0, 0, avatarRadiusPX, 0, 2 * Math.PI);
        if (isMine) {
            if (userData.isMuted) {
                ctx.strokeStyle = AVATAR.AVATAR_STROKE_HEX_MUTED;
            } else {
                ctx.strokeStyle = AVATAR.AVATAR_STROKE_HEX_UNMUTED;
            }
        } else {
            ctx.strokeStyle = AVATAR.AVATAR_STROKE_HEX_UNMUTED;
        }
        ctx.stroke();
        ctx.fill();
        ctx.closePath();
        ctx.rotate(-amtToRotateAvatar);
    }

    drawAvatarVideo({ userData }: { userData: UserData }) {
        if (videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            let ctx = this.ctx;
            let avatarRadiusM = AVATAR.RADIUS_M;
            let avatarRadiusPX = avatarRadiusM * physicsController.pxPerMCurrent;

            let amtToRotateVideo = this.canvasRotationDegrees * Math.PI / 180;
            ctx.rotate(amtToRotateVideo);
            ctx.save();
            ctx.clip();
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                ctx.scale(-1, 1);
            }
            ctx.drawImage(videoController.providedUserIDToVideoElementMap.get(userData.providedUserID), -avatarRadiusPX, -avatarRadiusPX, avatarRadiusPX * 2, avatarRadiusPX * 2);
            ctx.restore();
            ctx.rotate(-amtToRotateVideo);
        }
    }

    drawAvatarLabel({ userData }: { userData: UserData }) {
        // Don't draw the avatar label if we're drawing that avatar's video.
        if (videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            return;
        }

        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;
        let avatarRadiusM = AVATAR.RADIUS_M;

        let amtToRotateAvatarLabel = this.canvasRotationDegrees * Math.PI / 180;
        ctx.rotate(amtToRotateAvatarLabel);

        ctx.font = AVATAR.AVATAR_LABEL_FONT;
        ctx.fillStyle = Utilities.getConstrastingTextColor(Utilities.hexToRGB(userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash)));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let textToDraw = userData.displayName && userData.displayName.length > 0 ? userData.displayName : userData.providedUserID;
        let textMetrics = ctx.measureText(textToDraw);
        let avatarRadiusPX = avatarRadiusM * pxPerM;
        if (textMetrics.width > avatarRadiusPX + 5) {
            textToDraw = Utilities.getInitials(textToDraw);
        }

        ctx.fillText(textToDraw, 0, 0);
        ctx.rotate(-amtToRotateAvatarLabel);
    }

    drawTutorialGlow() {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        let tutorialRadiusPX = AVATAR.TUTORIAL_RADIUS_M * pxPerM;

        ctx.beginPath();
        ctx.arc(0, 0, tutorialRadiusPX, 0, 2 * Math.PI);
        let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, tutorialRadiusPX);
        grad.addColorStop(0.0, AVATAR.AVATAR_TUTORIAL_GLOW_HEX);
        grad.addColorStop(0.75, AVATAR.AVATAR_TUTORIAL_GLOW_HEX + "00");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.closePath();
    }

    drawTutorialText() {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        let amtToRotateTutorialText = this.canvasRotationDegrees * Math.PI / 180;
        ctx.rotate(amtToRotateTutorialText);

        ctx.font = UI.TUTORIAL_TEXT_FONT;
        ctx.fillStyle = UI.TUTORIAL_TEXT_COLOR;
        ctx.lineWidth = UI.TUTORIAL_TEXT_STROKE_WIDTH_PX;
        ctx.strokeStyle = UI.TUTORIAL_TEXT_STROKE_COLOR;

        ctx.textAlign = "right";
        let textToDraw = "This is you.";
        ctx.fillText(textToDraw, -AVATAR.RADIUS_M * pxPerM - 25, 0);
        ctx.strokeText(textToDraw, -AVATAR.RADIUS_M * pxPerM - 25, 0);

        ctx.textAlign = "left";
        textToDraw = "Try clicking yourself.";
        ctx.fillText(textToDraw, AVATAR.RADIUS_M * pxPerM + 25, 0);
        ctx.strokeText(textToDraw, AVATAR.RADIUS_M * pxPerM + 25, 0);

        ctx.rotate(-amtToRotateTutorialText);
    }

    drawAvatar({ userData }: { userData: UserData }) {
        if (!userData || !userData.positionCurrent || userData.positionCurrent.x === undefined || userData.positionCurrent.z === undefined) {
            return;
        }

        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        ctx.translate(userData.positionCurrent.x * pxPerM, userData.positionCurrent.z * pxPerM);

        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash && !uiController.hasCompletedTutorial) {
            this.drawTutorialGlow();
        }

        this.drawVolumeBubble({ userData });
        this.drawAvatarBase({ userData });
        this.drawAvatarVideo({ userData });
        this.drawAvatarLabel({ userData });

        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash && !uiController.hasCompletedTutorial) {
            this.drawTutorialText();
        }

        ctx.translate(-userData.positionCurrent.x * pxPerM, -userData.positionCurrent.z * pxPerM);
    }

    drawTableOrRoomGraphic(room: SpatialAudioRoom) {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        ctx.translate(room.roomCenter.x * pxPerM, room.roomCenter.z * pxPerM);

        let usingRoomImage = false;
        if (room.roomImage && room.roomImage.image.complete && room.roomImage.loaded) {
            usingRoomImage = true;
            let roomDimensionsPX = {
                "x": room.dimensions.x * pxPerM,
                "z": room.dimensions.z * pxPerM
            };
            ctx.drawImage(room.roomImage.image, -roomDimensionsPX.x / 2, -roomDimensionsPX.z / 2, roomDimensionsPX.x, roomDimensionsPX.z);
        }

        ctx.translate(-room.roomCenter.x * pxPerM, -room.roomCenter.z * pxPerM);

        ctx.translate(room.seatingCenter.x * pxPerM, room.seatingCenter.z * pxPerM);
        
        if (!usingRoomImage) {
            let tableRadiusPX = room.tableRadiusM * pxPerM;

            ctx.lineWidth = ROOM.TABLE_STROKE_WIDTH_PX;
            ctx.fillStyle = room.tableColorHex;
            ctx.beginPath();
            ctx.arc(0, 0, tableRadiusPX, 0, 2 * Math.PI);
            ctx.strokeStyle = ROOM.TABLE_STROKE_HEX;
            ctx.stroke();
            ctx.fill();
            ctx.closePath();

            ctx.drawImage(tableImage, -tableRadiusPX, -tableRadiusPX, tableRadiusPX * 2, tableRadiusPX * 2);
        }

        let amtToRotateRoomLabel = this.canvasRotationDegrees * Math.PI / 180;
        ctx.rotate(amtToRotateRoomLabel);
        ctx.font = ROOM.ROOM_LABEL_FONT;
        ctx.fillStyle = usingRoomImage ? ROOM.ROOM_WITH_IMAGE_LABEL_COLOR : Utilities.getConstrastingTextColor(Utilities.hexToRGB(room.tableColorHex));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let textMetrics = ctx.measureText(room.name);
        if (textMetrics.width < Math.min(room.seatingRadiusM * pxPerM, room.seatingRadiusM * pxPerM)) {
            ctx.fillText(room.name, 0, 0);
        }
        ctx.rotate(-amtToRotateRoomLabel);

        ctx.translate(-room.seatingCenter.x * pxPerM, -room.seatingCenter.z * pxPerM);
    }

    drawUnoccupiedSeat(seat: SpatialAudioSeat) {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;
        ctx.translate(seat.position.x * pxPerM, seat.position.z * pxPerM);
        let amountToRotateSeatImage = this.canvasRotationDegrees * Math.PI / 180;
        ctx.rotate(amountToRotateSeatImage);

        const seatRadiusPX = ROOM.SEAT_RADIUS_M * pxPerM;
        if (userInputController.hoveredSeat && userInputController.hoveredSeat.seatID === seat.seatID) {
            ctx.drawImage(seatIconHover, -seatRadiusPX, -seatRadiusPX, seatRadiusPX * 2, seatRadiusPX * 2);
        } else {
            ctx.drawImage(seatIconIdle, -seatRadiusPX, -seatRadiusPX, seatRadiusPX * 2, seatRadiusPX * 2);
        }

        ctx.rotate(-amountToRotateSeatImage);
        ctx.translate(-seat.position.x * pxPerM, -seat.position.z * pxPerM);
    }

    maybeDrawScrim() {
        if (this.canvasScrimOpacity > 0.0) {
            let ctx = this.ctx;
            this.unTranslateAndRotateCanvas();

            ctx.fillStyle = `rgba(0, 0, 0, ${this.canvasScrimOpacity})`;
            ctx.beginPath();
            ctx.rect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
            ctx.fill();
            ctx.closePath();

            this.translateAndRotateCanvas();
        }
    }

    drawRooms() {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        if (!(seatIconIdle.complete && tableImage.complete && ctx && pxPerM)) {
            return;
        }

        roomController.rooms.forEach((room) => {
            this.drawTableOrRoomGraphic(room);

            room.seats.forEach((seat) => {
                // Don't draw occupied seats yet.
                if (seat.occupiedUserData) {
                    return;
                }
                this.drawUnoccupiedSeat(seat);
            });
        });

        this.maybeDrawScrim();

        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        allUserData.forEach((userData) => {
            this.drawAvatar({ userData });
        });
    }

    drawParticles() {
        if (particleController.activeParticles.length === 0) {
            return;
        }

        const ctx = this.ctx;
        const pxPerM = physicsController.pxPerMCurrent;
    
        particleController.activeParticles.forEach((particle) => {
            if (!particle.currentWorldPositionM.x || !particle.currentWorldPositionM.z ||
                !particle.dimensionsM.x || !particle.dimensionsM.z ||
                !particle.image.complete) {
                return;
            }    
            ctx.translate(particle.currentWorldPositionM.x * pxPerM, particle.currentWorldPositionM.z * pxPerM);
            let amtToRotateParticle = this.canvasRotationDegrees * Math.PI / 180;
            ctx.rotate(amtToRotateParticle);
    
            let oldAlpha = ctx.globalAlpha;
            ctx.globalAlpha = particle.opacity;
    
            ctx.drawImage(
                particle.image,
                -particle.dimensionsM.x * pxPerM / 2,
                -particle.dimensionsM.z * pxPerM / 2,
                particle.dimensionsM.x * pxPerM,
                particle.dimensionsM.z * pxPerM);
    
            ctx.globalAlpha = oldAlpha;
            ctx.rotate(-amtToRotateParticle);
            ctx.translate(-particle.currentWorldPositionM.x * pxPerM, -particle.currentWorldPositionM.z * pxPerM);
        });
    }

    draw() {
        let ctx = this.ctx;

        ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

        const myUserData = userDataController.myAvatar.myUserData;
        if (!(myUserData.positionCurrent && myUserData.orientationEulerCurrent)) {
            return;
        }

        this.canvasRotationDegrees = -1 * userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees;

        let pxPerM = physicsController.pxPerMCurrent;

        const normalCameraOffsetYPX = this.mainCanvas.height / 2 - UI.AVATAR_PADDING_FOR_CAMERA * pxPerM;

        if (this.cameraOffsetYPX === undefined) {
            this.cameraOffsetYPX = normalCameraOffsetYPX;
        }

        this.cameraPositionNoOffsetM = userDataController.myAvatar.myUserData.positionCurrent;
        const currentRoom = myUserData.currentRoom;
        if (currentRoom) {
            let scaledOffsetPX = Utilities.linearScale(pxPerM, PHYSICS.MIN_PX_PER_M, physicsController.pxPerMMax, 0, normalCameraOffsetYPX, true);
            this.cameraOffsetYPX = scaledOffsetPX;
        }

        this.canvasOffsetPX = {
            x: this.mainCanvas.width / 2 - this.cameraPositionNoOffsetM.x * pxPerM,
            y: this.mainCanvas.height / 2 - this.cameraPositionNoOffsetM.z * pxPerM + this.cameraOffsetYPX
        };

        this.translateAndRotateCanvas();
        this.drawRooms();
        this.drawParticles();
        this.unTranslateAndRotateCanvas();
    }

    translateAndRotateCanvas() {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        if (!this.cameraPositionNoOffsetM) {
            return;
        }

        ctx.translate(this.canvasOffsetPX.x, this.canvasOffsetPX.y);
        ctx.translate(this.cameraPositionNoOffsetM.x * pxPerM, this.cameraPositionNoOffsetM.z * pxPerM);
        ctx.rotate(-this.canvasRotationDegrees * Math.PI / 180);
        ctx.translate(-this.cameraPositionNoOffsetM.x * pxPerM, -this.cameraPositionNoOffsetM.z * pxPerM);
    }

    unTranslateAndRotateCanvas() {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        if (!this.cameraPositionNoOffsetM) {
            return;
        }

        ctx.translate(this.cameraPositionNoOffsetM.x * pxPerM, this.cameraPositionNoOffsetM.z * pxPerM);
        ctx.rotate(this.canvasRotationDegrees * Math.PI / 180);
        ctx.translate(-this.cameraPositionNoOffsetM.x * pxPerM, -this.cameraPositionNoOffsetM.z * pxPerM);
        ctx.translate(-this.canvasOffsetPX.x, -this.canvasOffsetPX.y);
    }
}
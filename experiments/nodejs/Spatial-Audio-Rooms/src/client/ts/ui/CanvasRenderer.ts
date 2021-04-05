declare module '*.png';

import { physicsController, roomController, uiController, userDataController, videoController } from "..";
import {
    AVATAR,
    ROOM,
    UI,
} from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";
import { Seat, SpatialAudioRoom } from "../ui/RoomController";
import SeatIcon from '../../images/seat.png';
import TableImage from '../../images/table.png';
import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";

const seatIcon = new Image();
seatIcon.src = SeatIcon;
const tableImage = new Image();
tableImage.src = TableImage;

export class CanvasRenderer {
    mainCanvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    canvasOffsetPX: any;
    myCurrentRoom: SpatialAudioRoom;
    cameraPositionNoOffsetM: Point3D;
    canvasRotationDegrees: number = 0;

    constructor() {
        this.mainCanvas = document.createElement("canvas");
        this.mainCanvas.classList.add("mainCanvas");
        document.body.appendChild(this.mainCanvas);

        this.ctx = this.mainCanvas.getContext("2d");

        window.addEventListener("resize", (e) => {
            this.updateCanvasDimensions();
        });
        this.updateCanvasDimensions();

        window.requestAnimationFrame(this.drawLoop.bind(this));
    }

    drawLoop() {
        this.draw();
        window.requestAnimationFrame(this.drawLoop.bind(this));
    }

    updateCanvasParams() {
        let myCurrentRoom = roomController.getRoomFromName(userDataController.myAvatar.myUserData.currentRoomName);

        if (!myCurrentRoom) {
            return;
        }

        const myUserData = userDataController.myAvatar.myUserData;
        if (!myUserData.positionCurrent) {
            return;
        }

        if (!myUserData.orientationEulerCurrent) {
            return;
        }
        this.canvasRotationDegrees = -1 * userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees;

        this.myCurrentRoom = myCurrentRoom;

        let mainCanvas = this.mainCanvas;
        let pxPerM = physicsController.pxPerMCurrent;
        
        let cameraOffsetYPX = mainCanvas.height * UI.MY_AVATAR_Y_SCREEN_CENTER_OFFSET_RATIO;

        this.canvasOffsetPX = {
            x: (mainCanvas.width - this.myCurrentRoom.dimensions.x * pxPerM) / 2 + (-myUserData.positionCurrent.x + this.myCurrentRoom.dimensions.x / 2) * pxPerM,
            y: (mainCanvas.height - this.myCurrentRoom.dimensions.z * pxPerM) / 2 + (-myUserData.positionCurrent.z + this.myCurrentRoom.dimensions.z / 2) * pxPerM + cameraOffsetYPX
        };
    }

    computeCameraPosition() {
        if (!userDataController.myAvatar.myUserData.positionCurrent) {
            return;
        }
        this.cameraPositionNoOffsetM = userDataController.myAvatar.myUserData.positionCurrent;
    }

    updateCanvasDimensions() {
        this.mainCanvas.width = window.innerWidth;
        this.mainCanvas.height = window.innerHeight - 72;
    }

    drawVolumeBubble({ userData }: { userData: UserData }) {
        if (userData.volumeDecibels < userData.volumeThreshold) {
            return;
        }
        let ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(0, 0, Utilities.linearScale(userData.volumeDecibels, AVATAR.MIN_VOLUME_DB, AVATAR.MAX_VOLUME_DB, AVATAR.RADIUS_M, AVATAR.RADIUS_M * AVATAR.MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER) * physicsController.pxPerMCurrent, 0, 2 * Math.PI);
        ctx.fillStyle = userData.colorHex;
        ctx.fill();
        ctx.closePath();
    }

    drawAvatarBase({ userData }: { userData: UserData }) {
        let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;
        let avatarRadiusM = AVATAR.RADIUS_M;
        let avatarRadiusPX = avatarRadiusM * pxPerM;

        let amtToRotateAvatar = -userData.orientationEulerCurrent.yawDegrees * Math.PI / 180;
        ctx.rotate(amtToRotateAvatar);

        if (roomController.currentlyHoveringOverVisitIDHash === userData.visitIDHash) {
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(0, 0, (avatarRadiusM + AVATAR.AVATAR_HOVER_HIGHLIGHT_RADIUS_ADDITION_M) * pxPerM, 0, 2 * Math.PI);
            ctx.fill();
            ctx.closePath();
        }

        ctx.beginPath();
        ctx.arc(0, -avatarRadiusM * AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, avatarRadiusM * AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, 0, Math.PI, false);
        let grad = ctx.createLinearGradient(0, 0, 0, -avatarRadiusM * AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM);
        grad.addColorStop(0.0, userData.colorHex);
        grad.addColorStop(1.0, userData.colorHex + "00");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.closePath();

        ctx.lineWidth = AVATAR.STROKE_WIDTH_PX;
        ctx.fillStyle = userData.colorHex;
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
        ctx.fillStyle = Utilities.getConstrastingTextColor(Utilities.hexToRGB(userData.colorHex));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let textToDraw =  userData.displayName && userData.displayName.length > 0 ? userData.displayName : "❓ Anonymous";
        let textMetrics = ctx.measureText(textToDraw);
        let avatarRadiusPX = avatarRadiusM * pxPerM;
        if (textMetrics.width > avatarRadiusPX + 5) {
            textToDraw = Utilities.getInitials(userData.displayName);
        }

        ctx.fillText(textToDraw, 0, 0);
        ctx.rotate(-amtToRotateAvatarLabel);
    }

    drawTutorialGlow({ userData }: { userData: UserData }) {
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

    drawTutorialText({ userData }: { userData: UserData }) {
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
        if (!userData || !userData.positionCurrent || typeof (userData.positionCurrent.x) !== "number" || typeof (userData.positionCurrent.z) !== "number" || !userData.orientationEulerCurrent || typeof (userData.orientationEulerCurrent.yawDegrees) !== "number") {
            return;
        }
        
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        ctx.translate(userData.positionCurrent.x * pxPerM, userData.positionCurrent.z * pxPerM);

        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash && !uiController.hasCompletedTutorial) {
            this.drawTutorialGlow({ userData });
        }

        this.drawVolumeBubble({ userData });
        this.drawAvatarBase({ userData });
        this.drawAvatarVideo({ userData });
        this.drawAvatarLabel({ userData });

        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash && !uiController.hasCompletedTutorial) {
            this.drawTutorialText({ userData });
        }

        ctx.translate(-userData.positionCurrent.x * pxPerM, -userData.positionCurrent.z * pxPerM);
    }

    drawTableOrRoomGraphic(room: SpatialAudioRoom) {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        ctx.translate(room.center.x * pxPerM, room.center.z * pxPerM);

        let usingRoomImage = false;
        if (room.roomImage && room.roomImage.image.complete && room.roomImage.loaded) {
            usingRoomImage = true;
            let roomDimensionsPX = {
                "x": room.dimensions.x * pxPerM,
                "z": room.dimensions.z * pxPerM
            };
            ctx.drawImage(room.roomImage.image, -roomDimensionsPX.x / 2, -roomDimensionsPX.z / 2, roomDimensionsPX.x, roomDimensionsPX.z);
        } else {
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

        ctx.translate(-room.center.x * pxPerM, -room.center.z * pxPerM);
    }

    drawUnoccupiedSeat(seat: Seat) { 
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;
        ctx.translate(seat.position.x * pxPerM, seat.position.z * pxPerM);
        let amountToRotateSeatImage = this.canvasRotationDegrees * Math.PI / 180;
        ctx.rotate(amountToRotateSeatImage);

        ctx.lineWidth = ROOM.SEAT_STROKE_WIDTH_PX;
        ctx.fillStyle = ROOM.SEAT_COLOR_HEX;
        ctx.beginPath();
        let seatRadiusPX = ROOM.SEAT_RADIUS_M * pxPerM;
        ctx.arc(0, 0, seatRadiusPX, 0, 2 * Math.PI);
        ctx.strokeStyle = ROOM.SEAT_STROKE_HEX;
        ctx.stroke();
        ctx.fill();
        ctx.closePath();

        ctx.drawImage(seatIcon, -seatRadiusPX / 2, -seatRadiusPX / 2, seatRadiusPX, seatRadiusPX);

        ctx.rotate(-amountToRotateSeatImage);
        ctx.translate(-seat.position.x * pxPerM, -seat.position.z * pxPerM);
    }

    drawRooms() {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        if (!(seatIcon.complete && tableImage.complete && ctx && pxPerM)) {
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
        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        allUserData.forEach((userData) => {
            this.drawAvatar({ userData });
        });
    }

    draw() {
        let ctx = this.ctx;

        ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

        this.updateCanvasParams();
        this.computeCameraPosition();

        if (!this.myCurrentRoom) {
            return;
        }

        this.translateAndRotateCanvas();
        
        this.drawRooms();
        
        this.unTranslateAndRotateCanvas();
    }

    translateAndRotateCanvas() {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        const myUserData = userDataController.myAvatar.myUserData;
        if (!myUserData.positionCurrent) {
            return;
        }

        ctx.translate(this.canvasOffsetPX.x, this.canvasOffsetPX.y);
        ctx.translate(myUserData.positionCurrent.x * pxPerM, myUserData.positionCurrent.z * pxPerM);
        ctx.rotate(-this.canvasRotationDegrees * Math.PI / 180);
        ctx.translate(-myUserData.positionCurrent.x * pxPerM, -myUserData.positionCurrent.z * pxPerM);
    }

    unTranslateAndRotateCanvas() {
        let ctx = this.ctx;
        let pxPerM = physicsController.pxPerMCurrent;

        const myUserData = userDataController.myAvatar.myUserData;
        if (!myUserData.positionCurrent) {
            return;
        }

        ctx.translate(myUserData.positionCurrent.x * pxPerM, myUserData.positionCurrent.z * pxPerM);
        ctx.rotate(this.canvasRotationDegrees * Math.PI / 180);
        ctx.translate(-myUserData.positionCurrent.x * pxPerM, -myUserData.positionCurrent.z * pxPerM);
        ctx.translate(-this.canvasOffsetPX.x, -this.canvasOffsetPX.y);
    }
}
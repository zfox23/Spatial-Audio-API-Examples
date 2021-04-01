declare module '*.png';

import { roomController, userDataController, videoController } from "..";
import {
    AVATAR_RADIUS_M,
    MAX_VOLUME_DB,
    AVATAR_STROKE_WIDTH_PX,
    DIRECTION_CLOUD_RADIUS_MULTIPLIER,
    MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER,
    MIN_VOLUME_DB,
    AVATAR_STROKE_HEX_MUTED,
    AVATAR_STROKE_HEX_UNMUTED,
    AVATAR_LABEL_FONT,
    SEAT_STROKE_HEX,
    SEAT_STROKE_WIDTH_PX,
    SEAT_COLOR_HEX,
    SEAT_RADIUS_M,
    ROOM_TABLE_STROKE_HEX,
    ROOM_TABLE_STROKE_WIDTH_PX,
    MOUSE_WHEEL_ZOOM_FACTOR,
    AVATAR_HOVER_HIGHLIGHT_RADIUS_ADDITION_M,
} from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";
import { Seat, SpatialAudioRoom } from "../ui/RoomController";
import SeatIcon from '../../images/seat.png';
import TableImage from '../../images/table.png';

const seatIcon = new Image();
seatIcon.src = SeatIcon;
const tableImage = new Image();
tableImage.src = TableImage;

export class CanvasRenderer {
    mainCanvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    canvasRotationDegrees: number = 0;
    pxPerM: number;
    canvasOffsetPX: any;
    lastNow: number = 0;
    myCurrentRoom: SpatialAudioRoom;
    lastOnWheelTimestamp: number;
    onWheelTimestampDeltaMS: number;

    constructor() {
        this.mainCanvas = document.createElement("canvas");
        this.mainCanvas.classList.add("mainCanvas");
        document.body.appendChild(this.mainCanvas);
        this.mainCanvas.addEventListener("wheel", this.onWheel.bind(this), false);

        this.ctx = this.mainCanvas.getContext("2d");

        window.addEventListener("resize", (e) => {
            this.updateCanvasDimensions();
        });
        this.updateCanvasDimensions();

        // No need for physics yet.
        //setInterval(this.physicsLoop, PHYSICS_TICKRATE_MS);

        window.requestAnimationFrame(this.drawLoop.bind(this));
    }

    physicsLoop() {
        let now = performance.now();
        let dt = now - this.lastNow;
        this.lastNow = now;
    }

    drawLoop() {
        this.draw();
        window.requestAnimationFrame(this.drawLoop.bind(this));
    }

    updatePXPerM(newPXPerM?: number) {
        this.updateCanvasParams();
        if (!this.myCurrentRoom) {
            return;
        }

        if (!newPXPerM) {
            this.pxPerM = Math.min(this.mainCanvas.width, this.mainCanvas.height) / this.myCurrentRoom.dimensions.x;
        } else {
            this.pxPerM = Utilities.clamp(newPXPerM, 0, 999);
        }
    }

    updateCanvasParams() {
        let myCurrentRoom = roomController.getRoomFromName(userDataController.myAvatar.myUserData.currentRoomName);

        if (!myCurrentRoom) {
            return;
        }

        this.myCurrentRoom = myCurrentRoom;

        let mainCanvas = this.mainCanvas;
        let pxPerM = this.pxPerM;

        this.canvasOffsetPX = {
            x: (mainCanvas.width - this.myCurrentRoom.dimensions.x * pxPerM) / 2 + (-this.myCurrentRoom.center.x + this.myCurrentRoom.dimensions.x / 2) * pxPerM,
            y: (mainCanvas.height - this.myCurrentRoom.dimensions.z * pxPerM) / 2 + (-this.myCurrentRoom.center.z + this.myCurrentRoom.dimensions.z / 2) * pxPerM
        };
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
        ctx.arc(0, 0, Utilities.linearScale(userData.volumeDecibels, MIN_VOLUME_DB, MAX_VOLUME_DB, AVATAR_RADIUS_M, AVATAR_RADIUS_M * MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER) * this.pxPerM, 0, 2 * Math.PI);
        ctx.fillStyle = userData.colorHex;
        ctx.fill();
        ctx.closePath();
    }

    drawAvatarBase({ userData }: { userData: UserData }) {
        let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;
        let ctx = this.ctx;
        let pxPerM = this.pxPerM;
        let avatarRadiusM = AVATAR_RADIUS_M;
        let avatarRadiusPX = avatarRadiusM * pxPerM;

        let amtToRotate = -userData.orientationEuler.yawDegrees * Math.PI / 180;
        ctx.rotate(amtToRotate);

        if (roomController.currentlyHoveringOverVisitIDHash === userData.visitIDHash) {
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(0, 0, (avatarRadiusM + AVATAR_HOVER_HIGHLIGHT_RADIUS_ADDITION_M) * pxPerM, 0, 2 * Math.PI);
            ctx.fill();
            ctx.closePath();
        }

        ctx.beginPath();
        ctx.arc(0, -avatarRadiusM * DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, avatarRadiusM * DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, 0, Math.PI, false);
        let grad = ctx.createLinearGradient(0, 0, 0, -avatarRadiusM * DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM);
        grad.addColorStop(0.0, userData.colorHex);
        grad.addColorStop(1.0, userData.colorHex + "00");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.closePath();

        ctx.lineWidth = AVATAR_STROKE_WIDTH_PX;
        ctx.fillStyle = userData.colorHex;
        ctx.beginPath();
        ctx.arc(0, 0, avatarRadiusPX, 0, 2 * Math.PI);
        if (isMine) {
            if (userData.isMuted) {
                ctx.strokeStyle = AVATAR_STROKE_HEX_MUTED;
            } else {
                ctx.strokeStyle = AVATAR_STROKE_HEX_UNMUTED;
            }
        } else {
            ctx.strokeStyle = AVATAR_STROKE_HEX_UNMUTED;
        }
        ctx.stroke();
        ctx.fill();
        ctx.closePath();
        ctx.rotate(-amtToRotate);
    }

    drawAvatarVideo({ userData }: { userData: UserData }) {
        if (videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            let ctx = this.ctx;
            let avatarRadiusM = AVATAR_RADIUS_M;
            let avatarRadiusPX = avatarRadiusM * this.pxPerM;

            let amtToRotateVideo = this.canvasRotationDegrees * Math.PI / 180;
            ctx.rotate(amtToRotateVideo);
            ctx.save();
            ctx.clip();
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
        let pxPerM = this.pxPerM;
        let avatarRadiusM = AVATAR_RADIUS_M;

        let amtToRotateLabel = this.canvasRotationDegrees * Math.PI / 180;
        ctx.rotate(amtToRotateLabel);

        ctx.font = AVATAR_LABEL_FONT;
        ctx.fillStyle = Utilities.getConstrastingTextColor(Utilities.hexToRGB(userData.colorHex));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let textToDraw = userData.displayName;
        let textMetrics = ctx.measureText(textToDraw);
        let avatarRadiusPX = avatarRadiusM * pxPerM;
        if (textMetrics.width > avatarRadiusPX + 5) {
            textToDraw = Utilities.getInitials(userData.displayName);
        }

        ctx.fillText(textToDraw, 0, 0);
        ctx.rotate(-amtToRotateLabel);
    }

    drawAvatar({ userData }: { userData: UserData }) {
        if (!userData || !userData.position || typeof (userData.position.x) !== "number" || typeof (userData.position.z) !== "number") {
            return;
        }
        
        let ctx = this.ctx;
        let pxPerM = this.pxPerM;

        ctx.translate(userData.position.x * pxPerM, userData.position.z * pxPerM);

        this.drawVolumeBubble({ userData });
        this.drawAvatarBase({ userData });
        this.drawAvatarVideo({ userData });
        this.drawAvatarLabel({ userData });

        ctx.translate(-userData.position.x * pxPerM, -userData.position.z * pxPerM);
    }

    drawTable(room: SpatialAudioRoom) {
        let ctx = this.ctx;
        let pxPerM = this.pxPerM;
        let tableRadiusPX = room.tableRadiusM * pxPerM;

        this.translateAndRotateCanvas();
        ctx.translate(room.center.x * pxPerM, room.center.z * pxPerM);

        ctx.lineWidth = ROOM_TABLE_STROKE_WIDTH_PX;
        ctx.fillStyle = room.tableColorHex;
        ctx.beginPath();
        ctx.arc(0, 0, tableRadiusPX, 0, 2 * Math.PI);
        ctx.strokeStyle = ROOM_TABLE_STROKE_HEX;
        ctx.stroke();
        ctx.fill();
        ctx.closePath();

        ctx.drawImage(tableImage, -tableRadiusPX, -tableRadiusPX, tableRadiusPX * 2, tableRadiusPX * 2);
        
        let amtToRotateLabel = this.canvasRotationDegrees * Math.PI / 180;
        ctx.rotate(amtToRotateLabel);
        ctx.font = AVATAR_LABEL_FONT;
        ctx.fillStyle = Utilities.getConstrastingTextColor(Utilities.hexToRGB(room.tableColorHex));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(room.name, 0, 0);
        ctx.rotate(-amtToRotateLabel);

        ctx.translate(-room.center.x * pxPerM, -room.center.z * pxPerM);
        this.unTranslateAndRotateCanvas();
    }

    drawUnoccupiedSeat(seat: Seat) { 
        let ctx = this.ctx;
        let pxPerM = this.pxPerM;
        ctx.translate(seat.position.x * pxPerM, seat.position.z * pxPerM);
        let amountToRotateSeatImage = this.canvasRotationDegrees * Math.PI / 180;
        ctx.rotate(amountToRotateSeatImage);

        ctx.lineWidth = SEAT_STROKE_WIDTH_PX;
        ctx.fillStyle = SEAT_COLOR_HEX;
        ctx.beginPath();
        let seatRadiusPX = SEAT_RADIUS_M * pxPerM;
        ctx.arc(0, 0, seatRadiusPX, 0, 2 * Math.PI);
        ctx.strokeStyle = SEAT_STROKE_HEX;
        ctx.stroke();
        ctx.fill();
        ctx.closePath();

        ctx.drawImage(seatIcon, -seatRadiusPX / 2, -seatRadiusPX / 2, seatRadiusPX, seatRadiusPX);

        ctx.rotate(-amountToRotateSeatImage);
        ctx.translate(-seat.position.x * pxPerM, -seat.position.z * pxPerM);
    }

    drawRooms() {
        let ctx = this.ctx;
        let pxPerM = this.pxPerM;

        if (!(seatIcon.complete && tableImage.complete && ctx && pxPerM)) {
            return;
        }

        roomController.rooms.forEach((room) => {
            this.drawTable(room);
        
            this.translateAndRotateCanvas();
            room.seats.forEach((seat) => {
                // Don't draw occupied seats yet.
                if (seat.occupiedUserData) {
                    return;
                }
                this.drawUnoccupiedSeat(seat);
            });
            this.unTranslateAndRotateCanvas();
        });
            
        this.translateAndRotateCanvas();
        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        allUserData.forEach((userData) => {
            this.drawAvatar({ userData });
        });
        this.unTranslateAndRotateCanvas();
    }

    draw() {
        let ctx = this.ctx;

        ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

        this.updateCanvasParams();

        if (!this.myCurrentRoom) {
            return;
        }

        this.drawRooms();
    }

    translateAndRotateCanvas() {
        let ctx = this.ctx;
        ctx.translate(this.canvasOffsetPX.x, this.canvasOffsetPX.y);
        ctx.translate(this.myCurrentRoom.center.x * this.pxPerM, this.myCurrentRoom.center.z * this.pxPerM);
        ctx.rotate(-this.canvasRotationDegrees * Math.PI / 180);
        ctx.translate(-this.myCurrentRoom.center.x * this.pxPerM, -this.myCurrentRoom.center.z * this.pxPerM);
    }

    unTranslateAndRotateCanvas() {
        let ctx = this.ctx;
        ctx.translate(this.myCurrentRoom.center.x * this.pxPerM, this.myCurrentRoom.center.z * this.pxPerM);
        ctx.rotate(this.canvasRotationDegrees * Math.PI / 180);
        ctx.translate(-this.myCurrentRoom.center.x * this.pxPerM, -this.myCurrentRoom.center.z * this.pxPerM);
        ctx.translate(-this.canvasOffsetPX.x, -this.canvasOffsetPX.y);
    }

    onWheel(e: WheelEvent) {
        e.preventDefault();
    
        if (this.lastOnWheelTimestamp) {
            this.onWheelTimestampDeltaMS = Date.now() - this.lastOnWheelTimestamp;
        }
    
        let deltaY;
        // This is a nasty hack that all major browsers subscribe to:
        // "Pinch" gestures on multi-touch trackpads are rendered as wheel events
        // with `e.ctrlKey` set to `true`.
        if (e.ctrlKey) {
            deltaY = e.deltaY * 10;
        } else {
            deltaY = (-e.deltaY * 10);
        }
    
        let scaleFactor = 1 + deltaY * MOUSE_WHEEL_ZOOM_FACTOR;
        let targetPXPerSU = this.pxPerM * scaleFactor;

        this.updatePXPerM(targetPXPerSU);
    
        this.lastOnWheelTimestamp = Date.now();
    }
}
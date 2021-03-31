declare module '*.png';

import { roomController, userDataController, videoController } from "..";
import {
    AVATAR_RADIUS_M,
    MAX_VOLUME_DB,
    AVATAR_STROKE_WIDTH_PX,
    DIRECTION_CLOUD_RADIUS_MULTIPLIER,
    MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER,
    MIN_VOLUME_DB,
    VIRTUAL_ROOM_DIMENSIONS_PER_SIDE_M,
    AVATAR_STROKE_HEX_MUTED,
    AVATAR_STROKE_HEX_UNMUTED,
    AVATAR_LABEL_FONT,
    PHYSICS_TICKRATE_MS,
    SEAT_STROKE_HEX,
    SEAT_STROKE_WIDTH_PX,
    SEAT_COLOR_HEX,
    SEAT_RADIUS_M,
    ROOM_TABLE_RADIUS_M,
    ROOM_TABLE_STROKE_HEX,
    ROOM_TABLE_STROKE_WIDTH_PX,
    ROOM_TABLE_COLOR_HEX,
} from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";
import SeatIcon from '../../images/seat.png';
import TableImage from '../../images/table.png';

const seatIcon = new Image();
seatIcon.src = SeatIcon;
const tableImage = new Image();
tableImage.src = TableImage;

interface PositionInCanvasSpace {
    x: number;
    y: number;
}

export class CanvasRenderer {
    mainCanvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    canvasRotationDegrees: number = 0;
    pxPerM: number;
    lastNow: number = 0;

    constructor() {
        this.mainCanvas = document.createElement("canvas");
        this.mainCanvas.classList.add("mainCanvas");
        document.body.appendChild(this.mainCanvas);

        this.ctx = this.mainCanvas.getContext("2d");

        this.updatePXPerM();

        this.updateCanvasDimensions();

        window.addEventListener("resize", (e) => {
            this.updateCanvasDimensions();
        });

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
        this.drawCanvas();
        window.requestAnimationFrame(this.drawLoop.bind(this));
    }

    updatePXPerM() {
        let myCurrentRoom = roomController.getRoomFromName(userDataController.myAvatar.myUserData.currentRoomName);

        if (!myCurrentRoom) {
            return;
        }

        if (myCurrentRoom.dimensions.x !== myCurrentRoom.dimensions.z) {
            console.warn(`The current room isn't square!`);
        }

        this.pxPerM = Math.min(this.mainCanvas.width, this.mainCanvas.height) / myCurrentRoom.dimensions.x;
    }

    updateCanvasDimensions() {
        let dimension = Math.min(window.innerWidth, window.innerHeight - 72);

        this.mainCanvas.width = dimension;
        this.mainCanvas.height = dimension;

        this.mainCanvas.style.width = `${this.mainCanvas.width}px`;
        this.mainCanvas.style.height = `${this.mainCanvas.height}px`;
        this.mainCanvas.style.left = `${(window.innerWidth - this.mainCanvas.width) / 2}px`;
    }

    drawVolumeBubble({ userData, positionInCanvasSpace }: { userData: UserData, positionInCanvasSpace: PositionInCanvasSpace }) {
        if (userData.volumeDecibels < userData.volumeThreshold) {
            return;
        }
        let ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(positionInCanvasSpace.x, positionInCanvasSpace.y, Utilities.linearScale(userData.volumeDecibels, MIN_VOLUME_DB, MAX_VOLUME_DB, AVATAR_RADIUS_M, AVATAR_RADIUS_M * MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER) * this.pxPerM, 0, 2 * Math.PI);
        ctx.fillStyle = userData.colorHex;
        ctx.fill();
        ctx.closePath();
    }

    drawAvatarBase({ isMine, userData, positionInCanvasSpace }: { isMine: boolean, userData: UserData, positionInCanvasSpace: PositionInCanvasSpace }) {
        let ctx = this.ctx;
        let pxPerM = this.pxPerM;
        let avatarRadiusM = AVATAR_RADIUS_M;
        let avatarRadiusPX = avatarRadiusM * pxPerM;

        ctx.translate(positionInCanvasSpace.x, positionInCanvasSpace.y);
        let amtToRotate = ((userData.orientationEuler && userData.orientationEuler.yawDegrees * -1 + 180) || 0) * Math.PI / 180;
        ctx.rotate(amtToRotate);

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

        if (videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            let amtToRotateVideo = -this.canvasRotationDegrees * Math.PI / 180;
            ctx.rotate(amtToRotateVideo);
            ctx.save();
            ctx.clip();
            ctx.drawImage(videoController.providedUserIDToVideoElementMap.get(userData.providedUserID), -avatarRadiusPX, -avatarRadiusPX, avatarRadiusPX * 2, avatarRadiusPX * 2);
            ctx.restore();
            ctx.rotate(-amtToRotateVideo);
        }

        ctx.translate(-positionInCanvasSpace.x, -positionInCanvasSpace.y);
    }

    drawAvatarLabel({ isMine, userData, positionInCanvasSpace }: { isMine: boolean, userData: UserData, positionInCanvasSpace: PositionInCanvasSpace }) {
        // Don't draw the avatar label if we're drawing that avatar's video.
        if (videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            return;
        }

        let ctx = this.ctx;
        let pxPerM = this.pxPerM;
        let avatarRadiusM = AVATAR_RADIUS_M;

        ctx.translate(positionInCanvasSpace.x, positionInCanvasSpace.y);
        let amtToRotateLabel = -this.canvasRotationDegrees * Math.PI / 180;
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
        ctx.translate(-positionInCanvasSpace.x, -(positionInCanvasSpace.y));
    }

    drawAvatar({ userData }: { userData: UserData }) {
        if (!userData || !userData.position || typeof (userData.position.x) !== "number" || typeof (userData.position.z) !== "number") {
            return;
        }

        let ctx = this.ctx;
        let mainCanvas = this.mainCanvas;

        ctx.translate(-mainCanvas.width / 2, -mainCanvas.height / 2);

        let currentRoom = roomController.getRoomFromPoint3D(userData.position);

        if (currentRoom) {
            let positionInCanvasSpace = {
                // We reverse the last two terms here because "-x" in canvas space is "+x" in mixer space.
                "x": Math.round(Utilities.linearScale(userData.position.x - currentRoom.center.x, -currentRoom.dimensions.x / 2, currentRoom.dimensions.x / 2, mainCanvas.width, 0)),
                // We reverse the last two terms here because "-y" in canvas space is "+z" in mixer space.
                "y": Math.round(Utilities.linearScale(userData.position.z - currentRoom.center.z, -currentRoom.dimensions.z / 2, currentRoom.dimensions.z / 2, mainCanvas.height, 0))
            };
    
            let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;
    
            this.drawVolumeBubble({ userData, positionInCanvasSpace });
            this.drawAvatarBase({ isMine, userData, positionInCanvasSpace });
            this.drawAvatarLabel({ isMine, userData, positionInCanvasSpace });
        }

        ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
    }

    drawRooms() {
        if (!(seatIcon.complete && tableImage.complete)) {
            return;
        }

        let ctx = this.ctx;
        let mainCanvas = this.mainCanvas;
        let pxPerM = this.pxPerM;

        ctx.translate(-mainCanvas.width / 2, -mainCanvas.height / 2);

        roomController.rooms.forEach((room) => {
            if (userDataController.myAvatar.myUserData.currentRoomName !== room.name) {
                return;
            }

            let tablePositionInCanvasSpace = {
                // We reverse the last two terms here because "-x" in canvas space is "+x" in mixer space.
                "x": Math.round(Utilities.linearScale(0 - room.center.x, -room.dimensions.x / 2, room.dimensions.x / 2, mainCanvas.width, 0)),
                // We reverse the last two terms here because "-y" in canvas space is "+z" in mixer space.
                "y": Math.round(Utilities.linearScale(0 - room.center.z, -room.dimensions.z / 2, room.dimensions.z / 2, mainCanvas.height, 0))
            };
                
            let tableRadiusPX = ROOM_TABLE_RADIUS_M * pxPerM;

            ctx.translate(tablePositionInCanvasSpace.x, tablePositionInCanvasSpace.y);
            ctx.lineWidth = ROOM_TABLE_STROKE_WIDTH_PX;
            ctx.fillStyle = ROOM_TABLE_COLOR_HEX;
            ctx.beginPath();
            ctx.arc(0, 0, tableRadiusPX, 0, 2 * Math.PI);
            ctx.strokeStyle = ROOM_TABLE_STROKE_HEX;
            ctx.stroke();
            ctx.fill();
            ctx.closePath();

            ctx.drawImage(tableImage, -tableRadiusPX, -tableRadiusPX, tableRadiusPX * 2, tableRadiusPX * 2);

            ctx.translate(-tablePositionInCanvasSpace.x, -tablePositionInCanvasSpace.y);

            room.seats.forEach((seat) => {
                // Don't draw occupied seats.
                if (seat.occupiedUserData) {
                    return;
                }

                let seatPositionInCanvasSpace = {
                    // We reverse the last two terms here because "-x" in canvas space is "+x" in mixer space.
                    "x": Math.round(Utilities.linearScale(seat.position.x - room.center.x, -room.dimensions.x / 2, room.dimensions.x / 2, mainCanvas.width, 0)),
                    // We reverse the last two terms here because "-y" in canvas space is "+z" in mixer space.
                    "y": Math.round(Utilities.linearScale(seat.position.z - room.center.z, -room.dimensions.z / 2, room.dimensions.z / 2, mainCanvas.height, 0))
                };
                
                let seatRadiusPX = SEAT_RADIUS_M * pxPerM;

                ctx.translate(seatPositionInCanvasSpace.x, seatPositionInCanvasSpace.y);
                ctx.rotate(-this.canvasRotationDegrees * Math.PI / 180);
                ctx.lineWidth = SEAT_STROKE_WIDTH_PX;
                ctx.fillStyle = SEAT_COLOR_HEX;
                ctx.beginPath();
                ctx.arc(0, 0, seatRadiusPX, 0, 2 * Math.PI);
                ctx.strokeStyle = SEAT_STROKE_HEX;
                ctx.stroke();
                ctx.fill();
                ctx.closePath();

                ctx.drawImage(seatIcon, -seatRadiusPX / 2, -seatRadiusPX / 2, seatRadiusPX, seatRadiusPX);

                ctx.rotate(this.canvasRotationDegrees * Math.PI / 180);
                ctx.translate(-seatPositionInCanvasSpace.x, -seatPositionInCanvasSpace.y);
            });
        });

        ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
    }

    drawCanvas() {
        this.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

        let allOtherUserData = userDataController.allOtherUserData;

        if (allOtherUserData.length === 0 && !userDataController.myAvatar.myUserData.position) {
            return;
        }

        this.updatePXPerM();

        this.ctx.translate(this.mainCanvas.width / 2, this.mainCanvas.height / 2);
        this.ctx.rotate(this.canvasRotationDegrees * Math.PI / 180);

        this.drawRooms();

        for (const userData of allOtherUserData) {
            this.drawAvatar({ userData });
        }

        this.drawAvatar({ userData: userDataController.myAvatar.myUserData });

        this.ctx.rotate(-this.canvasRotationDegrees * Math.PI / 180);
        this.ctx.translate(-this.mainCanvas.width / 2, -this.mainCanvas.height / 2);
    }
}
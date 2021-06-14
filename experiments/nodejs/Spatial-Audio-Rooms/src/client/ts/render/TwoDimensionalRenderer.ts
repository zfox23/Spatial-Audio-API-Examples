declare module '*.png';

import { particleController, physicsController, roomController, uiController, userDataController, userInputController, videoController, watchPartyController } from "..";
import { AVATAR, PHYSICS, ROOM, UI, } from "../constants/constants";
import { MyAvatarModes, UserData } from "../userData/UserDataController";
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
    normalModeCanvas: HTMLCanvasElement;
    normalModeCTX: CanvasRenderingContext2D;
    cameraOffsetYPX: number;
    canvasOffsetPX: any;
    cameraPositionNoOffsetM: Point3D;
    canvasRotationDegrees: number = 0;
    canvasScrimOpacity: number = 0.0;

    constructor() {
        this.normalModeCanvas = document.createElement("canvas");
        this.normalModeCanvas.classList.add("normalModeCanvas");
        this.normalModeCanvas.tabIndex = 0;
        document.body.appendChild(this.normalModeCanvas);
        this.normalModeCTX = this.normalModeCanvas.getContext("2d");

        window.addEventListener("resize", this.updateCanvasDimensions.bind(this));
        this.updateCanvasDimensions();

        window.requestAnimationFrame(this.drawLoop.bind(this));
    }

    drawLoop() {
        this.draw();
        window.requestAnimationFrame(this.drawLoop.bind(this));
    }

    updateCanvasDimensions() {
        let learnMoreContainer = document.querySelector('.learnMoreContainer');
        let learnMoreContainerHeight = 0;

        let bottomBar = document.querySelector('.bottomBar');
        let bottomBarHeight = 72;

        if (bottomBar) {
            bottomBarHeight = bottomBar.clientHeight;
        }

        if (learnMoreContainer) {
            learnMoreContainerHeight = learnMoreContainer.clientHeight;
        }

        let showRoomListButton = <HTMLElement>document.querySelector(".showRoomListButton");
        if (showRoomListButton) {
            showRoomListButton.style.top = `${learnMoreContainerHeight}px`;
        }

        let roomListOuterContainer = <HTMLElement>document.querySelector(".roomListOuterContainer");
        if (roomListOuterContainer) {
            roomListOuterContainer.style.bottom = `${bottomBarHeight}px`;
        }

        let roomListInnerContainer = <HTMLElement>document.querySelector(".roomListInnerContainer");
        if (roomListInnerContainer) {
            let topMarginPX = bottomBarHeight + learnMoreContainerHeight;
            roomListInnerContainer.style.margin = `${topMarginPX}px 0 0 0`;
            roomListInnerContainer.style.height = `calc(100vh - ${bottomBarHeight}px - ${topMarginPX}px - ${learnMoreContainerHeight}px)`;
        }

        let signalButtonContainer = <HTMLElement>document.querySelector(".signalButtonContainer");
        if (signalButtonContainer) {
            signalButtonContainer.style.top = `${learnMoreContainerHeight}px`;
        }

        let youTubePlayerContainer = <HTMLElement>document.querySelector(".youTubePlayerContainer");
        if (youTubePlayerContainer) {
            youTubePlayerContainer.style.top = `${learnMoreContainerHeight}px`;
            youTubePlayerContainer.style.height = `calc(100vh - ${bottomBarHeight} - 150px - ${learnMoreContainerHeight}px)`;
        }

        let modalBackground = <HTMLElement>document.querySelector(".modalBackground");
        if (modalBackground) {
            modalBackground.style.height = `calc(100vh - ${bottomBarHeight})`;
        }

        this.normalModeCanvas.width = window.innerWidth;
        this.normalModeCanvas.style.height = `${window.innerHeight - bottomBarHeight - learnMoreContainerHeight}px`;
        this.normalModeCanvas.style.top = `${learnMoreContainerHeight}px`
        this.normalModeCanvas.height = window.innerHeight - bottomBarHeight - learnMoreContainerHeight;

        try {
            physicsController.autoComputePXPerMFromRoom(userDataController.myAvatar.myUserData.currentRoom);
        } catch (e) { }
    }

    drawVolumeBubble({ userData }: { userData: UserData }) {
        if (userData.volumeDecibels < userData.volumeThreshold) {
            return;
        }
        let normalModeCTX = this.normalModeCTX;
        normalModeCTX.beginPath();
        normalModeCTX.arc(0, 0, Utilities.linearScale(userData.volumeDecibels, AVATAR.MIN_VOLUME_DB, AVATAR.MAX_VOLUME_DB, AVATAR.RADIUS_M, AVATAR.RADIUS_M * AVATAR.MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER) * physicsController.pxPerMCurrent, 0, 2 * Math.PI);
        normalModeCTX.fillStyle = userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash);
        normalModeCTX.fill();
        normalModeCTX.closePath();
    }

    drawAvatarBase({ userData }: { userData: UserData }) {
        let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;
        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;
        let avatarRadiusM = AVATAR.RADIUS_M;
        let avatarRadiusPX = avatarRadiusM * pxPerM;

        let yawDegrees = userData.orientationEulerCurrent ? userData.orientationEulerCurrent.yawDegrees : 0;

        let amtToRotateAvatar = -yawDegrees * Math.PI / 180;
        normalModeCTX.rotate(amtToRotateAvatar);

        if (roomController.currentlyHoveringOverVisitIDHash === userData.visitIDHash || (userInputController.hoveredUserData && userInputController.hoveredUserData.visitIDHash === userData.visitIDHash)) {
            normalModeCTX.beginPath();
            normalModeCTX.arc(0, 0, (avatarRadiusM + UI.HOVER_HIGHLIGHT_RADIUS_ADDITION_M) * pxPerM, 0, 2 * Math.PI);
            let grad = normalModeCTX.createRadialGradient(0, 0, 0, 0, 0, (avatarRadiusM + UI.HOVER_HIGHLIGHT_RADIUS_ADDITION_M) * pxPerM);
            grad.addColorStop(0.0, UI.HOVER_GLOW_HEX);
            grad.addColorStop(1.0, UI.HOVER_GLOW_HEX + "00");
            normalModeCTX.fillStyle = grad;
            normalModeCTX.fill();
            normalModeCTX.closePath();
        }

        let colorHex = userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash);

        if (userData.orientationEulerCurrent) {
            normalModeCTX.beginPath();
            normalModeCTX.arc(0, -avatarRadiusM * AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, avatarRadiusM * AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, 0, Math.PI, false);
            let grad = normalModeCTX.createLinearGradient(0, 0, 0, -avatarRadiusM * AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM);
            grad.addColorStop(0.0, colorHex);
            grad.addColorStop(1.0, colorHex + "00");
            normalModeCTX.fillStyle = grad;
            normalModeCTX.fill();
            normalModeCTX.closePath();
        }

        normalModeCTX.lineWidth = AVATAR.STROKE_WIDTH_PX;
        normalModeCTX.fillStyle = colorHex;
        normalModeCTX.beginPath();
        normalModeCTX.arc(0, 0, avatarRadiusPX, 0, 2 * Math.PI);
        if (isMine) {
            if (userData.isMuted) {
                normalModeCTX.strokeStyle = AVATAR.AVATAR_STROKE_HEX_MUTED;
            } else {
                normalModeCTX.strokeStyle = AVATAR.AVATAR_STROKE_HEX_UNMUTED;
            }
        } else {
            normalModeCTX.strokeStyle = AVATAR.AVATAR_STROKE_HEX_UNMUTED;
        }
        normalModeCTX.stroke();
        normalModeCTX.fill();
        normalModeCTX.closePath();
        normalModeCTX.rotate(-amtToRotateAvatar);
    }

    drawAvatarVideo({ userData }: { userData: UserData }) {
        if (videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            let normalModeCTX = this.normalModeCTX;
            let avatarRadiusM = AVATAR.RADIUS_M;
            let avatarRadiusPX = avatarRadiusM * physicsController.pxPerMCurrent;

            let amtToRotateVideo = this.canvasRotationDegrees * Math.PI / 180;
            normalModeCTX.rotate(amtToRotateVideo);
            normalModeCTX.save();
            normalModeCTX.clip();
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                normalModeCTX.scale(-1, 1);
            }
            normalModeCTX.drawImage(videoController.providedUserIDToVideoElementMap.get(userData.providedUserID), -avatarRadiusPX, -avatarRadiusPX, avatarRadiusPX * 2, avatarRadiusPX * 2);
            normalModeCTX.restore();
            normalModeCTX.rotate(-amtToRotateVideo);
        }
    }

    drawAvatarLabel({ userData }: { userData: UserData }) {
        // Don't draw the avatar label if we're drawing that avatar's video.
        if (videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            return;
        }

        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;
        let avatarRadiusM = AVATAR.RADIUS_M;

        let amtToRotateAvatarLabel = this.canvasRotationDegrees * Math.PI / 180;
        normalModeCTX.rotate(amtToRotateAvatarLabel);

        normalModeCTX.font = AVATAR.AVATAR_LABEL_FONT;
        normalModeCTX.fillStyle = Utilities.getConstrastingTextColor(Utilities.hexToRGB(userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash)));
        normalModeCTX.textAlign = "center";
        normalModeCTX.textBaseline = "middle";

        let textToDraw = userData.displayName && userData.displayName.length > 0 ? userData.displayName : userData.providedUserID;
        let textMetrics = normalModeCTX.measureText(textToDraw);
        let avatarRadiusPX = avatarRadiusM * pxPerM;
        if (textMetrics.width > avatarRadiusPX + 5) {
            textToDraw = Utilities.getInitials(textToDraw);
        }

        normalModeCTX.fillText(textToDraw, 0, 0);
        normalModeCTX.rotate(-amtToRotateAvatarLabel);
    }

    drawTutorialGlow() {
        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;

        let tutorialRadiusPX = AVATAR.TUTORIAL_RADIUS_M * pxPerM;

        normalModeCTX.beginPath();
        normalModeCTX.arc(0, 0, tutorialRadiusPX, 0, 2 * Math.PI);
        let grad = normalModeCTX.createRadialGradient(0, 0, 0, 0, 0, tutorialRadiusPX);
        grad.addColorStop(0.0, AVATAR.AVATAR_TUTORIAL_GLOW_HEX);
        grad.addColorStop(0.75, AVATAR.AVATAR_TUTORIAL_GLOW_HEX + "00");
        normalModeCTX.fillStyle = grad;
        normalModeCTX.fill();
        normalModeCTX.closePath();
    }

    drawTutorialText() {
        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;

        let amtToRotateTutorialText = this.canvasRotationDegrees * Math.PI / 180;
        normalModeCTX.rotate(amtToRotateTutorialText);

        normalModeCTX.font = UI.TUTORIAL_TEXT_FONT;
        normalModeCTX.fillStyle = UI.TUTORIAL_TEXT_COLOR;
        normalModeCTX.lineWidth = UI.TUTORIAL_TEXT_STROKE_WIDTH_PX;
        normalModeCTX.strokeStyle = UI.TUTORIAL_TEXT_STROKE_COLOR;

        normalModeCTX.textAlign = "right";
        let textToDraw = "This is you.";
        normalModeCTX.fillText(textToDraw, -AVATAR.RADIUS_M * pxPerM - 25, 0);
        normalModeCTX.strokeText(textToDraw, -AVATAR.RADIUS_M * pxPerM - 25, 0);

        normalModeCTX.textAlign = "left";
        textToDraw = "Try clicking yourself.";
        normalModeCTX.fillText(textToDraw, AVATAR.RADIUS_M * pxPerM + 25, 0);
        normalModeCTX.strokeText(textToDraw, AVATAR.RADIUS_M * pxPerM + 25, 0);

        normalModeCTX.rotate(-amtToRotateTutorialText);
    }

    drawAvatar({ userData }: { userData: UserData }) {
        if (!userData || !userData.positionCurrent || userData.positionCurrent.x === undefined || userData.positionCurrent.z === undefined) {
            return;
        }

        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;

        normalModeCTX.translate(userData.positionCurrent.x * pxPerM, userData.positionCurrent.z * pxPerM);

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

        normalModeCTX.translate(-userData.positionCurrent.x * pxPerM, -userData.positionCurrent.z * pxPerM);
    }

    drawTableOrRoomGraphic(room: SpatialAudioRoom) {
        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;
        
        normalModeCTX.translate(room.roomCenter.x * pxPerM, room.roomCenter.z * pxPerM);
        let amtToRotateRoom = room.roomYawOrientationDegrees * Math.PI / 180;
        normalModeCTX.rotate(amtToRotateRoom);

        let usingRoomImage = false;
        if (room.roomImage && room.roomImage.image.complete && room.roomImage.loaded) {
            usingRoomImage = true;
            let roomDimensionsPX = {
                "x": room.dimensions.x * pxPerM,
                "z": room.dimensions.z * pxPerM
            };
            normalModeCTX.drawImage(room.roomImage.image, -roomDimensionsPX.x / 2, -roomDimensionsPX.z / 2, roomDimensionsPX.x, roomDimensionsPX.z);
        }

        normalModeCTX.translate((room.seatingCenter.x - room.roomCenter.x) * pxPerM, (room.seatingCenter.z - room.roomCenter.z) * pxPerM);
        
        if (!usingRoomImage) {
            let tableRadiusPX = (room.seatingRadiusM - AVATAR.RADIUS_M * AVATAR.MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER) * pxPerM;

            normalModeCTX.lineWidth = ROOM.TABLE_STROKE_WIDTH_PX;
            normalModeCTX.fillStyle = room.tableColorHex;
            normalModeCTX.beginPath();
            normalModeCTX.arc(0, 0, tableRadiusPX, 0, 2 * Math.PI);
            normalModeCTX.strokeStyle = ROOM.TABLE_STROKE_HEX;
            normalModeCTX.stroke();
            normalModeCTX.fill();
            normalModeCTX.closePath();

            normalModeCTX.drawImage(tableImage, -tableRadiusPX, -tableRadiusPX, tableRadiusPX * 2, tableRadiusPX * 2);
        }

        let amtToRotateRoomLabel = (this.canvasRotationDegrees - room.roomYawOrientationDegrees) * Math.PI / 180;
        normalModeCTX.rotate(amtToRotateRoomLabel);
        normalModeCTX.font = ROOM.ROOM_LABEL_FONT;
        normalModeCTX.fillStyle = usingRoomImage ? ROOM.ROOM_WITH_IMAGE_LABEL_COLOR : Utilities.getConstrastingTextColor(Utilities.hexToRGB(room.tableColorHex));
        normalModeCTX.textAlign = "center";
        normalModeCTX.textBaseline = "middle";
        let textMetrics = normalModeCTX.measureText(room.name);
        if (textMetrics.width < Math.min(room.seatingRadiusM * pxPerM, room.seatingRadiusM * pxPerM)) {
            normalModeCTX.fillText(room.name, 0, 0);
        }
        normalModeCTX.rotate(-amtToRotateRoomLabel);

        normalModeCTX.translate(-(room.seatingCenter.x - room.roomCenter.x) * pxPerM, -(room.seatingCenter.z - room.roomCenter.z) * pxPerM);

        normalModeCTX.rotate(-amtToRotateRoom);
        normalModeCTX.translate(-room.roomCenter.x * pxPerM, -room.roomCenter.z * pxPerM);
    }

    drawUnoccupiedSeat(seat: SpatialAudioSeat) {
        // Don't draw unoccupied seats if the seats are too small (determined by `userInputController.zoomedOutTooFarToRenderSeats`).
        if (userInputController.zoomedOutTooFarToRenderSeats) {
            return;
        }

        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;
        normalModeCTX.translate(seat.position.x * pxPerM, seat.position.z * pxPerM);
        let amountToRotateSeatImage = this.canvasRotationDegrees * Math.PI / 180;
        normalModeCTX.rotate(amountToRotateSeatImage);

        const seatRadiusPX = ROOM.SEAT_RADIUS_M * pxPerM;
        if (userInputController.hoveredSeat && userInputController.hoveredSeat.seatID === seat.seatID) {
            normalModeCTX.drawImage(seatIconHover, -seatRadiusPX, -seatRadiusPX, seatRadiusPX * 2, seatRadiusPX * 2);
        } else {
            normalModeCTX.drawImage(seatIconIdle, -seatRadiusPX, -seatRadiusPX, seatRadiusPX * 2, seatRadiusPX * 2);
        }

        normalModeCTX.rotate(-amountToRotateSeatImage);
        normalModeCTX.translate(-seat.position.x * pxPerM, -seat.position.z * pxPerM);
    }

    maybeDrawScrim() {
        if (this.canvasScrimOpacity > 0.0) {
            let normalModeCTX = this.normalModeCTX;
            this.unTranslateAndRotateCanvas();

            normalModeCTX.fillStyle = `rgba(0, 0, 0, ${this.canvasScrimOpacity})`;
            normalModeCTX.beginPath();
            normalModeCTX.rect(0, 0, this.normalModeCanvas.width, this.normalModeCanvas.height);
            normalModeCTX.fill();
            normalModeCTX.closePath();

            this.translateAndRotateCanvas();
        }
    }

    drawRooms() {
        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;

        if (!(seatIconIdle.complete && tableImage.complete && normalModeCTX && pxPerM)) {
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

        const normalModeCTX = this.normalModeCTX;
        const pxPerM = physicsController.pxPerMCurrent;
    
        particleController.activeParticles.forEach((particle) => {
            if (!particle.currentWorldPositionM.x || !particle.currentWorldPositionM.z ||
                !particle.dimensionsM.x || !particle.dimensionsM.z ||
                !particle.image.complete) {
                return;
            }    
            normalModeCTX.translate(particle.currentWorldPositionM.x * pxPerM, particle.currentWorldPositionM.z * pxPerM);
            let amtToRotateParticle = this.canvasRotationDegrees * Math.PI / 180;
            normalModeCTX.rotate(amtToRotateParticle);
    
            let oldAlpha = normalModeCTX.globalAlpha;
            normalModeCTX.globalAlpha = particle.opacity;
    
            normalModeCTX.drawImage(
                particle.image,
                -particle.dimensionsM.x * pxPerM / 2,
                -particle.dimensionsM.z * pxPerM / 2,
                particle.dimensionsM.x * pxPerM,
                particle.dimensionsM.z * pxPerM);
    
            normalModeCTX.globalAlpha = oldAlpha;
            normalModeCTX.rotate(-amtToRotateParticle);
            normalModeCTX.translate(-particle.currentWorldPositionM.x * pxPerM, -particle.currentWorldPositionM.z * pxPerM);
        });
    }

    drawNormalMode() {
        let normalModeCTX = this.normalModeCTX;
        normalModeCTX.clearRect(0, 0, this.normalModeCanvas.width, this.normalModeCanvas.height);

        const myUserData = userDataController.myAvatar.myUserData;
        this.canvasRotationDegrees = -1 * userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees;

        let pxPerM = physicsController.pxPerMCurrent;

        const normalCameraOffsetYPX = this.normalModeCanvas.height / 2 - UI.AVATAR_PADDING_FOR_CAMERA * pxPerM;

        if (this.cameraOffsetYPX === undefined) {
            this.cameraOffsetYPX = normalCameraOffsetYPX;
        }

        this.cameraPositionNoOffsetM = userDataController.myAvatar.myUserData.positionCurrent;
        const currentRoom = myUserData.currentRoom;
        if (currentRoom) {
            let scaledOffsetPX = Utilities.linearScale(pxPerM, physicsController.pxPerMMin, physicsController.pxPerMMax, 0, normalCameraOffsetYPX, true);
            this.cameraOffsetYPX = scaledOffsetPX;
        }

        this.canvasOffsetPX = {
            x: this.normalModeCanvas.width / 2 - this.cameraPositionNoOffsetM.x * pxPerM,
            y: this.normalModeCanvas.height / 2 - this.cameraPositionNoOffsetM.z * pxPerM + this.cameraOffsetYPX
        };

        this.translateAndRotateCanvas();
        this.drawRooms();
        this.drawParticles();
        this.unTranslateAndRotateCanvas();
    }

    drawWatchPartyMode() {
        watchPartyController.draw();
    }

    draw() {
        const myUserData = userDataController.myAvatar.myUserData;
        if (!(myUserData.positionCurrent && myUserData.orientationEulerCurrent)) {
            return;
        }

        if (userDataController.myAvatar.currentMode === MyAvatarModes.Normal) {
            this.drawNormalMode();
        } else if (userDataController.myAvatar.currentMode === MyAvatarModes.WatchParty) {
            this.drawWatchPartyMode();
        }
    }

    translateAndRotateCanvas() {
        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;

        if (!this.cameraPositionNoOffsetM) {
            return;
        }

        normalModeCTX.translate(this.canvasOffsetPX.x, this.canvasOffsetPX.y);
        normalModeCTX.translate(this.cameraPositionNoOffsetM.x * pxPerM, this.cameraPositionNoOffsetM.z * pxPerM);
        normalModeCTX.rotate(-this.canvasRotationDegrees * Math.PI / 180);
        normalModeCTX.translate(-this.cameraPositionNoOffsetM.x * pxPerM, -this.cameraPositionNoOffsetM.z * pxPerM);
    }

    unTranslateAndRotateCanvas() {
        let normalModeCTX = this.normalModeCTX;
        let pxPerM = physicsController.pxPerMCurrent;

        if (!this.cameraPositionNoOffsetM) {
            return;
        }

        normalModeCTX.translate(this.cameraPositionNoOffsetM.x * pxPerM, this.cameraPositionNoOffsetM.z * pxPerM);
        normalModeCTX.rotate(this.canvasRotationDegrees * Math.PI / 180);
        normalModeCTX.translate(-this.cameraPositionNoOffsetM.x * pxPerM, -this.cameraPositionNoOffsetM.z * pxPerM);
        normalModeCTX.translate(-this.canvasOffsetPX.x, -this.canvasOffsetPX.y);
    }
}
import '../../css/watchParty.scss';
import { connectionController, roomController, uiController, userDataController, userInputController, videoController, webSocketConnectionController } from "..";
import { SpatialAudioRoom } from "./RoomController";
import { MyAvatarModes, UserData } from "../userData/UserDataController";
import { Utilities } from '../utilities/Utilities';
import { AVATAR, UI } from '../constants/constants';
import { OrientationEuler3D } from 'hifi-spatial-audio';

declare var HIFI_SPACE_NAME: string;
declare var YT: any;

const CHECK_PLAYER_TIME_TIMEOUT_MS = 1000;

export class WatchPartyController {
    normalModeCanvas: HTMLCanvasElement;
    watchPartyModeCanvas: HTMLCanvasElement;
    watchPartyModeCTX: CanvasRenderingContext2D;
    seekTimeout: NodeJS.Timeout;
    lastPlayerTime: number = -1;
    youTubePlayer: any;
    currentWatchPartyRoom: SpatialAudioRoom;
    pxPerM: number;
    toggleJoinWatchPartyButton: HTMLButtonElement;
    currentYouTubeVideoID: string;
    hoveredUserData: UserData;

    constructor() {
        this.normalModeCanvas = document.querySelector(".normalModeCanvas");

        this.watchPartyModeCanvas = document.createElement("canvas");
        this.watchPartyModeCanvas.tabIndex = 1;
        this.watchPartyModeCanvas.classList.add("watchPartyModeCanvas", "displayNone");
        document.body.appendChild(this.watchPartyModeCanvas);
        this.watchPartyModeCTX = this.watchPartyModeCanvas.getContext("2d");
        
        this.watchPartyModeCanvas.addEventListener("click", this.handleCanvasClick.bind(this));
        if (window.PointerEvent) {
            this.watchPartyModeCanvas.addEventListener('pointerdown', this.handleGestureOnCanvasStart.bind(this), true);
            this.watchPartyModeCanvas.addEventListener('pointermove', this.handleGestureOnCanvasMove.bind(this), true);
            this.watchPartyModeCanvas.addEventListener('pointerup', this.handleGestureOnCanvasEnd.bind(this), true);
            this.watchPartyModeCanvas.addEventListener("pointerout", this.handleGestureOnCanvasCancel.bind(this), true);
        } else {
            this.watchPartyModeCanvas.addEventListener('touchstart', this.handleGestureOnCanvasStart.bind(this), true);
            this.watchPartyModeCanvas.addEventListener('touchmove', this.handleGestureOnCanvasMove.bind(this), true);
            this.watchPartyModeCanvas.addEventListener('touchend', this.handleGestureOnCanvasEnd.bind(this), true);
            this.watchPartyModeCanvas.addEventListener("touchcancel", this.handleGestureOnCanvasCancel.bind(this), true);

            this.watchPartyModeCanvas.addEventListener("mousedown", this.handleGestureOnCanvasStart.bind(this), true);
        }
        this.watchPartyModeCanvas.addEventListener("gesturestart", (e) => { e.preventDefault(); }, false);
        this.watchPartyModeCanvas.addEventListener("gesturechange", (e) => { e.preventDefault(); }, false);
        this.watchPartyModeCanvas.addEventListener("gestureend", (e) => { e.preventDefault(); }, false);
        this.watchPartyModeCanvas.addEventListener("contextmenu", (e) => { e.preventDefault(); }, false);

        window.addEventListener("resize", this.updateWatchPartyCanvasDimensions.bind(this));
        this.updateWatchPartyCanvasDimensions();
        
        this.toggleJoinWatchPartyButton = document.querySelector('.toggleJoinWatchPartyButton');
        this.toggleJoinWatchPartyButton.addEventListener("click", (e) => {
            if (this.currentWatchPartyRoom) {
                this.leaveWatchParty();
            } else {
                this.joinWatchParty(userDataController.myAvatar.myUserData.currentRoom);
            }
        });

        let youTubePlayerElement = document.createElement("div");
        youTubePlayerElement.classList.add("youTubePlayerElement", "displayNone");
        youTubePlayerElement.id = "youTubePlayerElement";
        document.body.appendChild(youTubePlayerElement);

        document.addEventListener('paste', (event) => {
            let paste = event.clipboardData.getData('text');
            let url;
            try {
                url = new URL(paste);
            } catch (e) {
                return;
            }

            this.maybeEnqueueNewVideo(url);
        });

        if (!webSocketConnectionController.socket) {
            console.error(`Couldn't get \`webSocketConnectionController.socket\`! Watch Parties won't work.`);
            return;
        }

        let tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        let firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        (window as any).onYouTubeIframeAPIReady = () => {
            this.createYouTubePlayer();
        }

        webSocketConnectionController.socket.on("watchNewYouTubeVideo", (roomName: string, youTubeVideoID: string, seekTimeSeconds: number, playerState: number) => {
            if (!this.currentWatchPartyRoom || this.currentWatchPartyRoom.name !== roomName || this.currentYouTubeVideoID === youTubeVideoID) {
                return;
            }

            console.log(`Loading YouTube video with ID \`${youTubeVideoID}\` at ${seekTimeSeconds}s...`);
            this.youTubePlayer.loadVideoById(youTubeVideoID, seekTimeSeconds);
            this.currentYouTubeVideoID = youTubeVideoID;
            
            this.stopSeekDetector();
            this.seekTimeout = setTimeout(this.runSeekDetector.bind(this), CHECK_PLAYER_TIME_TIMEOUT_MS); // Delay the detector start.

            if (playerState !== 1) { // YT.PlayerState.PLAYING
                this.videoPause(roomName, undefined, seekTimeSeconds);
            }
        });

        webSocketConnectionController.socket.on("videoSeek", (roomName: string, visitIDHash: string, seekTimeSeconds: number) => {
            if (!this.currentWatchPartyRoom || this.currentWatchPartyRoom.name !== roomName) {
                return;
            }

            this.stopSeekDetector();
            this.seekTimeout = setTimeout(this.runSeekDetector.bind(this), CHECK_PLAYER_TIME_TIMEOUT_MS); // Delay the detector start.
            console.log(`\`${visitIDHash}\` requested video seek to ${seekTimeSeconds} seconds.`);
            this.youTubePlayer.seekTo(seekTimeSeconds);
        });

        webSocketConnectionController.socket.on("videoPause", (roomName: string, visitIDHash: string, seekTimeSeconds: number) => {
            this.videoPause(roomName, visitIDHash, seekTimeSeconds);
        });

        webSocketConnectionController.socket.on("videoPlay", (roomName: string, visitIDHash: string, seekTimeSeconds: number) => {
            this.videoPlay(roomName, visitIDHash, seekTimeSeconds);
        });

        webSocketConnectionController.socket.on("videoClear", (roomName: string, visitIDHash: string) => {
            this.videoClear(roomName, visitIDHash);
        });
    }    

    handleCanvasClick(event: TouchEvent | MouseEvent | PointerEvent) {
        if (this.hoveredUserData) {
            uiController.showAvatarContextMenu(this.hoveredUserData);
            this.hoveredUserData = undefined;
        }

        document.body.classList.remove("cursorPointer");
    }

    handleGestureOnCanvasStart(event: TouchEvent | MouseEvent | PointerEvent) {
        event.preventDefault();

        roomController.hideRoomList();
        uiController.hideAvatarContextMenu();
        userInputController.hideSettingsMenu();

        let target = <HTMLElement>event.target;

        target.focus();

        if (window.PointerEvent && event instanceof PointerEvent) {
            target.setPointerCapture(event.pointerId);
        } else {
            this.normalModeCanvas.addEventListener('mousemove', this.handleGestureOnCanvasMove.bind(this), true);
            this.normalModeCanvas.addEventListener('mouseup', this.handleGestureOnCanvasEnd.bind(this), true);
        }
    }

    handleGestureOnCanvasMove(event: MouseEvent | PointerEvent) {
        event.preventDefault();

        return;

        // TODO: Implement the below so users can hover over avatars in the small canvas

        // let hoverM = Utilities.watchPartyModeCanvasPXToM({ x: event.offsetX, y: event.offsetY });

        // if (!(hoverM && userDataController.myAvatar.myUserData.positionCurrent)) {
        //     return;
        // }

        // this.hoveredUserData = userDataController.allOtherUserData.find((userData) => {
        //     return userData.positionCurrent && Utilities.getDistanceBetween2DPoints(userData.positionCurrent.x, userData.positionCurrent.z, hoverM.x, hoverM.z) < AVATAR.RADIUS_M;
        // });

        // if (!this.hoveredUserData && Utilities.getDistanceBetween2DPoints(userDataController.myAvatar.myUserData.positionCurrent.x, userDataController.myAvatar.myUserData.positionCurrent.z, hoverM.x, hoverM.z) < AVATAR.RADIUS_M) {
        //     this.hoveredUserData = userDataController.myAvatar.myUserData;
        // }

        // if (this.hoveredUserData) {
        //     document.body.classList.add("cursorPointer");
        // } else {
        //     document.body.classList.remove("cursorPointer");
        // }
    }

    handleGestureOnCanvasEnd(event: MouseEvent | PointerEvent) {
        event.preventDefault();

        let target = <HTMLElement>event.target;

        // Remove Event Listeners
        if (window.PointerEvent) {
            if (event instanceof PointerEvent && event.pointerId) {
                target.releasePointerCapture(event.pointerId);
            }
        } else {
            // Remove Mouse Listeners
            this.normalModeCanvas.removeEventListener('mousemove', this.handleGestureOnCanvasMove, true);
            this.normalModeCanvas.removeEventListener('mouseup', this.handleGestureOnCanvasEnd, true);
        }
    }

    handleGestureOnCanvasCancel(event: MouseEvent | PointerEvent) {
        this.handleGestureOnCanvasEnd(event);
    }

    videoPlay(roomName: string, visitIDHash: string, seekTimeSeconds: number) {
        if (!this.currentWatchPartyRoom || this.currentWatchPartyRoom.name !== roomName || this.youTubePlayer.getPlayerState() === YT.PlayerState.PLAYING) {
            return;
        }

        this.stopSeekDetector();
        this.seekTimeout = setTimeout(this.runSeekDetector.bind(this), CHECK_PLAYER_TIME_TIMEOUT_MS); // Delay the detector start.
        console.log(`\`${visitIDHash || "Someone"}\` started playing the video at ${seekTimeSeconds}s.`);
        this.youTubePlayer.seekTo(seekTimeSeconds);
        this.youTubePlayer.playVideo();
    }

    videoPause(roomName: string, visitIDHash: string, seekTimeSeconds: number) {
        if (!this.currentWatchPartyRoom || this.currentWatchPartyRoom.name !== roomName) {
            return;
        }

        this.stopSeekDetector();
        console.log(`\`${visitIDHash}\` paused the video at ${seekTimeSeconds}s.`);
        this.youTubePlayer.pauseVideo();
    }

    resetMouthOrientation() {
        let lockedYawDegrees = userDataController.myAvatar.myUserData.currentSeat.orientation.yawDegrees;
        userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees = lockedYawDegrees;
        let hifiCommunicator = connectionController.hifiCommunicator;
        if (hifiCommunicator) {
            hifiCommunicator.updateUserDataAndTransmit({ orientationEuler: new OrientationEuler3D({ yawDegrees: lockedYawDegrees }) });
        }
    }

    joinWatchParty(watchPartyRoom: SpatialAudioRoom) {
        if (!watchPartyRoom) {
            return;
        }

        console.log(`User joined the Watch Party in the room named ${watchPartyRoom.name}!`);
        this.currentWatchPartyRoom = watchPartyRoom;
        userDataController.myAvatar.currentMode = MyAvatarModes.WatchParty;
        this.normalModeCanvas.classList.add("displayNone");
        this.watchPartyModeCanvas.classList.remove("displayNone");
        document.querySelector(".youTubePlayerElement").classList.remove("displayNone");
        document.querySelector(".zoomUIContainer").classList.add("displayNone");
        document.querySelector(".signalButtonContainer").classList.add("displayNone");
        webSocketConnectionController.socket.emit("watchPartyUserJoined", userDataController.myAvatar.myUserData.visitIDHash, HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);
        this.resetMouthOrientation();
        roomController.hideRoomList();
    }

    leaveWatchParty() {
        if (!this.currentWatchPartyRoom) {
            return;
        }
        this.videoClear(this.currentWatchPartyRoom.name, userDataController.myAvatar.myUserData.visitIDHash);
        console.log(`User left the Watch Party!`);
        webSocketConnectionController.socket.emit("watchPartyUserLeft", userDataController.myAvatar.myUserData.visitIDHash);
        this.currentWatchPartyRoom = undefined;
        userDataController.myAvatar.currentMode = MyAvatarModes.Normal;
        this.normalModeCanvas.classList.remove("displayNone");
        this.watchPartyModeCanvas.classList.add("displayNone");
        document.querySelector(".youTubePlayerElement").classList.add("displayNone");
        document.querySelector(".zoomUIContainer").classList.remove("displayNone");
        document.querySelector(".signalButtonContainer").classList.remove("displayNone");
    }

    onPlayerReady(event: any) {
    }

    onPlayerError(event: any) {
    }

    onPlayerStateChange(event: any) {
        if (!this.currentWatchPartyRoom) {
            return;
        }

        switch (event.data) {
            case (YT.PlayerState.PLAYING):
            case (YT.PlayerState.PAUSED):
                this.stopSeekDetector();
                this.seekTimeout = setTimeout(this.runSeekDetector.bind(this), CHECK_PLAYER_TIME_TIMEOUT_MS); // Delay the detector start.
                break;
            case (YT.PlayerState.ENDED):
                webSocketConnectionController.socket.emit("youTubeVideoEnded", userDataController.myAvatar.myUserData.visitIDHash, HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);
                break;
            default:
                return;
        }

        let seekTimeSeconds = this.youTubePlayer.getCurrentTime();
        console.log(`New YouTube Player State: ${event.data}. Seek time: ${seekTimeSeconds}s`);

        webSocketConnectionController.socket.emit("newPlayerState", userDataController.myAvatar.myUserData.visitIDHash, event.data, seekTimeSeconds, HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);
    }

    maybeEnqueueNewVideo(url: URL) {
        if (!(webSocketConnectionController.socket && webSocketConnectionController.socket.connected && this.currentWatchPartyRoom)) {
            return;
        }

        let youTubeVideoID;
        if (url.hostname === "youtu.be") {
            youTubeVideoID = url.pathname.substr(1);
        } else if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
            const params = new URLSearchParams(url.search);
            youTubeVideoID = params.get("v");
        }

        if (youTubeVideoID && youTubeVideoID.length > 1) {
            console.log(`User pasted YouTube video URL!\n${url}`);
            webSocketConnectionController.socket.emit("enqueueNewVideo", userDataController.myAvatar.myUserData.visitIDHash, url, HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);
            return true;
        }

        return false;
    }

    runSeekDetector() {
        this.seekTimeout = undefined;

        if (!this.currentWatchPartyRoom) {
            this.stopSeekDetector();
            return;
        }

        if (this.lastPlayerTime !== -1) {
            if (this.youTubePlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                let currentTime = this.youTubePlayer.getCurrentTime();

                webSocketConnectionController.socket.emit("setSeekTime", userDataController.myAvatar.myUserData.visitIDHash, currentTime, HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);

                // Expecting 1 second interval with 500ms margin of error
                if (Math.abs(currentTime - this.lastPlayerTime - 1) > 0.5) {
                    // A seek probably happened!
                    console.log(`Seek detected! Requesting video seek to ${currentTime}s...`);
                    webSocketConnectionController.socket.emit("requestVideoSeek", userDataController.myAvatar.myUserData.visitIDHash, currentTime, HIFI_SPACE_NAME);
                }
            }
        } else {
            console.log(`Starting video seek detector...`);
        }

        this.lastPlayerTime = this.youTubePlayer.getCurrentTime();

        this.seekTimeout = setTimeout(this.runSeekDetector.bind(this), CHECK_PLAYER_TIME_TIMEOUT_MS);
    }

    createYouTubePlayer() {
        this.youTubePlayer = new YT.Player('youTubePlayerElement', {
            height: '100%',
            width: '100%',
            playerVars: { 'autoplay': false, 'controls': true, 'modestbranding': true, 'origin': "https://experiments.highfidelity.com", 'playsinline': 1 },
            events: {
                'onReady': this.onPlayerReady.bind(this),
                'onStateChange': this.onPlayerStateChange.bind(this),
                'onError': this.onPlayerError.bind(this)
            }
        });
    }
    
    videoClear(roomName: string, visitIDHash: string) {
        if (!this.currentWatchPartyRoom || this.currentWatchPartyRoom.name !== roomName) {
            return;
        }

        console.log(`\`${visitIDHash}\` requested that the video be cleared.`);
        
        this.currentYouTubeVideoID = undefined;

        this.stopSeekDetector();
        this.youTubePlayer.stopVideo();

        this.youTubePlayer.destroy();
        this.createYouTubePlayer();
        
        document.querySelector(".youTubePlayerElement").classList.remove("displayNone");

        this.stopSeekDetector();
    }

    stopSeekDetector() {
        if (this.seekTimeout) {
            clearTimeout(this.seekTimeout);
        }
        this.seekTimeout = undefined;
        this.lastPlayerTime = -1;
    }

    updateWatchPartyCanvasDimensions() {
        this.watchPartyModeCanvas.width = window.innerWidth;
        this.watchPartyModeCanvas.height = 150; // Must be the same as $watch-party-mode-canvas-height.

        this.pxPerM = this.watchPartyModeCanvas.height / (AVATAR.RADIUS_M + UI.HOVER_HIGHLIGHT_RADIUS_ADDITION_M) / 2;
    }

    drawVolumeBubble({ userData }: { userData: UserData }) {
        if (userData.volumeDecibels < userData.volumeThreshold) {
            return;
        }
        let pxPerM = this.pxPerM;
        let watchPartyModeCTX = this.watchPartyModeCTX;
        watchPartyModeCTX.beginPath();
        watchPartyModeCTX.arc(0, 0, Utilities.linearScale(userData.volumeDecibels, AVATAR.MIN_VOLUME_DB, AVATAR.MAX_VOLUME_DB, AVATAR.RADIUS_M, AVATAR.RADIUS_M * AVATAR.MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER) * pxPerM, 0, 2 * Math.PI);
        watchPartyModeCTX.fillStyle = userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash);
        watchPartyModeCTX.fill();
        watchPartyModeCTX.closePath();
    }

    drawAvatarBase({ userData }: { userData: UserData }) {
        let isMine = userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash;
        let watchPartyModeCTX = this.watchPartyModeCTX;
        let pxPerM = this.pxPerM;
        let avatarRadiusM = AVATAR.RADIUS_M;
        let avatarRadiusPX = avatarRadiusM * pxPerM;

        if (roomController.currentlyHoveringOverVisitIDHash === userData.visitIDHash || (userInputController.hoveredUserData && userInputController.hoveredUserData.visitIDHash === userData.visitIDHash)) {
            watchPartyModeCTX.beginPath();
            watchPartyModeCTX.arc(0, 0, (avatarRadiusM + UI.HOVER_HIGHLIGHT_RADIUS_ADDITION_M) * pxPerM, 0, 2 * Math.PI);
            let grad = watchPartyModeCTX.createRadialGradient(0, 0, 0, 0, 0, (avatarRadiusM + UI.HOVER_HIGHLIGHT_RADIUS_ADDITION_M) * pxPerM);
            grad.addColorStop(0.0, UI.HOVER_GLOW_HEX);
            grad.addColorStop(1.0, UI.HOVER_GLOW_HEX + "00");
            watchPartyModeCTX.fillStyle = grad;
            watchPartyModeCTX.fill();
            watchPartyModeCTX.closePath();
        }

        let colorHex = userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash);

        watchPartyModeCTX.lineWidth = AVATAR.STROKE_WIDTH_PX;
        watchPartyModeCTX.fillStyle = colorHex;
        watchPartyModeCTX.beginPath();
        watchPartyModeCTX.arc(0, 0, avatarRadiusPX, 0, 2 * Math.PI);
        if (isMine) {
            if (userData.isMuted) {
                watchPartyModeCTX.strokeStyle = AVATAR.AVATAR_STROKE_HEX_MUTED;
            } else {
                watchPartyModeCTX.strokeStyle = AVATAR.AVATAR_STROKE_HEX_UNMUTED;
            }
        } else {
            watchPartyModeCTX.strokeStyle = AVATAR.AVATAR_STROKE_HEX_UNMUTED;
        }
        watchPartyModeCTX.stroke();
        watchPartyModeCTX.fill();
        watchPartyModeCTX.closePath();
    }

    drawAvatarVideo({ userData }: { userData: UserData }) {
        if (videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            let watchPartyModeCTX = this.watchPartyModeCTX;
            let avatarRadiusM = AVATAR.RADIUS_M;
            let pxPerM = this.pxPerM;
            let avatarRadiusPX = avatarRadiusM * pxPerM;

            watchPartyModeCTX.save();
            watchPartyModeCTX.clip();
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                watchPartyModeCTX.scale(-1, 1);
            }
            watchPartyModeCTX.drawImage(videoController.providedUserIDToVideoElementMap.get(userData.providedUserID), -avatarRadiusPX, -avatarRadiusPX, avatarRadiusPX * 2, avatarRadiusPX * 2);
            watchPartyModeCTX.restore();
        }
    }

    drawAvatarLabel({ userData }: { userData: UserData }) {
        // Don't draw the avatar label if we're drawing that avatar's video.
        if (videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            return;
        }

        let watchPartyModeCTX = this.watchPartyModeCTX;
        let pxPerM = this.pxPerM;
        let avatarRadiusM = AVATAR.RADIUS_M;

        watchPartyModeCTX.font = AVATAR.AVATAR_LABEL_FONT;
        watchPartyModeCTX.fillStyle = Utilities.getConstrastingTextColor(Utilities.hexToRGB(userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash)));
        watchPartyModeCTX.textAlign = "center";
        watchPartyModeCTX.textBaseline = "middle";

        let textToDraw = userData.displayName && userData.displayName.length > 0 ? userData.displayName : userData.providedUserID;
        let textMetrics = watchPartyModeCTX.measureText(textToDraw);
        let avatarRadiusPX = avatarRadiusM * pxPerM;
        if (textMetrics.width > avatarRadiusPX + 5) {
            textToDraw = Utilities.getInitials(textToDraw);
        }

        watchPartyModeCTX.fillText(textToDraw, 0, 0);
    }

    drawAvatar({ userData }: { userData: UserData }) {
        this.drawVolumeBubble({ userData });
        this.drawAvatarBase({ userData });
        this.drawAvatarVideo({ userData });
        this.drawAvatarLabel({ userData });
    }

    draw() {
        let watchPartyModeCTX = this.watchPartyModeCTX;
        watchPartyModeCTX.clearRect(0, 0, this.watchPartyModeCanvas.width, this.watchPartyModeCanvas.height);

        let room = this.currentWatchPartyRoom;

        if (!room) {
            return;
        }

        let userDataInWatchPartyRoom = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        userDataInWatchPartyRoom = userDataInWatchPartyRoom.filter((userData) => {
            return userData.currentRoom === room;
        });

        userDataInWatchPartyRoom.sort((a, b) => {
            if (!(a.positionCurrent && b.positionCurrent)) {
                return 0;
            }

            let aRotated = Utilities.rotateAroundPoint(userDataController.myAvatar.myUserData.positionCurrent.x, userDataController.myAvatar.myUserData.positionCurrent.z, a.positionCurrent.x, a.positionCurrent.z, userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees * Math.PI / 180);
            let bRotated = Utilities.rotateAroundPoint(userDataController.myAvatar.myUserData.positionCurrent.x, userDataController.myAvatar.myUserData.positionCurrent.z, b.positionCurrent.x, b.positionCurrent.z, userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees * Math.PI / 180);

            if (aRotated[0] < bRotated[0]) {
                return -1;
            }
            if (aRotated[0] > bRotated[0]) {
                return 1;
            }
            return 0;
        });

        watchPartyModeCTX.translate(0, this.watchPartyModeCanvas.height / 2);
        let widthIncrementor = this.watchPartyModeCanvas.width / (userDataInWatchPartyRoom.length + 1);
        for (let i = 0; i < userDataInWatchPartyRoom.length; i++) {
            watchPartyModeCTX.translate(widthIncrementor, 0);
            this.drawAvatar({ userData: userDataInWatchPartyRoom[i] });
        }
        watchPartyModeCTX.translate(-widthIncrementor * userDataInWatchPartyRoom.length, -this.watchPartyModeCanvas.height / 2);
    }
}

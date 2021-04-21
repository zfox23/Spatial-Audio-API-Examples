import '../../css/watchParty.scss';
import { connectionController, userDataController, videoController, webSocketConnectionController } from "..";
import { SpatialAudioRoom } from "./RoomController";
import { MyAvatarModes, UserData } from "../userData/UserDataController";
import { Utilities } from '../utilities/Utilities';
import { AVATAR } from '../constants/constants';
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

    constructor() {
        this.normalModeCanvas = document.querySelector(".normalModeCanvas");

        this.watchPartyModeCanvas = document.createElement("canvas");
        this.watchPartyModeCanvas.classList.add("watchPartyModeCanvas", "displayNone");
        document.body.appendChild(this.watchPartyModeCanvas);
        this.watchPartyModeCTX = this.watchPartyModeCanvas.getContext("2d");

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
            this.youTubePlayer = new YT.Player('youTubePlayerElement', {
                height: '100%',
                width: '100%',
                playerVars: { 'autoplay': false, 'controls': true },
                events: {
                    'onReady': this.onPlayerReady.bind(this),
                    'onStateChange': this.onPlayerStateChange.bind(this),
                    'onError': this.onPlayerError.bind(this)
                }
            });
        }

        webSocketConnectionController.socket.on("watchNewYouTubeVideo", (roomName: string, youTubeVideoID: string, seekTimeSeconds: number) => {
            if (!this.currentWatchPartyRoom || this.currentWatchPartyRoom.name !== roomName) {
                return;
            }

            if (this.youTubePlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                return;
            }

            console.log(`Loading YouTube video with ID \`${youTubeVideoID}\`...`);
            this.youTubePlayer.loadVideoById(youTubeVideoID, seekTimeSeconds);

            this.stopSeekDetector();
            this.seekTimeout = setTimeout(this.runSeekDetector.bind(this), CHECK_PLAYER_TIME_TIMEOUT_MS); // Delay the detector start.
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
            if (!this.currentWatchPartyRoom || this.currentWatchPartyRoom.name !== roomName) {
                return;
            }

            this.stopSeekDetector();
            console.log(`\`${visitIDHash}\` paused the video.`);
            this.youTubePlayer.pauseVideo();
            this.youTubePlayer.seekTo(seekTimeSeconds);
        });

        webSocketConnectionController.socket.on("videoPlay", (roomName: string, visitIDHash: string, seekTimeSeconds: number) => {
            if (!this.currentWatchPartyRoom || this.currentWatchPartyRoom.name !== roomName) {
                return;
            }

            this.stopSeekDetector();
            this.seekTimeout = setTimeout(this.runSeekDetector.bind(this), CHECK_PLAYER_TIME_TIMEOUT_MS); // Delay the detector start.
            console.log(`\`${visitIDHash}\` started playing the video.`);
            this.youTubePlayer.seekTo(seekTimeSeconds);
            this.youTubePlayer.playVideo();
        });

        webSocketConnectionController.socket.on("stopVideoRequested", (roomName: string, visitIDHash: string) => {
            if (!this.currentWatchPartyRoom || this.currentWatchPartyRoom.name !== roomName) {
                return;
            }

            this.onStopVideoRequested(visitIDHash);
        });
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
    }

    leaveWatchParty() {
        if (!this.currentWatchPartyRoom) {
            return;
        }
        console.log(`User left the Watch Party!`);
        webSocketConnectionController.socket.emit("watchPartyUserLeft", userDataController.myAvatar.myUserData.visitIDHash);
        this.currentWatchPartyRoom = undefined;
        userDataController.myAvatar.currentMode = MyAvatarModes.Normal;
        this.normalModeCanvas.classList.remove("displayNone");
        this.watchPartyModeCanvas.classList.add("displayNone");
        document.querySelector(".youTubePlayerElement").classList.add("displayNone");
        document.querySelector(".zoomUIContainer").classList.remove("displayNone");
        document.querySelector(".signalButtonContainer").classList.remove("displayNone");
        this.youTubePlayer.stopVideo();
        this.stopSeekDetector();
    }

    onPlayerReady(event: any) {
    }

    onPlayerError(event: any) {
    }

    onPlayerStateChange(event: any) {
        if (!this.currentWatchPartyRoom) {
            return;
        }

        console.log(`New YouTube Player State: ${event.data}`);

        webSocketConnectionController.socket.emit("newPlayerState", userDataController.myAvatar.myUserData.visitIDHash, event.data, this.youTubePlayer.getCurrentTime(), HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);

        switch (event.data) {
            case (YT.PlayerState.PLAYING):
                break;
            case (YT.PlayerState.CUED):
                break;
        }
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

    stopSeekDetector() {
        if (this.seekTimeout) {
            clearTimeout(this.seekTimeout);
        }
        this.seekTimeout = undefined;
        this.lastPlayerTime = -1;
    }

    onStopVideoRequested(visitIDHash: string) {
        console.log(`\`${visitIDHash}\` requested that video playback be stopped.`);

        this.youTubePlayer.stopVideo();

        this.stopSeekDetector();
    }

    updateWatchPartyCanvasDimensions() {
        this.watchPartyModeCanvas.width = window.innerWidth;
        this.watchPartyModeCanvas.height = 100;

        this.pxPerM = this.watchPartyModeCanvas.height / AVATAR.RADIUS_M * AVATAR.MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER / 4;
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

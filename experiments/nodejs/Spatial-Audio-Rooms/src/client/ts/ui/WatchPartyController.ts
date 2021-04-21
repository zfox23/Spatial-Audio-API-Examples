import '../../css/watchParty.scss';
import { userDataController, webSocketConnectionController } from "..";
import { SpatialAudioRoom } from "./RoomController";
import { MyAvatarModes } from "../userData/UserDataController";

declare var HIFI_PROVIDED_USER_ID: string;
declare var HIFI_SPACE_NAME: string;
declare var YT: any;

const CHECK_PLAYER_TIME_TIMEOUT_MS = 1000;

export class WatchPartyController {
    normalModeCanvas: HTMLCanvasElement;
    watchPartyModeCanvas: HTMLCanvasElement;
    seekTimeout: NodeJS.Timeout;
    lastPlayerTime: number = -1;
    youTubePlayer: any;
    currentWatchPartyRoom: SpatialAudioRoom;

    constructor() {
        this.normalModeCanvas = document.querySelector(".normalModeCanvas");
        this.watchPartyModeCanvas = document.querySelector(".watchPartyModeCanvas");

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
            if (this.currentWatchPartyRoom.name !== roomName) {
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

        webSocketConnectionController.socket.on("videoSeek", (roomName: string, providedUserID: string, seekTimeSeconds: number) => {
            if (this.currentWatchPartyRoom.name !== roomName) {
                return;
            }

            this.stopSeekDetector();
            this.seekTimeout = setTimeout(this.runSeekDetector.bind(this), CHECK_PLAYER_TIME_TIMEOUT_MS); // Delay the detector start.
            console.log(`\`${providedUserID}\` requested video seek to ${seekTimeSeconds} seconds.`);
            this.youTubePlayer.seekTo(seekTimeSeconds);
        });

        webSocketConnectionController.socket.on("videoPause", (roomName: string, providedUserID: string, seekTimeSeconds: number) => {
            if (this.currentWatchPartyRoom.name !== roomName) {
                return;
            }

            this.stopSeekDetector();
            console.log(`\`${providedUserID}\` paused the video.`);
            this.youTubePlayer.pauseVideo();
            this.youTubePlayer.seekTo(seekTimeSeconds);
        });

        webSocketConnectionController.socket.on("videoPlay", (roomName: string, providedUserID: string, seekTimeSeconds: number) => {
            if (this.currentWatchPartyRoom.name !== roomName) {
                return;
            }

            this.stopSeekDetector();
            this.seekTimeout = setTimeout(this.runSeekDetector.bind(this), CHECK_PLAYER_TIME_TIMEOUT_MS); // Delay the detector start.
            console.log(`\`${providedUserID}\` started playing the video.`);
            this.youTubePlayer.seekTo(seekTimeSeconds);
            this.youTubePlayer.playVideo();
        });

        webSocketConnectionController.socket.on("stopVideoRequested", (roomName: string, providedUserID: string) => {
            if (this.currentWatchPartyRoom.name !== roomName) {
                return;
            }

            this.onStopVideoRequested(providedUserID);
        });
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
        webSocketConnectionController.socket.emit("watchPartyUserJoined", HIFI_PROVIDED_USER_ID, HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);
    }

    leaveWatchParty() {
        console.log(`User left the Watch Party!`);
        this.currentWatchPartyRoom = undefined;
        userDataController.myAvatar.currentMode = MyAvatarModes.Normal;
        this.normalModeCanvas.classList.remove("displayNone");
        this.watchPartyModeCanvas.classList.add("displayNone");
        document.querySelector(".youTubePlayerElement").classList.add("displayNone");
        document.querySelector(".zoomUIContainer").classList.remove("displayNone");
        document.querySelector(".signalButtonContainer").classList.remove("displayNone");
    }

    onPlayerReady(event: any){
    }
    
    onPlayerError(event: any) {
    }

    onPlayerStateChange(event: any) {
        if (!this.currentWatchPartyRoom) {
            return;
        }

        console.log(`New YouTube Player State: ${event.data}`);
    
        webSocketConnectionController.socket.emit("newPlayerState", HIFI_PROVIDED_USER_ID, event.data, this.youTubePlayer.getCurrentTime(), HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);
    
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
            webSocketConnectionController.socket.emit("enqueueNewVideo", HIFI_PROVIDED_USER_ID, url, HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);
            return true;
        }

        return false;
    }

    runSeekDetector() {
        this.seekTimeout = undefined;

        if (this.lastPlayerTime !== -1) {
            if (this.youTubePlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                let currentTime = this.youTubePlayer.getCurrentTime();

                webSocketConnectionController.socket.emit("setSeekTime", HIFI_PROVIDED_USER_ID, currentTime, HIFI_SPACE_NAME, this.currentWatchPartyRoom.name);

                // Expecting 1 second interval with 500ms margin of error
                if (Math.abs(currentTime - this.lastPlayerTime - 1) > 0.5) {
                    // A seek probably happened!
                    console.log(`Seek detected! Requesting video seek to ${currentTime}s...`);
                    webSocketConnectionController.socket.emit("requestVideoSeek", HIFI_PROVIDED_USER_ID, currentTime, HIFI_SPACE_NAME);
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

    onStopVideoRequested(providedUserID: string) {
        console.log(`\`${providedUserID}\` requested that video playback be stopped.`);

        this.youTubePlayer.stopVideo();

        this.stopSeekDetector();
    }
}

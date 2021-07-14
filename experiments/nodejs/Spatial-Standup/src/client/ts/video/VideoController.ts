import '../../css/screenShare.scss';
import * as Video from 'twilio-video';
import { avDevicesController, uiThemeController, userDataController, webSocketConnectionController } from '..';
import { VideoStreamingStates } from "../../../shared/shared";

declare var HIFI_SPACE_NAME: string;
declare var TWILIO_JWT: string;

export class VideoController {
    connectingToTwilio: boolean = false;
    toggleVideoButton: HTMLButtonElement;
    videoIsMuted: boolean;
    toggleScreenShareButton: HTMLButtonElement;
    screenShareIsMuted: boolean;
    twilioRoom: Video.Room;
    localVideoTrack: Video.LocalVideoTrack;
    providedUserIDToVideoElementMap: Map<string, HTMLVideoElement>;
    videoContainer: HTMLDivElement;

    constructor() {
        this.videoContainer = document.createElement("div");
        this.videoContainer.classList.add("videoContainer", "displayNone");
        document.body.appendChild(this.videoContainer);

        this.videoIsMuted = true;

        this.toggleVideoButton = document.querySelector('.toggleVideoButton');
        this.toggleVideoButton.addEventListener("click", async (e) => {
            await this.toggleVideo();
        });

        this.screenShareIsMuted = true;

        this.toggleScreenShareButton = document.querySelector('.toggleScreenShareButton');
        this.toggleScreenShareButton.addEventListener("click", async (e) => {
            await this.toggleScreenShare();
        });

        this.providedUserIDToVideoElementMap = new Map();
    }

    connectToTwilio() {
        if (!TWILIO_JWT || TWILIO_JWT.length === 0) {
            console.error(`Couldn't connect to Twilio: \`TWILIO_JWT\` is unspecified. The owner of this application has not provided Twilio authentication credentials.\nVideo conferencing in Spatial Standup will not function.`);
            return;
        }

        this.connectingToTwilio = true;
        console.log("Connecting to Twilio...");

        Video.connect(TWILIO_JWT, {
            name: HIFI_SPACE_NAME,
            video: false,
            audio: false
        }).then((twilioRoom: Video.Room) => {
            this.connectingToTwilio = false;
            this.twilioRoom = twilioRoom;
            console.log(`Connected to Twilio Room \`${this.twilioRoom.name}\`!`);

            this.twilioRoom.participants.forEach(this.participantConnected.bind(this));
            this.twilioRoom.on('participantConnected', this.participantConnected.bind(this));

            this.twilioRoom.on('trackUnpublished', this.trackUnpublished.bind(this));
            this.twilioRoom.on('participantDisconnected', this.participantDisconnected.bind(this));
            this.twilioRoom.once('disconnected', error => this.twilioRoom.participants.forEach(this.participantDisconnected.bind(this)));

            this.enableVideoButton();
            this.enableScreenShareButton();
            uiThemeController.refreshThemedElements();
        }, error => {
            this.connectingToTwilio = false;
            console.error(`Unable to connect to Room: ${error.message}`);
        });
    }

    disconnectFromTwilio() {
        this.providedUserIDToVideoElementMap.delete(userDataController.myAvatar.myUserData.providedUserID);

        if (this.localVideoTrack) {
            const mediaElements = this.localVideoTrack.detach();
            mediaElements.forEach(mediaElement => {
                mediaElement.remove();
            });
        }

        if (!this.twilioRoom) {
            return;
        }

        console.log(`Disconnecting from Twilio...`);
        this.twilioRoom.disconnect();
        this.twilioRoom = undefined;
    }

    disableVideoButton() {
        this.toggleVideoButton.classList.remove("toggleVideoButton--muted");
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleVideoButton, 'toggleVideoButton--unmuted', false);
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleVideoButton, 'toggleVideoButton--muted', false);
        this.toggleVideoButton.classList.add("toggleVideoButton--disabled");
        uiThemeController.refreshThemedElements();
    }

    enableVideoButton() {
        this.toggleVideoButton.classList.remove("toggleVideoButton--disabled");
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleVideoButton, 'toggleVideoButton--disabled', false);
        if (this.videoIsMuted) {
            this.toggleVideoButton.classList.add("toggleVideoButton--muted");
        } else {
            this.toggleVideoButton.classList.add("toggleVideoButton--unmuted");
        }
        uiThemeController.refreshThemedElements();
    }

    disableScreenShareButton() {
        this.toggleScreenShareButton.classList.remove("toggleScreenShareButton--muted");
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleScreenShareButton, 'toggleScreenShareButton--unmuted', false);
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleScreenShareButton, 'toggleScreenShareButton--muted', false);
        this.toggleScreenShareButton.classList.add("toggleScreenShareButton--disabled");
        uiThemeController.refreshThemedElements();
    }

    enableScreenShareButton() {
        this.toggleScreenShareButton.classList.remove("toggleScreenShareButton--disabled");
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleScreenShareButton, 'toggleScreenShareButton--disabled', false);
        if (this.screenShareIsMuted) {
            this.toggleScreenShareButton.classList.add("toggleScreenShareButton--muted");
        } else {
            this.toggleScreenShareButton.classList.add("toggleScreenShareButton--unmuted");
        }
        uiThemeController.refreshThemedElements();
    }

    maybeDisconnectFromTwilio() {
        let anyoneElseIsStreaming = !!userDataController.allOtherUserData.find((userData) => { return userData.isStreamingVideo !== VideoStreamingStates.NONE; });
        if (!anyoneElseIsStreaming && userDataController.myAvatar.myUserData.isStreamingVideo === VideoStreamingStates.NONE) {
            console.log("Nobody in this Room is streaming video. Disconnecting from Twilio...");
            this.disconnectFromTwilio();
        }
    }

    disableVideoOrScreenSharing() {
        console.log("Disabling local video...");

        this.twilioRoom.localParticipant.unpublishTrack(this.localVideoTrack);
        this.localVideoTrack.stop();
        
        this.providedUserIDToVideoElementMap.delete(userDataController.myAvatar.myUserData.providedUserID);

        if (this.localVideoTrack) {
            const mediaElements = this.localVideoTrack.detach();
            mediaElements.forEach(mediaElement => {
                mediaElement.remove();
            });
        }
        
        this.localVideoTrack = undefined;

        if (!this.videoIsMuted) {
            this.toggleVideoButton.classList.add("toggleVideoButton--muted");
            this.toggleVideoButton.classList.remove("toggleVideoButton--unmuted");
            this.toggleVideoButton.setAttribute("aria-label", "Enable your Camera");
            uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleVideoButton, 'toggleVideoButton--unmuted', false);
            this.videoIsMuted = true;
        }

        if (!this.screenShareIsMuted) {
            this.toggleScreenShareButton.classList.add("toggleScreenShareButton--muted");
            this.toggleScreenShareButton.classList.remove("toggleScreenShareButton--unmuted");
            this.toggleScreenShareButton.setAttribute("aria-label", "Start Sharing your Screen");
            uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleScreenShareButton, 'toggleScreenShareButton--unmuted', false);
            this.screenShareIsMuted = true;
        }

        uiThemeController.refreshThemedElements();

        userDataController.myAvatar.myUserData.isStreamingVideo = VideoStreamingStates.NONE;
        webSocketConnectionController.updateMyUserDataOnWebSocketServer();

        this.maybeDisconnectFromTwilio();
    }

    finishVideoSetup() {
        let videoEl = this.localVideoTrack.attach();
        videoEl.id = userDataController.myAvatar.myUserData.providedUserID;
        this.videoContainer.appendChild(videoEl);
        videoEl.play();
        this.providedUserIDToVideoElementMap.set(userDataController.myAvatar.myUserData.providedUserID, videoEl);

        this.twilioRoom.localParticipant.publishTrack(this.localVideoTrack);

        webSocketConnectionController.updateMyUserDataOnWebSocketServer();
    }

    async enableVideo() {
        console.log("Enabling local video...");

        if (!this.twilioRoom) {
            await this.connectToTwilio();
        }

        let localTracks = await Video.createLocalTracks({
            audio: false,
            video: {
                deviceId: avDevicesController.currentVideoDeviceID,
                aspectRatio: 1
            },
        });

        this.localVideoTrack = <Video.LocalVideoTrack>localTracks.find(track => { return track.kind === 'video'; });

        if (!this.localVideoTrack) {
            console.error("Couldn't get local video track!");
            return;
        }

        userDataController.myAvatar.myUserData.isStreamingVideo = VideoStreamingStates.CAMERA;
        this.finishVideoSetup();
        
        this.toggleVideoButton.classList.remove("toggleVideoButton--muted");
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleVideoButton, 'toggleVideoButton--muted', false);
        this.toggleVideoButton.classList.add("toggleVideoButton--unmuted");
        uiThemeController.refreshThemedElements();
        this.toggleVideoButton.setAttribute("aria-label", "Disable your Camera");

        this.videoIsMuted = false;
    }

    async enableScreenShare() {
        console.log("Enabling local screen sharing...");

        if (!this.twilioRoom) {
            await this.connectToTwilio();
        }

        let screenShareStream;
        try {
            // @ts-ignore
            screenShareStream = await navigator.mediaDevices.getDisplayMedia();
        } catch (e) {
            console.warn(`Couldn't get screen for sharing! Error:\n${e}`);
            this.maybeDisconnectFromTwilio();
            return;
        }

        this.localVideoTrack = new Video.LocalVideoTrack(screenShareStream.getTracks()[0]);
        this.localVideoTrack.on('stopped', () => {
            console.log("User stopped screen sharing.");
            this.disableVideoOrScreenSharing();
        });

        if (!this.localVideoTrack) {
            console.error("Couldn't get local video track!");
            return;
        }

        userDataController.myAvatar.myUserData.isStreamingVideo = VideoStreamingStates.SCREENSHARE;
        this.finishVideoSetup();
        
        this.toggleScreenShareButton.classList.remove("toggleScreenShareButton--muted");
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleScreenShareButton, 'toggleScreenShareButton--muted', false);
        this.toggleScreenShareButton.classList.add("toggleScreenShareButton--unmuted");
        uiThemeController.refreshThemedElements();
        this.toggleScreenShareButton.setAttribute("aria-label", "Stop Sharing your Screen");

        this.screenShareIsMuted = false;
    }

    async toggleVideo() {
        if (!userDataController.myAvatar.myUserData.providedUserID) {
            return;
        }

        if (!this.screenShareIsMuted) {
            await this.toggleScreenShare();
        }


        this.disableScreenShareButton();
        this.disableVideoButton();

        if (this.videoIsMuted) {
            await this.enableVideo();
        } else {
            this.disableVideoOrScreenSharing();
        }

        this.enableScreenShareButton();
        this.enableVideoButton();
    }

    async toggleScreenShare() {
        if (!userDataController.myAvatar.myUserData.providedUserID) {
            return;
        }

        if (!this.videoIsMuted) {
            await this.toggleVideo();
        }

        this.disableScreenShareButton();
        this.disableVideoButton();

        if (this.screenShareIsMuted) {
            await this.enableScreenShare();
        } else {
            this.disableVideoOrScreenSharing();
        }

        this.enableScreenShareButton();
        this.enableVideoButton();
    }

    participantConnected(participant: Video.RemoteParticipant) {
        console.log(`Participant \`${participant.identity}\` connected to video service!`);

        participant.on('trackAdded', track => {
            if (track.kind === 'data') {
                track.on('message', (data: any) => {
                    console.log(`Message from track: ${data}`);
                });
            }
        });
        participant.on('trackSubscribed', (track: Video.RemoteVideoTrack) => { this.trackSubscribed(participant.identity, track); });
        participant.on('trackUnsubscribed', this.trackUnsubscribed.bind(this));

        participant.videoTracks.forEach(publication => {
            if (publication.isSubscribed) {
                this.trackSubscribed(participant.identity, publication.track);
            }
        });
    }

    trackUnpublished(publication: Video.RemoteTrackPublication, participant: Video.RemoteParticipant) {
        console.log(`Participant \`${participant.identity}\` unpublished their video.`);

        let videoEl = document.getElementById(participant.identity);

        if (videoEl) {
            videoEl.remove();
        }

        this.providedUserIDToVideoElementMap.delete(participant.identity);
    }

    participantDisconnected(participant: Video.RemoteParticipant) {
        console.log(`Participant \`${participant.identity}\` disconnected from video service.`);

        let videoEl = document.getElementById(participant.identity);

        if (videoEl) {
            videoEl.remove();
        }

        this.providedUserIDToVideoElementMap.delete(participant.identity);
    }

    trackSubscribed(identity: string, track: Video.RemoteVideoTrack) {
        let videoEl = track.attach();
        videoEl.id = identity;
        this.videoContainer.appendChild(videoEl);
        videoEl.play();
        this.providedUserIDToVideoElementMap.set(identity, videoEl);
    }

    trackUnsubscribed(track: Video.VideoTrack) {
        track.detach().forEach(element => element.remove());
    }
}
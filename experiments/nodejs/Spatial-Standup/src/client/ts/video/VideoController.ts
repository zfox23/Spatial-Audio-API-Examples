import * as Video from 'twilio-video';
import { avDevicesController, uiThemeController, userDataController, webSocketConnectionController } from '..';

declare var HIFI_SPACE_NAME: string;
declare var TWILIO_JWT: string;

export class VideoController {
    connectingToTwilio: boolean = false;
    toggleVideoButton: HTMLButtonElement;
    videoIsMuted: boolean;
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
        uiThemeController.refreshThemedElements();
    }

    disableVideo() {
        console.log("Disabling local video...");

        this.twilioRoom.localParticipant.unpublishTrack(this.localVideoTrack);
        this.localVideoTrack.stop();
        
        this.providedUserIDToVideoElementMap.delete(userDataController.myAvatar.myUserData.providedUserID);

        const mediaElements = this.localVideoTrack.detach();
        mediaElements.forEach(mediaElement => {
            mediaElement.remove();
        });
        
        this.localVideoTrack = undefined;

        this.toggleVideoButton.classList.add("toggleVideoButton--muted");
        this.toggleVideoButton.classList.remove("toggleVideoButton--unmuted");
        this.toggleVideoButton.setAttribute("aria-label", "Enable your Camera");
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleVideoButton, 'toggleVideoButton--unmuted', false);
        uiThemeController.refreshThemedElements();

        userDataController.myAvatar.myUserData.isStreamingVideo = false;
        webSocketConnectionController.updateMyUserDataOnWebSocketServer();

        let anyoneIsStreaming = !!userDataController.allOtherUserData.find((userData) => { return userData.isStreamingVideo === true; });
        if (!anyoneIsStreaming) {
            console.log("Nobody in this Room is streaming video. Disconnecting from Twilio...");
            this.disconnectFromTwilio();
        }
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

        let videoEl = this.localVideoTrack.attach();
        videoEl.id = userDataController.myAvatar.myUserData.providedUserID;
        this.videoContainer.appendChild(videoEl);
        videoEl.play();
        this.providedUserIDToVideoElementMap.set(userDataController.myAvatar.myUserData.providedUserID, videoEl);

        this.twilioRoom.localParticipant.publishTrack(this.localVideoTrack);
        
        this.toggleVideoButton.classList.remove("toggleVideoButton--muted");
        uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleVideoButton, 'toggleVideoButton--muted', false);
        this.toggleVideoButton.classList.add("toggleVideoButton--unmuted");
        uiThemeController.refreshThemedElements();
        this.toggleVideoButton.setAttribute("aria-label", "Disable your Camera");

        userDataController.myAvatar.myUserData.isStreamingVideo = true;
        webSocketConnectionController.updateMyUserDataOnWebSocketServer();
    }

    async toggleVideo() {
        if (!userDataController.myAvatar.myUserData.providedUserID) {
            return;
        }

        this.disableVideoButton();
        
        this.videoIsMuted = !this.videoIsMuted;

        if (this.videoIsMuted) {
            this.disableVideo();
        } else {
            await this.enableVideo();
        }

        this.enableVideoButton();
    }

    participantConnected(participant: Video.RemoteParticipant) {
        console.log(`Participant \`${participant.identity}\` connected!`);

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
        console.log(`Participant \`${participant.identity}\` disconnected from video.`);

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
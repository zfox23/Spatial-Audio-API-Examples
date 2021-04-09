import * as Video from 'twilio-video';
import { avDevicesController, userDataController } from '..';

declare var HIFI_SPACE_NAME: string;
declare var TWILIO_JWT: string;

export class VideoController {
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
        this.toggleVideoButton.classList.add("toggleVideoButton--muted");
        this.disableVideoButton();
        this.toggleVideoButton.addEventListener("click", async (e) => {
            await this.toggleVideo();
        });

        this.providedUserIDToVideoElementMap = new Map();
    }

    connectToTwilio() {
        Video.connect(TWILIO_JWT, {
            name: HIFI_SPACE_NAME,
            video: false,
            audio: false
        }).then((twilioRoom: Video.Room) => {
            this.twilioRoom = twilioRoom;
            console.log(`Connected to Twilio Room \`${this.twilioRoom.name}\`!`);

            this.twilioRoom.participants.forEach(this.participantConnected.bind(this));
            this.twilioRoom.on('participantConnected', this.participantConnected.bind(this));

            this.twilioRoom.on('participantDisconnected', this.participantDisconnected.bind(this));
            this.twilioRoom.once('disconnected', error => this.twilioRoom.participants.forEach(this.participantDisconnected.bind(this)));

            this.enableVideoButton();
        }, error => {
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
        
        this.disableVideoButton();

        if (!this.twilioRoom) {
            return;
        }

        console.log(`Disconnecting from Twilio...`);
        this.twilioRoom.disconnect();
        this.twilioRoom = undefined;
    }

    disableVideoButton() {
        this.toggleVideoButton.classList.add("toggleVideoButton--disabled");
    }

    enableVideoButton() {
        this.toggleVideoButton.classList.remove("toggleVideoButton--disabled");
    }

    disableVideo() {
        console.log("Disabling local video...");

        this.twilioRoom.localParticipant.unpublishTrack(this.localVideoTrack);
        this.localVideoTrack.stop();
        
        this.providedUserIDToVideoElementMap.delete(userDataController.myAvatar.myUserData.providedUserID);
        
        this.localVideoTrack = undefined;

        const mediaElements = this.localVideoTrack.detach();
        mediaElements.forEach(mediaElement => {
            mediaElement.remove();
        });

        this.toggleVideoButton.classList.add("toggleVideoButton--muted");
    }

    async enableVideo() {
        console.log("Enabling local video...");

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
    }

    async toggleVideo() {
        if (!(this.twilioRoom && userDataController.myAvatar.myUserData.providedUserID)) {
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
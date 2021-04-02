import * as Video from 'twilio-video';
import { userDataController } from '..';

declare var HIFI_SPACE_NAME: string;
declare var TWILIO_JWT: string;

export class VideoController {
    toggleVideoButton: HTMLButtonElement;
    videoIsMuted: boolean;
    twilioRoom: Video.Room;
    localTrack: Video.LocalTrack;
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

        if (this.localTrack) {
            let localVideoTrack = <Video.LocalVideoTrack>this.localTrack;
    
            const mediaElements = localVideoTrack.detach();
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

    async toggleVideo() {
        if (!(this.twilioRoom && userDataController.myAvatar.myUserData.providedUserID)) {
            return;
        }

        this.disableVideoButton();
        
        this.videoIsMuted = !this.videoIsMuted;

        if (this.videoIsMuted) {
            console.log("Disabling local video...");

            let localVideoTrack = <Video.LocalVideoTrack>this.localTrack;
            this.twilioRoom.localParticipant.unpublishTrack(localVideoTrack);
            localVideoTrack.stop();
            
            this.providedUserIDToVideoElementMap.delete(userDataController.myAvatar.myUserData.providedUserID);
            
            this.localTrack = undefined;
    
            const mediaElements = localVideoTrack.detach();
            mediaElements.forEach(mediaElement => {
                mediaElement.remove();
            });

            this.toggleVideoButton.classList.add("toggleVideoButton--muted");
        } else {
            console.log("Enabling local video...");

            let localTracks = await Video.createLocalTracks({
                audio: false,
                video: {
                    aspectRatio: 1
                },
            });

            this.localTrack = localTracks.find(track => { return track.kind === 'video'; });

            let localVideoTrack = <Video.LocalVideoTrack>this.localTrack;

            let videoEl = localVideoTrack.attach();
            videoEl.id = userDataController.myAvatar.myUserData.providedUserID;
            this.videoContainer.appendChild(videoEl);
            videoEl.play();
            this.providedUserIDToVideoElementMap.set(userDataController.myAvatar.myUserData.providedUserID, videoEl);

            this.twilioRoom.localParticipant.publishTrack(localVideoTrack);
            
            this.toggleVideoButton.classList.remove("toggleVideoButton--muted");
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
        console.log(`Participant \`${participant.identity}\` disconnected.`);

        let videoEl = document.getElementById(participant.sid);

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
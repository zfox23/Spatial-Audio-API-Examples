const Video = Twilio.Video;
export class VideoTwilio {
    constructor(videoContainer) {
        this.room;
        this.videoTrack = null;
        this.videoContainer = videoContainer;
        this.connected = false;
    }
    async connectToVideoService() {
        let twilioJWT = document.getElementById("twilioJWT").dataset["jwt"];
        
        Video.connect(twilioJWT, {
            name: 'hifi-videochat-twilio-test-room',
            tracks: [],
        }).then(twilioRoom => {
            this.room = twilioRoom;
            console.log('Connected to Room "%s"', this.room.name);
    
            this.room.participants.forEach(this.participantConnected.bind(this));
            this.room.on('participantConnected', this.participantConnected.bind(this));
    
            this.room.on('participantDisconnected', this.participantDisconnected.bind(this));
            this.room.once('disconnected', error => this.room.participants.forEach(this.participantDisconnected.bind(this)));
        }, error => {
            console.error(`Unable to connect to Room: ${error.message}`);
        });
    }

    async toggleCamera() {
        if (this.videoTrack) {
            await this.disconnectCamera();
        } else {
            await this.connectCamera();
        }
        return this.videoTrack !== null;
    }

    async connectCamera() {
        if (!this.room) {
            console.log("Not connected. Impossible connect webcam")
        }
        try{
            let localTracks = await Video.createLocalTracks({
                audio: false,
                video: true,
            });
            this.videoTrack = localTracks.find(track => track.kind === 'video');
            let div = document.createElement("div");
            div.appendChild(this.videoTrack.attach());
            this.videoContainer.appendChild(div);
            await this.room.localParticipant.publishTrack(this.videoTrack);
        } catch(error) {
            console.log("There was an error starting the camera");
        }
    }

    async disconnectCamera() {
        if (!this.room) {
            console.log("Not connected. Error disconnecting the camera")
        }
        if (this.videoTrack) {
            try {
                this.videoTrack.stop();
                await this.room.localParticipant.unpublishTrack(this.videoTrack);
                this.videoTrack = null;
                this.videoContainer.innerHTML = "";
            } catch (error) {
                console.log("There was an error stoping the web camera");
            }
        }
    }

    participantConnected(participant) {
        console.log('Participant "%s" connected', participant.identity);
        const div = document.createElement('div');
        div.id = participant.sid;
        div.dataset["identity"] = participant.identity;

        participant.on('trackSubscribed', track => this.trackSubscribed(div, track));
        participant.on('trackUnsubscribed', track => this.trackUnsubscribed(div, track));

        participant.tracks.forEach(publication => {
            if (publication.isSubscribed) {
                this.trackSubscribed(div, publication.track);
            }
        });
    }

    participantDisconnected(participant) {
        console.log('Participant "%s" disconnected', participant.identity);
        if (this.onUserDisconnected) this.onUserDisconnected(participant.identity);
    }

    async disconnectFromVideoService() {
        if (this.videoTrack) {
            this.videoTrack.stop();
            await this.room.localParticipant.unpublishTrack(this.videoTrack);
            const mediaElements = this.videoTrack.detach();
            mediaElements.forEach(mediaElement => mediaElement.parentNode.remove());
            this.videoTrack = null;
            this.videoContainer.innerHTML = "";
        }

        if (!this.room) {
            return;
        }

        console.log(`Disconnecting from Twilio...`);
        this.room.disconnect();
        this.room = null;
    }

    trackSubscribed(div, track) {
        div.appendChild(track.attach());
        this.onTrackAdded(div.dataset["identity"], div);
    }

    trackUnsubscribed(div, track) {
        this.onTrackRemoved(div.dataset["identity"]);
        track.detach().forEach(element => element.remove());
    }
}
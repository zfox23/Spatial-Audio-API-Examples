const Video = Twilio.Video;

export class VideoTwilio {
    constructor(videoContainer) {
        this.room;
        this.videoTrack = null;
        this.videoContainer = videoContainer;
        this.connected = false;
    }
    async connectToVideoService() {
        // Connect using our JWT
        let twilioJWT = document.getElementById("twilioJWT").dataset["jwt"];
        
        Video.connect(twilioJWT, {
            name: 'streetmeet-twilio-room',
            tracks: [], // We don't require any tracks yet, so players can receive other's camera tracks without sending their own
        }).then(twilioRoom => {
            this.room = twilioRoom;
            console.log('Connected to Room "%s"', this.room.name);
            // Set up callbacks for new participant connection and disconnection
            this.room.participants.forEach(this.participantConnected.bind(this));
            this.room.on('participantConnected', this.participantConnected.bind(this));
    
            this.room.on('participantDisconnected', this.participantDisconnected.bind(this));
            this.room.once('disconnected', error => this.room.participants.forEach(this.participantDisconnected.bind(this)));
        }, error => {
            console.error(`Unable to connect to Room: ${error.message}`);
        });
    }

    async toggleCamera() {
        // Set/unset the camera video track and return camera status
        if (this.videoTrack) {
            await this.disconnectCamera();
        } else {
            await this.connectCamera();
        }
        return this.videoTrack !== null;
    }

    async connectCamera() {
        // Connect the camera
        if (!this.room) {
            console.log("Not connected. Impossible connect webcam")
        }
        try {
            // Add local tracks now
            let localTracks = await Video.createLocalTracks({
                audio: false,
                video: true,
            });
            this.videoTrack = localTracks.find(track => track.kind === 'video');
            let div = document.createElement("div");
            div.appendChild(this.videoTrack.attach());
            // Add this track to the video container
            this.videoContainer.appendChild(div);
            // Publish the track
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
                // Stop and unpublish local tracks
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
        // Set up the track callbacks
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
        // Disconnect from Twilio
        if (this.videoTrack) {
            // Stop and unpublish local tracks
            this.videoTrack.stop();
            await this.room.localParticipant.unpublishTrack(this.videoTrack);
            const mediaElements = this.videoTrack.detach();
            mediaElements.forEach(mediaElement => mediaElement.parentNode.remove());
            this.videoTrack = null;
            this.videoContainer.innerHTML = "";
        }

        if (!this.room) {
            // Room was not connected
            return;
        }
        // Disconnect from room
        console.log(`Disconnecting from Twilio...`);
        this.room.disconnect();
        this.room = null;
    }

    trackSubscribed(div, track) {
        div.appendChild(track.attach());
        // Trigger callback when a new track is added
        this.onTrackAdded(div.dataset["identity"], div);
    }

    trackUnsubscribed(div, track) {
        this.onTrackRemoved(div.dataset["identity"]);
        // Trigger callback when a new track is removed
        track.detach().forEach(element => element.remove());
    }
}
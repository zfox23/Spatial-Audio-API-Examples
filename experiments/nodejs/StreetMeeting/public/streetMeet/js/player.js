
import * as CT from './constants.js';
import { THREE } from './constants.js';

// Root class with the node's physical attributes needed to display it  
class Renderable3D {
    constructor(config) {
        this.position = new THREE.Vector3().copy(config.position);
        this.orientation = new THREE.Quaternion();
        this.radius = config.radius;
        this.name = config.name;
        this.color = config.color;
        this.offset = new THREE.Vector3();
        this.texture = null;
        this.geometry = new THREE.BoxGeometry( 1, 2, 1 );
        this.material = new THREE.MeshPhongMaterial( { color: this.color } );
        this.mesh = new THREE.Mesh(this.geometry, this.material);
    }

    updateModel() {
        this.mesh.position.set(this.position.x + this.offset.x, this.position.z + this.offset.z, this.position.y + this.offset.y);
        this.mesh.quaternion.copy(this.orientation);
    }

}

// Simple class to handle the node's connection, position and orientation
class SoundNode extends Renderable3D {
    constructor(config) {
        super(config);
        // Create the API's position and orientation objects that will be sent to the mixer
        this.mixerPosition = new HighFidelityAudio.Point3D({ x: -this.position.x, y: this.position.z, z: -this.position.y });
        this.mixerOrientation = new HighFidelityAudio.OrientationQuat3D(new THREE.Quaternion());
        this.hifiCommunicator = null; // HighFidelityAudio.HiFiCommunicator
        this.stream = null; // Input or output stream
        this.type = CT.SoundNodeType.NODE;
        this.volume = null; // Value with the volume from mixer in decibels.
        this.connectResponse = null;
    }
    // If the node is connected, its id will be the visit id hash provided by the server
    getId() {
        return this.connectResponse && this.connectResponse.success ? this.connectResponse.audionetInitResponse.visit_id_hash : null;
    }
    // This function receives position ({x, y, z}) and orientation (radians), updates the renderable2D and soundNode values and send it. 
    updateData() {
        // We need to convert the position sent to the mixer
        this.mixerPosition.x = -this.position.x;
        this.mixerPosition.y = this.position.z;
        this.mixerPosition.z = -this.position.y;
        this.mixerOrientation.x = this.orientation.x;
        this.mixerOrientation.y = this.orientation.y;
        this.mixerOrientation.z = this.orientation.z;
        this.mixerOrientation.w = this.orientation.w;
        this.sendUpdatedData();
    }
    // Send the converted position and orientation to the mixer
    sendUpdatedData(name) {
        if (this.hifiCommunicator) {
            let response = this.hifiCommunicator.updateUserDataAndTransmit({
                position: this.mixerPosition,
                orientationQuat: this.mixerOrientation
            });
        }
    }
    // Volume data can be used to render a sound bubble effect on the node
    updateReceivedData(data) {
        this.volume = data.volumeDecibels !== null ? data.volumeDecibels : this.volume;
        if (data.position !== null) {
            this.position.x = data.position.x !== null ? -data.position.x : this.position.x;
            this.position.z = data.position.y !== null ? data.position.y : this.position.y;
            this.position.y = data.position.z !== null ? -data.position.z : this.position.z;
        }
        if (data.orientationQuat !== null) {
            this.orientation.x = data.orientationQuat.x;
            this.orientation.y = data.orientationQuat.y;
            this.orientation.z = data.orientationQuat.z;
            this.orientation.w = data.orientationQuat.w;
            if (data.orientationQuat.x === null || data.orientationQuat.y === null || data.orientationQuat.z === null || data.orientationQuat.w === null) {
                console.log("Null values");
            }
        }
        this.mesh.visible = true;
    }
    // Notify connection changes for debugging
    onConnectionStateChanged(newConnectionState) {
        console.log(`New High Fidelity connection for: ${this.name} state: ${newConnectionState}`);
    }
    // Connect to the server using a valid space token
    async connect() {
        console.log(`Connecting Receiver: ` + this.name + ` to High Fidelity Audio API Servers...`);
        // Setup the communicator
        this.hifiCommunicator = new HighFidelityAudio.HiFiCommunicator({
            initialHiFiAudioAPIData: new HighFidelityAudio.HiFiAudioAPIData({
                position: this.mixerPosition,
                orientationQuat: this.mixerOrientation
            }),
            onConnectionStateChanged: this.onConnectionStateChanged.bind(this), // Subscribe to connection changes
        });
        if (this.stream) { // The stream can be valid at this point if it has been set previously by children
            await this.hifiCommunicator.setInputAudioMediaStream(this.stream, false);
        }
        try {
            let hifiJWT = document.getElementById("hifiJWT").dataset["jwt"];
            this.connectResponse = await this.hifiCommunicator.connectToHiFiAudioAPIServer(hifiJWT);
            console.log(`Call to \`connectToHiFiAudioAPIServer()\` for: ${this.name} succeeded! Response:\n${JSON.stringify(this.connectResponse)}`);
            return this.connectResponse.success;
        } catch (e) {
            console.error(`Call to \`connectToHiFiAudioAPIServer()\` for: ${this.name} failed! Error:\n${e}`);
            this.connectResponse = null;
            return false;
        }
    }
    async setMute(muted) {
        if (this.hifiCommunicator) {
            return await this.hifiCommunicator.setInputAudioMuted(muted);
        }
        return false;
    }
    // Disconnect from the server
    async disconnect() {
        console.log(`Disconnecting Emitter: ${this.name} from High Fidelity Audio API Servers...`);
        let disconnectStatus = await this.hifiCommunicator.disconnectFromHiFiAudioAPIServer();
        this.connectResponse = null;
        console.log(`Disconnected status for ${this.name} : ${disconnectStatus}`);
    }
}

// SoundNode with output stream only. Establish a connection just for listening
class SoundReceiver extends SoundNode {
    constructor(config, onDataReceived) {
        super(config);
        this.type = CT.SoundNodeType.RECEIVER;
        this.onDataReceived = onDataReceived ? onDataReceived : () => {};
    }

    // Custom connection method. After successfully connected we setup the output audio to play the server mix locally.
    async connect() {
        if (await super.connect()) {
            let outputAudioElem = document.createElement('audio');
            outputAudioElem.srcObject = this.hifiCommunicator.getOutputAudioMediaStream();
            // We must call `play()` here because certain browsers won't autoplay this stream as we expect.
            outputAudioElem.play();
            // This will get only volume updates for all Users (including ourselves).
            let userDataSubscription = new HighFidelityAudio.UserDataSubscription({
                "providedUserID": null,
                "components": [ HighFidelityAudio.AvailableUserDataSubscriptionComponents.VolumeDecibels,
                                HighFidelityAudio.AvailableUserDataSubscriptionComponents.Position,
                                HighFidelityAudio.AvailableUserDataSubscriptionComponents.OrientationQuat  ],
                "callback": (data) => { this.onDataReceived(data); }
            });
            this.hifiCommunicator.addUserDataSubscription(userDataSubscription);
            return true;
        }
        return false;
    }
}


// A SoundEmitter with some functions to handle actions and custom rendering
export class Player extends SoundReceiver {
    constructor(config, onDataReceived) {
        super(config, onDataReceived); // config : {position, orientation, name, radius, color}
        this.type = CT.SoundNodeType.PLAYER;
        this.targetPosition = new THREE.Vector3().copy(config.position);
        this.firstData = true;
        this.monitorMaterial = new THREE.MeshPhongMaterial({ color: this.colorFromString(this.name) });
        this.screenMaterial = new THREE.MeshBasicMaterial( { color: "#000000" } );
        this.controlsMaterial = new THREE.MeshPhongMaterial({ color: "#0000FF" });
        this.board = null;
        this.id = config.id;
    }

    initModel(model) {
        if (model) {
            this.mesh = model.clone();
            this.mesh.children[1].material = this.screenMaterial;
            this.mesh.children[1].material.needsUpdate = true;
            this.mesh.children[0].material = this.monitorMaterial;
            this.mesh.children[0].material.needsUpdate = true;
            this.mesh.children[2].material = this.controlsMaterial;
            this.mesh.children[2].material.needsUpdate = true;
            this.mesh.children[3].material = this.controlsMaterial;
            this.mesh.children[3].material.needsUpdate = true;
            this.displayName(this.name);
        }
    }

    async prepareInputStream() {
        // Get the audio media stream associated with the user's default audio input device.
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: HighFidelityAudio.getBestAudioConstraints(), video: false });
        } catch (e) {
            return;
        }
        await this.hifiCommunicator.setInputAudioMediaStream(this.stream);
    }

    updateReceivedData(data) { 
        if (this.firstData) {
            this.firstData = false;
            this.position.x = data.position.x !== null ? -data.position.x : this.position.x;
            this.position.z = data.position.y !== null ? data.position.y : this.position.z;
            this.position.y = data.position.z !== null ? -data.position.z : this.position.y;
        } else if (data.position) {
            this.targetPosition.x = data.position.x !== null ? -data.position.x : this.targetPosition.x;
            this.targetPosition.z = data.position.y !== null ? data.position.y : this.targetPosition.z;
            this.targetPosition.y = data.position.z !== null ? -data.position.z : this.targetPosition.y;
        }
        let newData = { 
            position: null, 
            orientationQuat: data.orientationQuat, 
            volumeDecibels: data.volumeDecibels
        }
        super.updateReceivedData(newData);
    }

    updatePhysics() {
        const MIN_DELTA = 0.001;
        const TAU = 0.1;
        if (!this.isMyPlayer) {
            // Interpolate position before rendering
            let delta = {
                x: this.targetPosition.x - this.position.x, 
                y: this.targetPosition.y - this.position.y, 
                z: this.targetPosition.z - this.position.z
            };
            this.position.x = Math.abs(delta.x) > MIN_DELTA ? this.position.x + (delta.x) * TAU : this.targetPosition.x;
            this.position.y = Math.abs(delta.y) > MIN_DELTA ? this.position.y + (delta.y) * TAU : this.targetPosition.y;
            this.position.z = Math.abs(delta.z) > MIN_DELTA ? this.position.z + (delta.z) * TAU : this.targetPosition.z;
            super.updateModel();
        }
    }

    connectCamera(videoElem) {
        this.videoElem = videoElem;
        this.texture = new THREE.VideoTexture(videoElem.firstChild);
        this.screenMaterial.color.setHex(0xFFFFFF);
        this.screenMaterial.map = this.texture;
        this.screenMaterial.needsUpdate = true;
    }

    disconnectCamera() {
        this.screenMaterial.map = null;
        this.screenMaterial.color.setHex(0x000000);
        this.screenMaterial.needsUpdate = true;
    }

    displayName(name) {
        this.board = document.getElementById("textboard").cloneNode(true);;
        var ctx = this.board.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, this.board.width, this.board.height);
        ctx.fillStyle = "black";
        ctx.font = "16px Arial";
        ctx.fillText(name, 5, 15);
        let tex = new THREE.Texture(this.board);
        this.controlsMaterial.map = tex.clone();
        this.controlsMaterial.color.setHex(0xFFFFFF);
        this.controlsMaterial.needsUpdate = true;
        this.controlsMaterial.map.needsUpdate = true;
    }

    colorFromString(str) {
        var baseRed = 128;
        var baseGreen = 128;
        var baseBlue = 128;
    
        var seed = str.charCodeAt(0) ^ str.charCodeAt(1);
        var rand_1 = Math.abs((Math.sin(seed++) * 10000)) % 256;
        var rand_2 = Math.abs((Math.sin(seed++) * 10000)) % 256;
        var rand_3 = Math.abs((Math.sin(seed++) * 10000)) % 256;
    
        var red = Math.round((rand_1 + baseRed) / 2).toString(16);
        var green = Math.round((rand_2 + baseGreen) / 2).toString(16);
        var blue = Math.round((rand_3 + baseBlue) / 2).toString(16);
        red = red.length == 1 ? "0" + red : red;
        green = green.length == 1 ? "0" + green : green;
        blue = blue.length == 1 ? "0" + blue : blue;
        return "#" + red + green + blue;
    }
}

// A SoundEmitter with some functions to handle actions and custom rendering
export class MyPlayer extends Player {
    constructor(config, onDataReceived) {
        super(config, onDataReceived); // config : {position, orientation, name, radius, color}
        this.isMyPlayer = true; // Render guides
    }
}
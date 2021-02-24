
import { Player, MyPlayer, SoundNodeType } from '../js/player.js'
import { GLScene } from '../js/scene.js'
import { Panorama } from '../js/panorama.js'
import { PhysicsLoop } from '../js/physics.js'
import { VideoTwilio } from '../js/twilio.js'
import { OBJLoader } from './ext/objloader.js'

export class App {
    constructor(config){
        this.config = config;
        // Panorama
        this.streetViewPano = new Panorama();
        // Three.js Scene
        this.glScene = new GLScene();
        this.pendingResize = null;
        // Physics Loop
        this.loop = new PhysicsLoop();
        // Sound
        this.soundNodes = {};
        this.foundNodes = {};
        this.playerId = null;
        // Twilio helper
        this.twilio = null;
        /// UI
        this.triggerButton = null;
        this.cameraButton = null;
        this.videoContainer = null;
        this.cameraModel = null;

        // Bind callbacks
        this.initPanoBinded = this.initPano.bind(this);
    }

    // Connect the UI elements that trigger the example and and display information
    setupUI(triggerButton, cameraButton, micButton, videoContainer) {
        // Set the elements
        this.triggerButton = triggerButton;
        this.cameraButton = cameraButton;
        this.micButton = micButton;
        this.videoContainer = videoContainer;
        // Init the twilio helper
        this.twilio = new VideoTwilio(this.videoContainer);
        // Configure the triggerButton
        this.triggerButton.addEventListener("click", this.initPanoBinded, false);
        window.addEventListener('resize', this.onResizeCanvas.bind(this), false);
    }

    initPano() {
        this.streetViewPano.init(this.config);
        this.streetViewPano.onPanoramaLoaded = () => {
            let offset = this.streetViewPano.computeOffsetsAt(this.foundNodes, this.config.BASE_POSITION);
            // Load the monitor (avatar) model before initiating the scene
            const loader = new OBJLoader();
            loader.load(
                '/streetMeet/model/monitor2.obj',
                (function (obj) { // Once the model is loaded
                    this.cameraModel = obj;
                    this.glScene.init(this.streetViewPano.canvas, this.config, offset, obj);
                    let hifiControls = new HighFidelityControls.HiFiControls({ mainAppElement: document });
                    hifiControls.onLeftDrag = this.onLeftDrag.bind(this);
                    this.streetViewPano.panorama.setPov(this.config.streetViewConfig.pov);
                    this.resizeCanvases(true);
                    this.connectNodes();

                }).bind(this), null, // We don't pass a callback for progress
                function ( error ) { // On error
                    console.log( `An error happened loading monitor.obj. Error: ${error}` );
                }
            );
        };
        this.streetViewPano.onPanoPovChanged = (pov) => {
            // This function is triggered when StreetView changes the POV
            this.glScene.cameraController.setCameraFromView(pov);
        }
        this.streetViewPano.onPanoPositionChanged = (pos) => {
            // This function is triggered when StreetView changes positions (lat, lng)
            let offset = this.streetViewPano.computeOffsetsAt(this.foundNodes, pos);
            // Initiate the 3d camera movement to mimic StreetView animation between positions
            this.glScene.cameraController.moveCameraTo(pos, offset);
        }
        this.loop.addOnStepCback("render", (deltaTime) => {
            // Render loop
            // Set my player's position and orientation according to the 3d camera
            if (this.soundNodes[this.playerId]) {
                this.soundNodes[this.playerId].position.x = this.glScene.camera.position.x;
                this.soundNodes[this.playerId].position.y = this.glScene.camera.position.z;
                this.soundNodes[this.playerId].position.z = this.glScene.camera.position.y;
                this.soundNodes[this.playerId].orientation = this.glScene.camera.quaternion;
                this.soundNodes[this.playerId].updateData(); // Update and send data to the server
            } 
            Object.keys(this.foundNodes).forEach(key => {
                // Update every other node
                this.foundNodes[key].updatePhysics();
            });

            // Render scene
            this.glScene.render(deltaTime);
          
        })
        // Start loop for the first time
        this.loop.start();
    }

    async connectNodes() {

        // Data configuration for all nodes base on type
        let myPlayerConfig = {name: "Player", radius: this.config.PLAYER_RADIUS, color: "#AFAAFF", position: this.config.SPAWN_POINT};
        // Start the connection process
        this.triggerButton.disabled = true;
        this.triggerButton.innerHTML = `wait...`;
        // Create my player node and add it to the local node list
        let node = new MyPlayer(myPlayerConfig, this.onDataReceived.bind(this));
        if (await node.connect()) {
            let nodeId = node.getId();
            console.log(`Node "${node.name}" connected.`);
            this.soundNodes[nodeId] = node;
            this.playerId = nodeId;
            // Once it's connected to the server, prepare the mic input stream
            await node.prepareInputStream();
        } else {
            console.log(`Node "${node.name}" error connecting.`);
        }

       this.triggerButton.style.opacity = 0;
        console.log(`My Player is ready`);

        // Connect the mute and camera buttons
        this.micButton.addEventListener('click', this.toggleMic.bind(this));
        this.cameraButton.addEventListener('click', this.toggleCamera.bind(this));

        // We are connected to the server it's ok to mute now
        this.micButton.classList.remove("toggle-disabled");

        // Setup the Twilio callbacks
        this.twilio.onTrackAdded = (identity, div) => {
            // When a new video track is added, find the owner and add it to its node
            Object.keys(this.foundNodes).forEach(id => {
                if (this.foundNodes[id].name === identity) {
                    console.log("Owner found");
                    this.foundNodes[id].connectCamera(div);
                }
            }); 
        };
        this.twilio.onTrackRemoved = (identity) => {
            // When a video track is been removed, find the owner and remove it from its node
            Object.keys(this.foundNodes).forEach(id => {
                if (this.foundNodes[id].name === identity) {
                    console.log("Owner found");
                    this.foundNodes[id].disconnectCamera();
                }
            }); 
            console.log("Track removed");
        }
        this.twilio.onUserDisconnected = (identity) => {
            // This is not supposed to happen without a HiFi disconnection
            console.log(`User ${identity} disconnected from twilio unexpectedly`);
        }
        // Connect to twilio to send and/or receive video stream
        await this.twilio.connectToVideoService();
        this.cameraButton.classList.remove("toggle-disabled");    
    }

    async toggleMic(e) {
        // When the mute button is clicked
        let isMuted = !this.micButton.classList.contains("micToggle-on");
        let player = this.soundNodes[this.playerId];
        if (player && player.setMute(!isMuted)) {
            // Update UI accordingly
            if (!isMuted) {
                this.micButton.classList.remove("micToggle-on");
                this.micButton.classList.add("micToggle-off");
            } else {
                this.micButton.classList.remove("micToggle-off");
                this.micButton.classList.add("micToggle-on");
            }
            console.log("Mic mute set to" + isMuted ? "muted" : "unmuted");
        } else {
            console.log("Mic mute failed");
        }
    }

    async toggleCamera(e) {
        // When the camera button is clicked
        this.cameraButton.classList.add("toggle-disabled");
        let isCamConnected = await this.twilio.toggleCamera();
        this.cameraButton.classList.remove("toggle-disabled");
        // Update UI accordingly
        if (isCamConnected) {
            this.cameraButton.classList.remove("cameraToggle-on");
            this.cameraButton.classList.add("cameraToggle-off");
        } else {
            this.cameraButton.classList.remove("cameraToggle-off");
            this.cameraButton.classList.add("cameraToggle-on");
        }
    }
    
    onResizeCanvas() {
        this.resizeCanvases(true);
    }
                
    // When my player gets data from the server we update the other nodes 
    onDataReceived(dataArray) {
        dataArray.forEach(data => {
            if (data.hashedVisitID !== this.playerId) {
                if (!this.foundNodes[data.hashedVisitID]) {
                    // If this id is not on the list we create a new node and added to the found node list
                    let playerConfig = {
                        name: data.providedUserID,
                        position: { x: -data.position.x, y: -data.position.z, z: data.position.y }, 
                        orientation: data.orientationQuat,
                        id: data.hashedVisitID,
                        type: SoundNodeType.PLAYER
                    };
                    let newPlayer = new Player(playerConfig);
                    newPlayer.initModel(this.cameraModel);
                    this.glScene.scene.add(newPlayer.mesh);
                    this.foundNodes[data.hashedVisitID] = newPlayer;
                }
                this.foundNodes[data.hashedVisitID].updateReceivedData(data);
            }
        });
    }

    // Left mouse drag move the rotates the camera
    onLeftDrag(e, data) {
        const PITCH_LIMIT = 85;
        let pov = this.streetViewPano.panorama.getPov();
        pov.heading += 0.2 * data.delta.x;
        pov.pitch -= 0.2 * data.delta.y;
        pov.pitch = Math.max(Math.min(pov.pitch, PITCH_LIMIT), -PITCH_LIMIT);
        this.streetViewPano.panorama.setPov(pov);
    }

    resizeCanvases(fromEvent) {
        let panoCanvas = this.streetViewPano.canvas;
        if (panoCanvas) {
            // Resize scene
            this.glScene.resize(panoCanvas.width, panoCanvas.height);
            if (fromEvent && !this.pendingResize) {
                this.pendingResize = window.setTimeout(() => {
                    // Trigger another resize seems necessary to catch StreetView update
                    this.resizeCanvases();
                    this.pendingResize = null;
                }, 200);
            }
        }
    }
}
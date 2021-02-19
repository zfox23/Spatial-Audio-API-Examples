
import { Player, MyPlayer } from '../js/player.js'
import { GLScene } from '../js/scene.js'
import { Panorama } from '../js/panorama.js'
import { PhysicsLoop } from '../js/physics.js'
import { VideoTwilio } from '../js/twilio.js'
import { OBJLoader } from './ext/objloader.js'
import * as CT from '../js/constants.js';

export class App {
    constructor(config){
        this.config = config;
        this.streetViewPano = new Panorama();
        this.glScene = new GLScene();
        this.pendingResize = null;
        this.loop = new PhysicsLoop();
        this.initPanoBinded = this.initPano.bind(this);
        this.disconnectNodesBinded = this.disconnectNodes.bind(this);
        this.disconnecting = false;
        // Sound
        this.soundNodes = {};
        this.foundNodes = {};
        this.playerId = null;
        
        this.twilio = null;
        /// UI
        this.triggerButton = null;
        this.cameraButton = null;
        this.videoContainer = null;
        this.cameraModel = null;
        this.allowRendering = false;
    }

    // Connect the UI elements that trigger the example and and display information
    setupUI(triggerButton, cameraButton, micButton, videoContainer) {
        this.triggerButton = triggerButton;
        this.cameraButton = cameraButton;
        this.micButton = micButton;
        this.videoContainer = videoContainer;
        this.twilio = new VideoTwilio(this.videoContainer);
        // Configure the triggerButton
        this.triggerButton.addEventListener("click", this.initPanoBinded, false);
        window.addEventListener('resize', this.onResizeCanvas.bind(this), false);
    }

    initPano() {
        this.streetViewPano.init(this.config);
        this.streetViewPano.onPanoramaLoaded = () => {
            let offset = this.streetViewPano.computeOffsetsAt(this.foundNodes, this.config.initialPosition);
            
            // instantiate a loader
            const loader = new OBJLoader();
            // load a resource
            loader.load(
                // resource URL
                '/streetMeet/model/monitor.obj',
                // called when resource is loaded
                (function (obj) {
                    this.cameraModel = obj;
                    this.glScene.init(this.streetViewPano.canvas, this.config, offset, obj);
                    let hifiControls = new HighFidelityControls.HiFiControls({ mainAppElement: document });
                    hifiControls.onLeftDrag = this.onLeftDrag.bind(this);
                    this.streetViewPano.panorama.setPov(this.config.pov);
                    // onWheel doesn't work 
                    // hifiControls.onWheel = this.onWheel.bind(this);
                    this.resizeCanvases(true);
                    this.connectNodes();

                }).bind(this),
                // called when loading is in progresses
                function ( xhr ) {

                    console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

                },
                // called when loading has errors
                function ( error ) {

                    console.log( 'An error happened' );

                }
            );
        };
        this.streetViewPano.onPanoPovChanged = (pov) => {
            //console.log("pano pov changed");
            this.glScene.cameraController.setCameraFromView(pov);
        }
        this.streetViewPano.onPanoPositionChanged = (pos) => {
            //console.log("pano pos changed");
            let offset = this.streetViewPano.computeOffsetsAt(this.foundNodes, pos);
            if (this.streetViewPano.loaded) {
                this.glScene.cameraController.moveCameraTo(pos, offset);
                this.allowRendering = true;
            }
        }
        this.loop.addOnStepCback("render", (deltaTime) => {
            if (this.soundNodes[this.playerId]) {
                this.soundNodes[this.playerId].position.x = this.glScene.camera.position.x;
                this.soundNodes[this.playerId].position.y = this.glScene.camera.position.z;
                this.soundNodes[this.playerId].position.z = this.glScene.camera.position.y;
                this.soundNodes[this.playerId].orientation = this.glScene.camera.quaternion;
                this.soundNodes[this.playerId].updateData();
            } 
            Object.keys(this.foundNodes).forEach(key => {
                this.foundNodes[key].updatePhysics();
            });
            if (this.allowRendering) {
                this.glScene.render(deltaTime);
            }            
        })
        this.loop.start();
    }

    async connectNodes() {

        // Data configuration for all nodes base on type
        let myPlayerConfig = {name: "Player", radius: this.config.PLAYER_RADIUS, color: "#AFAAFF", position: this.config.SPAWN_POINT};

        this.triggerButton.disabled = true;
        this.triggerButton.innerHTML = `wait...`;

        let node = new MyPlayer(myPlayerConfig, this.onDataReceived.bind(this));
        if (await node.connect()) {
            let nodeId = node.getId();
            console.log(`Node "${node.name}" connected.`);
            this.soundNodes[nodeId] = node;
            this.playerId = nodeId;
            await node.prepareInputStream();
        } else {
            console.log(`Node "${node.name}" error connecting.`);
        }

       this.triggerButton.style.opacity = 0;
        console.log(`Ready Player 1`);
        this.micButton.classList.remove("toggle-disabled");
        this.micButton.addEventListener('click', this.toggleMic.bind(this));
        this.cameraButton.addEventListener('click', this.toggleCamera.bind(this));
        this.twilio.onTrackAdded = (identity, div) => {
            Object.keys(this.foundNodes).forEach(id => {
                if (this.foundNodes[id].name === identity) {
                    console.log("Owner found");
                    this.foundNodes[id].connectCamera(div);
                }
            }); 
        };
        this.twilio.onTrackRemoved = (identity) => {
            Object.keys(this.foundNodes).forEach(id => {
                if (this.foundNodes[id].name === identity) {
                    console.log("Owner found");
                    this.foundNodes[id].disconnectCamera();
                }
            }); 
            console.log("Track removed");
        }
        this.twilio.onUserDisconnected = (identity) => {
            let nodeId = null;
            Object.keys(this.foundNodes).forEach(id => {
                if (this.foundNodes[id].name === identity) {
                    nodeId = id;
                    console.log("Owner found. Disconnecting");
                    this.foundNodes[id].mesh.visible = false;
                }
            });
        }
        await this.twilio.connectToVideoService();
        this.cameraButton.classList.remove("toggle-disabled");    
    }

    async toggleMic(e) {
        let isMuted = !this.micButton.classList.contains("micToggle-on");
        let player = this.soundNodes[this.playerId];
        if (player && player.setMute(!isMuted)) {
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
        this.cameraButton.classList.add("toggle-disabled");
        let isCamConnected = await this.twilio.toggleCamera();
        this.cameraButton.classList.remove("toggle-disabled");
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
    async disconnectNodes() {
        this.disconnecting = true;
        this.triggerButton.disabled = true;
        this.triggerButton.innerHTML = `wait...`;
        let ids = Object.keys(this.soundNodes);
        for (let i = 0; i < ids.length; i++) {
            let id = ids[i];
            if (id === this.playerId) {
                this.playerId = null;
            }
            await this.soundNodes[id].disconnect();
            console.log(`Node "${this.soundNodes[id].name}" disconnected.`);
            delete this.soundNodes[id];
        };
        this.disconnecting = false;
        this.loop.removeOnStepCback("render");
        // Reset triggerButton
        this.triggerButton.disabled = false;
        this.triggerButton.innerHTML = `Connect`;
        this.triggerButton.removeEventListener('click', this.disconnectNodesBinded, false);
        this.triggerButton.addEventListener('click', this.initPanoBinded, false);
        await this.twilio.disconnectFromVideoService();
        this.config.container.innerHTML = "";
    }
                
    // When the receiver gets data from the server we update nodes 
    onDataReceived(dataArray) {
        if (!this.disconnecting) {
            dataArray.forEach(data => {
                if (data.hashedVisitID !== this.playerId) {
                    if (!this.foundNodes[data.hashedVisitID]) {
                        let playerConfig = {
                            name: data.providedUserID, 
                            radius: this.config.PLAYER_RADIUS, 
                            color: "#FF0000",
                            position: { x: -data.position.x, y: -data.position.z, z: data.position.y }, 
                            orientation: data.orientationQuat,
                            id: data.hashedVisitID,
                            type: CT.SoundNodeType.PLAYER
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
    }

    // Move the selected node with a left drag
    onLeftDrag(e, a, d) {
        let pov = this.streetViewPano.panorama.getPov();
        pov.heading += 0.2 * a.delta.x;
        pov.pitch -= 0.2 * a.delta.y;
        this.streetViewPano.panorama.setPov(pov);
    }

    // Move the selected node with a left drag
    onWheel(e) {
        let pov = this.streetViewPano.panorama.getPov();
        pov.zoom += 0.02 * a.delta;
        this.streetViewPano.panorama.setPov(pov);
    }
    resizeCanvases(fromEvent) {
        let panoCanvas = this.streetViewPano.canvas;
        if (panoCanvas) {
            this.glScene.resize(panoCanvas.width, panoCanvas.height);
            if (fromEvent && !this.pendingResize) {
                this.pendingResize = window.setTimeout(() => {
                    this.resizeCanvases();
                    this.pendingResize = null;
                    console.log("Reresizing");
                }, 200);
            }
        }
    }
}

import { Player, MyPlayer } from '../js/player.js'
import { GLScene } from '../js/scene.js'
import { Panorama } from '../js/panorama.js'
import { PhysicsLoop } from '../js/physics.js'
import { VideoTwilio } from '../js/twilio.js'
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
    }

    // Connect the UI elements that trigger the example and and display information
    setupUI(triggerButton, cameraButton, videoContainer) {
        this.triggerButton = triggerButton;
        this.cameraButton = cameraButton;
        this.videoContainer = videoContainer;
        this.twilio = new VideoTwilio(this.videoContainer);
        // Configure the triggerButton
        this.triggerButton.addEventListener("click", this.initPanoBinded, false);
        this.triggerButton.innerHTML = `Click to Connect`;
        window.addEventListener('resize', this.onResizeCanvas.bind(this), false);
    }

    initPano() {
        this.streetViewPano.init(this.config);
        this.streetViewPano.onPanoramaLoaded = () => {
            let offset = this.streetViewPano.computeOffsetsAt(this.foundNodes, this.config.initialPosition);
            this.glScene.init(this.streetViewPano.canvas, this.config, offset);
            let hifiControls = new HighFidelityControls.HiFiControls({ mainAppElement: document });
            hifiControls.onLeftDrag = this.onLeftDrag.bind(this);
            this.streetViewPano.panorama.setPov(this.config.pov);
            // onWheel doesn't work 
            // hifiControls.onWheel = this.onWheel.bind(this);
            this.resizeCanvases(true);
            this.connectNodes();
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
            this.glScene.render(deltaTime);
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
            node.setupFromId(nodeId);
            await node.prepareInputStream();
        } else {
            console.log(`Node "${node.name}" error connecting.`);
        }

        // Reset trigger button status
        /*
        this.triggerButton.disabled = false;
        this.triggerButton.innerHTML = `Disconnect`;
        this.triggerButton.removeEventListener('click', this.initPanoBinded, false);
        this.triggerButton.addEventListener('click', this.disconnectNodesBinded, false);
        */
       this.triggerButton.style.opacity = 0;
        console.log(`Ready Player 1`);
        
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
        this.cameraButton.disabled = false;
        
    }
    async toggleCamera(e) {
        this.cameraButton.disabled = true;
        let isCamConnected = await this.twilio.toggleCamera();
        this.cameraButton.disabled = false;
        this.cameraButton.innerHTML = isCamConnected ? "Disconnect Camera" : "Connect Camera";
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
                            type: CT.SoundNodeType.PLAYER};
                        let newPlayer = new Player(playerConfig);
                        newPlayer.setupFromId(data.hashedVisitID);
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
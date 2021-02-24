import * as THREE from '/streetMeet/build/three.module.js';

class CameraController {
    // This class controls the camera and offset data and its interpolation
    constructor(camera, pov, position, offset) {
        this.camera = camera;
        this.camera.rotation.order = 'YXZ'
        this.fromPosition = new THREE.Vector3();
        this.toPosition = new THREE.Vector3();
        this.fromOffset = new THREE.Vector3();
        this.toOffset = new THREE.Vector3();
        this.traveling = false;
        this.totalTime = 0.5;
        this.timeLapse = 0.0;
        this.heading = 0.0;
        this.pitch = 0.0;
        this.zoom = 0.0;
        this.offset = new THREE.Vector3().copy(offset);
        this.position = new THREE.Vector3().copy(position);
        this.setCameraFromView(pov);
        this.updateCamera();
    }
    static getSphericalPoint(heading, pitch) {
        // Compute a point in front of the camera view based on heading a pitch
        let rpitch = 0.5 * Math.PI - pitch;
        let spoint = { 
            x: -Math.sin(rpitch) * Math.cos(-heading), 
            y: Math.cos(rpitch),
            z: Math.sin(rpitch) * Math.sin(-heading)        
        };
        return spoint;
    }
    setCameraFromView({heading, pitch, zoom}) {
        // Update the camera's orientation and projection matrix based on POV data 
        this.heading = heading;
        this.pitch = pitch;
        this.zoom = zoom;
        const RADIANS_TO_DEGREES = 57.2958;
        // Compute a point in the panorama's projection sphere using the heading and pitch values as a look at point for the camera
        let point = CameraController.getSphericalPoint(heading  / RADIANS_TO_DEGREES, pitch  / RADIANS_TO_DEGREES);
        this.camera.lookAt(this.camera.position.x + point.x, this.camera.position.y + point.y, this.camera.position.z + point.z);
        // Approximate the camera's FOV to StreetView's according to the zoom and some experimental values
        let ratio = (zoom - 1.0) / 3.0;
        ratio = Math.max(Math.min(ratio, 1.0), 0.0);
        ratio = (--ratio) * ratio * ratio + 1;
        let fov = (180.0 + (48.0 * ratio * (1.0 / this.camera.aspect))) / (Math.pow(2, zoom) * this.camera.aspect);
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
    }
    moveCameraTo(position, offset) {
        // Initiate the smooth transition to the selected position
        this.traveling = true;
        this.timeLapse = 0;
        this.fromPosition.copy(this.position);
        this.toPosition.copy(position);
        this.fromOffset.copy(this.offset);
        this.toOffset.copy(offset);
    }
    update(deltaTime) {
        if (this.traveling) {
            // If the camera is transitioning, compute the next step on the path
            this.timeLapse += deltaTime;
            if (this.timeLapse < this.totalTime) {
                let ratio = this.timeLapse / this.totalTime;
                // A linear interpolation between two points seems like the best approximation to StreetView's
                const EPSILON = 0.001;
                this.position.lerpVectors(this.fromPosition, this.toPosition, ratio);
                if (this.offset.distanceTo(this.toOffset) > EPSILON) {
                    this.offset.lerpVectors(this.fromOffset, this.toOffset, ratio);
                }
            } else {
                // If the transition is over set the destination data
                this.position.copy(this.toPosition);
                this.offset.copy(this.toOffset);
                this.traveling = false;
            }
            this.updateCamera();
        }
    }
    updateCamera() {
        this.camera.position.copy(this.position.clone().add(this.offset));
    }
}

export class GLScene{
    // This class manages the rendering process using three.js
    constructor() {
        this.scene = null;
        this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.renderer = null;
        this.mesh = null;
        this.panoCanvas = null;
        this.panoConfig = null;
        this.glCanvas = null;
        this.cameraController = null;
    }

    init(panoCanvas, panoConfig, cameraOffset) {
        this.panoCanvas = panoCanvas;
        this.panoConfig = panoConfig;
        // Initiate the camera controller
        this.cameraController = new CameraController(this.camera, panoConfig.streetViewConfig.pov, panoConfig.BASE_POSITION, cameraOffset);
    
        // New three scene
        this.scene = new THREE.Scene();
        this.scene.background = null; // Transparent background
        
        // Simple lighting
        const hemiLight = new THREE.HemisphereLight( 0xccccccff, 0x444488 );
        hemiLight.position.set( panoConfig.SPAWN_POINT.x + 0, panoConfig.SPAWN_POINT.z + 20, panoConfig.SPAWN_POINT.y + 0 );
        this.scene.add( hemiLight );
    
        const directionalLight = new THREE.DirectionalLight( 0xffffcc );
        directionalLight.position.set( panoConfig.SPAWN_POINT.x + 0, panoConfig.SPAWN_POINT.z + 200, panoConfig.SPAWN_POINT.y + 100 );
        this.scene.add( directionalLight );      
    
        // Initiate renderer with a transparent background setup
        this.renderer = new THREE.WebGLRenderer( { alpha: true, antialias: true } ); // Transparent background
        // Set up the canvas 
        this.renderer.domElement.classList.add("gl-canvas");
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( this.panoCanvas.width, this.panoCanvas.height);
        this.renderer.setClearColor( 0xffffff, 0);

        // Add the canvas to the DOM right on top of the StreetView canvas
        this.glCanvas = this.renderer.domElement;
        if (this.panoCanvas.nextSibling) {
            this.panoCanvas.parentNode.insertBefore(this.glCanvas, panoCanvas.nextSibling);
        } else {
            this.panoCanvas.parentNode.appendChild(this.glCanvas);
        }
        
    }

    resize(width, height) {
        // update camera and renderer
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    render(deltaTime) {
        if (this.renderer) {
            // Update the controller and render
            this.cameraController.update(deltaTime);
            this.renderer.render(this.scene, this.camera);
        }
    }
}
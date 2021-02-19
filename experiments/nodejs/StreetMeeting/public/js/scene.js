import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import * as CT from '../js/constants.js';
class CameraController {
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
        let rpitch = 0.5 * Math.PI - pitch;
        let spoint = { 
            x: 5 * -Math.sin(rpitch) * Math.cos(-heading), 
            y: 5 * Math.cos(rpitch),
            z: 5 * Math.sin(rpitch) * Math.sin(-heading)        
        };
        return spoint;
    }
    setCameraFromView({heading, pitch, zoom}) {
        this.heading = heading;
        this.pitch = pitch;
        this.zoom = zoom;
        let point = CameraController.getSphericalPoint(heading  / CT.RADIANS_TO_DEGREES, pitch  / CT.RADIANS_TO_DEGREES);
        this.camera.lookAt(this.camera.position.x + point.x, this.camera.position.y + point.y, this.camera.position.z + point.z);
        let ratio = (zoom - 1.0) / 3.0;
        ratio = Math.max(Math.min(ratio, 1.0), 0.0);
        ratio = (--ratio) * ratio * ratio + 1;
        let fov = (180.0 + (48.0 * ratio * (1.0 / this.camera.aspect))) / (Math.pow(2, zoom) * this.camera.aspect);
        // fov = 180 / (Math.pow(2, zoom) * this.camera.aspect);
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
    }
    moveCameraTo(position, offset) {
        this.traveling = true;
        this.timeLapse = 0;
        this.fromPosition.copy(this.position);
        this.toPosition.copy(position);
        this.fromOffset.copy(this.offset);
        this.toOffset.copy(offset);
    }
    update(deltaTime) {
        if (this.traveling) {
            this.timeLapse += deltaTime;
            if (this.timeLapse < this.totalTime) {
                let ratio = this.timeLapse / this.totalTime;
                // TODO Find a better transition squeme
                // ratio = ratio < 0.5 ? 4 * ratio * ratio * ratio : (ratio - 1) * (2 * ratio - 2) * (2 * ratio - 2) + 1;
                // ratio = (--ratio)*ratio*ratio+1
                // ratio = Math.pow(ratio, 0.5);
                this.position.lerpVectors(this.fromPosition, this.toPosition, ratio);
                if (this.offset.distanceTo(this.toOffset) > CT.EPSILON) {
                    this.offset.lerpVectors(this.fromOffset, this.toOffset, ratio);
                }
            } else {
                this.position.copy(this.toPosition);
                this.offset.copy(this.toOffset);
                this.traveling = false;
            }
            this.updateCamera();    
        }
    }
    updateCamera() {
        this.camera.position.copy(this.position.clone().add(this.offset));
        //this.camera.position.copy(this.position);
    }
}

export class GLScene{
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
        this.cameraController = new CameraController(this.camera, panoConfig.pov, panoConfig.initialPosition, cameraOffset);
    
        this.scene = new THREE.Scene();
        this.scene.background = null;
    
        //
    
        const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        hemiLight.position.set( panoConfig.SPAWN_POINT.x + 0, panoConfig.SPAWN_POINT.z + 2, panoConfig.SPAWN_POINT.y + 0 );
        this.scene.add( hemiLight );
    
        const directionalLight = new THREE.DirectionalLight( 0xffffff );
        directionalLight.position.set( panoConfig.SPAWN_POINT.x + 0, panoConfig.SPAWN_POINT.z + 200, panoConfig.SPAWN_POINT.y + 100 );
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.top = 180;
        directionalLight.shadow.camera.bottom = - 100;
        directionalLight.shadow.camera.left = - 120;
        directionalLight.shadow.camera.right = 120;
        this.scene.add( directionalLight );
    
        // export mesh
    
        const geometry = new THREE.BoxGeometry( 1, 2, 1 );
        const material = new THREE.MeshPhongMaterial( { color: "#00ff00" } );
    
        this.mesh = new THREE.Mesh( geometry, material );
        this.mesh.castShadow = true;
        this.mesh.position.set(panoConfig.SPAWN_POINT.x, panoConfig.SPAWN_POINT.z, panoConfig.SPAWN_POINT.y);
        this.scene.add( this.mesh );        
    
        //
        this.renderer = new THREE.WebGLRenderer( { alpha: true, antialias: true } );
        this.renderer.domElement.classList.add("gl-canvas");
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( this.panoCanvas.width, this.panoCanvas.height);
        this.renderer.setClearColor( 0xffffff, 0);
        this.renderer.shadowMap.enabled = true;
        if (this.panoCanvas.nextSibling) {
            this.panoCanvas.parentNode.insertBefore(this.renderer.domElement, panoCanvas.nextSibling);
        } else {
            this.panoCanvas.parentNode.appendChild(this.renderer.domElement);
        }
        this.glCanvas = this.renderer.domElement;
    }

    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    render(deltaTime) {
        if (this.renderer) {
            this.cameraController.update(deltaTime);
            this.renderer.render(this.scene, this.camera);
        }
    }
}
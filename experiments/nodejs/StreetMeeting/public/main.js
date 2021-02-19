
import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import { App } from './js/app.js'
import { VideoTwilio } from './js/twilio.js';
import * as CT from './js/constants.js';

// This script contains code specific to using Twilio as a video service provider.
let connectDisconnectButton = document.querySelector('.connectDisconnectButton');

let toggleInputMuteButton = document.querySelector('.toggleInputMuteButton');
toggleInputMuteButton.addEventListener("click", toggleInputMute);
let toggleWebCam = document.querySelector('.toggleWebCam');

async function toggleInputMute() {
    if (!hifiCommunicator) {
        return;
    }
    if (await hifiCommunicator.setInputAudioMuted(!isMuted)) {
        isMuted = !isMuted;
        toggleInputMuteButton.innerHTML = `Toggle Mute (currently ${isMuted ? "muted" : "unmuted"})`;
    }
}

var script = document.createElement('script');
script.src = `https://maps.googleapis.com/maps/api/js?key=${CT.API_TOKEN}&callback=enableConnectButton&libraries=&v=weekly`;
script.async = true;
// Append the 'script' element to 'head'
document.head.appendChild(script);


HighFidelityAudio.HiFiLogger.setHiFiLogLevel(HighFidelityAudio.HiFiLogLevel.Debug);
let SPAWN_POINT = {x: 30, y: 120, z: 0};

const APP_CONFIG = {
    position: { lat: 37.869, lng: -122.255 },
    pov: {
        heading: 60,
        pitch: 0,
        zoom: 0.4
    },
    addressControl: false,
    visible: true,
    zoomControl: false,
    fullscreenControl: false,
    motionTrackingControl: false,
    enableCloseButton: false,
    panControl: false,
    container: document.getElementById("pano-container"),
    initialPosition: new THREE.Vector3(SPAWN_POINT.x + 2.0, SPAWN_POINT.z + 1.7, SPAWN_POINT.y + 2.0),
    SPAWN_POINT : SPAWN_POINT, // Initial position for the receiver
    PLAYER_RADIUS: 0.2 // Radius of the listener
}
let videoContainer = document.querySelector('.videoContainer')

const urlParams = new URLSearchParams(window.location.search);

if (window.location.search.indexOf("?") > -1) {
    let coordinates = window.location.search.split("?")[1].split(",");
    if (coordinates.length === 2) {
        APP_CONFIG.position.lat = parseFloat(coordinates[0]);
        APP_CONFIG.position.lng = parseFloat(coordinates[1]);
    }

}


let panoApp;
panoApp = new App(APP_CONFIG);
panoApp.setupUI(connectDisconnectButton, toggleWebCam, videoContainer);

window.enableConnectButton = function() {
    connectDisconnectButton.disabled = false;
    let preview = document.createElement("img");
    preview.classList.add("preview");
    preview.src = `https://maps.googleapis.com/maps/api/streetview?size=800x800&location=${APP_CONFIG.position.lat},${APP_CONFIG.position.lng}&fov=80&heading=70&pitch=0&key=${CT.API_TOKEN}`;
    APP_CONFIG.container.appendChild(preview);
}
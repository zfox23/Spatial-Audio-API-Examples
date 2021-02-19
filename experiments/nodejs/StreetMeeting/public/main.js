
//import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import { App } from './js/app.js'
import * as CT from './js/constants.js';
import { THREE } from './js/constants.js';
import { Panorama } from './js/panorama.js';

// This script contains code specific to using Twilio as a video service provider.
let connectDisconnectButton = document.querySelector('.connectDisconnectButton');
let toggleWebCam = document.querySelector('.toggleWebCam');
let toggleMic = document.querySelector('.toggleMic');

var script = document.createElement('script');
script.src = `https://maps.googleapis.com/maps/api/js?key=${CT.API_TOKEN}&callback=enableConnectButton&libraries=&v=weekly`;
script.async = true;
// Append the 'script' element to 'head'
document.head.appendChild(script);

let lat = 37.7647271;
let lng = -3.7906838;

if (window.location.search.indexOf("?") > -1) {
    let coordinates = window.location.search.split("?")[1].split(",");
    if (coordinates.length === 2) {
        lat = parseFloat(coordinates[0]);
        lng = parseFloat(coordinates[1]);
    }
}
let dist = Math.sqrt(lat*lat + lng*lng);
let directionX = lat / dist;
let directionY = lng / dist;
let distFromOrigen = 0.0001 * Panorama.getDistanceBetween({lat: 0, lng: 0}, {lat: lat, lng: lng});
let spawn_point = {x: directionX * distFromOrigen, y: directionY * distFromOrigen, z: 0};

HighFidelityAudio.HiFiLogger.setHiFiLogLevel(HighFidelityAudio.HiFiLogLevel.Debug);

const APP_CONFIG = {
    position: { lat: lat, lng: lng },
    pov: {
        heading: 60,
        pitch: 0,
        zoom: 0.4
    },
    addressControl: false,
    visible: true,
    zoomControl: false,
    fullscreenControl: false,
    enableCloseButton: false,
    panControl: false,
    motionTracking: true,
    motionTrackingControl: true,
    container: document.getElementById("pano-container"),
    initialPosition: new THREE.Vector3(spawn_point.x + 2.0, spawn_point.z + 1.7, spawn_point.y + 2.0),
    SPAWN_POINT : spawn_point, // Initial position for the receiver
    PLAYER_RADIUS: 0.2 // Radius of the listener
}
let videoContainer = document.querySelector('.videoContainer')

const urlParams = new URLSearchParams(window.location.search);

let panoApp;
panoApp = new App(APP_CONFIG);
panoApp.setupUI(connectDisconnectButton, toggleWebCam, toggleMic, videoContainer);

window.enableConnectButton = function() {
    connectDisconnectButton.disabled = false;
}

import { App } from './js/app.js'
import * as THREE from '/streetMeet/build/three.module.js';
import { Panorama } from './js/panorama.js';

HighFidelityAudio.HiFiLogger.setHiFiLogLevel(HighFidelityAudio.HiFiLogLevel.Debug);
{
    // Get the API key from the div
    let googleAPIKey = document.getElementById("googleAPIKey").dataset["key"];
    // Enable the connect button function after loading the google maps API
    var script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleAPIKey}&callback=enableConnectButton&libraries=&v=weekly`;
    script.async = true;
    // Append the script element to head to start loading
    document.head.appendChild(script);
}

// Default position
const INITIAL_POSITION = {
    lat: 37.7647271,
    lng: -3.7906838
}

// Try to get the position from the url parameters i.e. 'streetMeet/?37.7647271,-3.7906838'
if (window.location.search.indexOf("?") > -1) {
    let coordinates = window.location.search.split("?")[1].split(",");
    if (coordinates.length === 2) {
        INITIAL_POSITION.lat = parseFloat(coordinates[0]);
        INITIAL_POSITION.lng = parseFloat(coordinates[1]);
    }
}

// Get a spawn 3d position from the lat lng coords
function computeSpawnPointFromPosition(center, position) {
    let dist = Math.sqrt(position.lat*position.lat + position.lng*position.lng);
    let directionX = position.lat / dist;
    let directionY = position.lng / dist;
    let distFromOrigen = 0.01 * Panorama.getDistanceBetween(center, position);
    return {x: directionX * distFromOrigen, y: directionY * distFromOrigen, z: 0};
}

const CENTER_POSITION_REFERENCE = {lat: 0, lng: 0}; // Equivalent to the {x: 0, y: 0, z: 0} 3d position
let spawnFromLatLng = computeSpawnPointFromPosition(CENTER_POSITION_REFERENCE, INITIAL_POSITION);
console.log(`Spawn point: ${spawnFromLatLng.x}, ${spawnFromLatLng.y}, ${spawnFromLatLng.z}`);
const APP_CONFIG = {
    streetViewConfig: {
        position: INITIAL_POSITION,
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
        motionTrackingControl: true
    }, 
    PANO_CONTAINER: document.getElementById("pano-container"), // Container for Google Street View elements
    BASE_POSITION: new THREE.Vector3(spawnFromLatLng.x, spawnFromLatLng.z, spawnFromLatLng.y), // On three.js coordinates (y, z swap)
    SPAWN_POINT : spawnFromLatLng, // Initial position on meters
    OFFSET_LEVELS: 3,
    OFFSET_RADIUS: 3
}

let videoContainer = document.querySelector('.videoContainer');
let connectDisconnectButton = document.querySelector('.connectDisconnectButton');
let toggleWebCam = document.querySelector('.toggleWebCam');
let toggleMic = document.querySelector('.toggleMic');

window.enableConnectButton = function() {
    connectDisconnectButton.disabled = false;
}

let panoApp;
panoApp = new App(APP_CONFIG);
panoApp.setupUI(connectDisconnectButton, toggleWebCam, toggleMic, videoContainer);


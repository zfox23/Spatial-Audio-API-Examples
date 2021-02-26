import * as THREE from '/streetMeet/build/three.module.js';
// Class to store location data
class Location {
    constructor() {
        this.location = null;
        this.position = null;
        this.links = null; // Data with the available links to new positions (Arrows)
    }
}
// StreetView controller class
export class Panorama{
    constructor() {
        this.panorama = null; // The panorama object from Google Maps
        this.canvas = null; // The container for the StreetView elements
        this.dataCache = {}; // Cache with data of adjacent points

        this.currentPanoId = null;
        this.config = null;
        // Callbacks
        this.onPanoramaLoaded = null;
        // Possible offsets for my player to occupate
        this.offsets = [];
        this.currentOffsetIdx = -1;
    }

    computeOffsetsAt(nodes, point) {
        // Function to compute the available offsets for the position we are moving to
        // This is necessary so two players will not end up occupying the same position
        const EPSILON = 0.1;
        // Create a data array with information of occupy offsets
        let avaliableOffsets = [];
        for (let i = 0; i < this.offsets.length; i++) {
            avaliableOffsets.push(true);
        }
        // Compute all possible offsets around the panorama point
        let ids = Object.keys(nodes);
        let recomputeCurrentOffset = false;
        let neighbors = {};
        for (let i = 0; i < ids.length; i++) {
            let node = nodes[ids[i]];
            let position3d = new THREE.Vector3(node.position.x, node.position.z, node.position.y);
            // Check if this node is already using this offset
            if (point.distanceTo(position3d) < (this.config.OFFSET_RADIUS * this.config.OFFSET_LEVELS + EPSILON)) {
                // Estimate other player offset
                let nodeOffset = position3d.clone().sub(point);
                neighbors[ids[i]] = nodeOffset;
            }
        }
        ids = Object.keys(neighbors);
        for (let i = 0; i < ids.length; i++) {
            let nodeOffset = neighbors[ids[i]];
            for (let j = 0; j < this.offsets.length; j++) {
                let offset = this.offsets[j];                
                if (offset.distanceTo(nodeOffset) < EPSILON) {
                    // If the other player is using our same offset get the next available one 
                    recomputeCurrentOffset = recomputeCurrentOffset || j === this.currentOffsetIdx;
                    avaliableOffsets[j] = false;
                    continue;
                }
            }
        }

        // If my current offset is invalid, find a new one
        if (recomputeCurrentOffset || this.currentOffsetIdx > 5) {
            let prevOffsetIdx = this.currentOffsetIdx;
            for (let i = 0; i < avaliableOffsets.length; i++) {
                if (avaliableOffsets[i]) {
                    this.currentOffsetIdx = i;
                    break;
                }
            }
            console.log("Recomputing offset: from " + prevOffsetIdx + " to " + this.currentOffsetIdx);
        }
        return this.offsets[this.currentOffsetIdx];
    }

    generateOffsets() {
        // Compute a structure of offsets around the panorama point
        let aroundCount = 6;
        for (let j = 1; j <= this.config.OFFSET_LEVELS; j++) {
            for (let i = 0; i < aroundCount - 1; i++) {
                let angle = 2 * Math.PI * (i / aroundCount);
                let offset = new THREE.Vector3(this.config.OFFSET_RADIUS * j * Math.cos(angle), 0.0, this.config.OFFSET_RADIUS * j * Math.sin(angle));
                this.offsets.push(offset);
            }
        }
    }

    computePosition3D(fromId, toId, heading) {
        // Get the destination's 3d point, computing the distance and the direction using the origin and destination point coordinates (lat lng) and heading 
        let fromData = this.dataCache[fromId];
        let toData = this.dataCache[toId];
        if (fromData && toData && fromData.location && toData.location) {
            const DISTANCE_CORRECTOR = 1.4; // Empirical
            let distance = DISTANCE_CORRECTOR * Panorama.getDistanceBetween(fromData.location, toData.location);
            const RADIANS_TO_DEGREES = 57.2958;
            // To compute direction we use the heading angle (degrees)
            let offset = { 
                x: -distance * Math.cos(heading / RADIANS_TO_DEGREES), 
                y: 0, 
                z: -distance * Math.sin(heading / RADIANS_TO_DEGREES)
            };
            toData.position = new THREE.Vector3(fromData.position.x + offset.x,fromData.position.y + offset.y, fromData.position.z + offset.z);
            toData.position.add(offset);
        }
    }

    static getDistanceBetween(loc1, loc2) {
        // Compute the distance in meters between two coordinates (lat,lng)
        const R = 6371e3; // metres
        const fi1 = loc1.lat * Math.PI/180; // φ, λ in radians
        const fi2 = loc2.lat * Math.PI/180;
        const fi_delta = (loc2.lat-loc1.lat) * Math.PI/180;
        const alpha_delta = (loc2.lng-loc1.lng) * Math.PI/180;
    
        const a = Math.sin(fi_delta/2) * Math.sin(fi_delta/2) +
                Math.cos(fi1) * Math.cos(fi2) *
                Math.sin(alpha_delta/2) * Math.sin(alpha_delta/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return (R * c); // in metres
    }
    
    async tryToCollectDataFrom({panoId, links}) {
        // Once we arrive to a new position and the links are loaded, add the locations to the cache
        let location = this.dataCache[panoId];
        if (location && links && !location.links) {
            // If the location doesn't contain link data
            location.links = {};
            for (let i = 0; i < links.length; i++) {
                let link = links[i];
                location.links[link.pano] = link;
                this.dataCache[link.pano] = new Location();
            }
        }
    }

    init(config) {
        this.config = config;
        // Generate the offsets around the panorama central point for the player position
        this.generateOffsets();
        this.currentOffsetIdx = 0;
        this.panorama = new google.maps.StreetViewPanorama(config.PANO_CONTAINER, config.streetViewConfig);
        
        this.panorama.addListener("links_changed", () => {
            let links = this.panorama.getLinks();
            // When new links are received try to get data and compute distances
            this.tryToCollectDataFrom({panoId: this.currentPanoId, links: links});
        });

        this.panorama.addListener("position_changed", () => {
            // When arrive to a new position
            let panoId = this.panorama.getPano(); // ID of the current panorama
            if (!this.dataCache[panoId]) {
                // If the cache doesn't exist this is the first panorama after load. Create it and assign the base position
                this.dataCache[panoId] = new Location();
                this.dataCache[panoId].position = this.config.BASE_POSITION;
                // Google Maps API doesn't provide a callback for when it loads. We considered loaded at this point 
                // Look for the canvas somewhere inside the container
                this.canvas = this.config.PANO_CONTAINER.querySelector("canvas");                
                this.onPanoramaLoaded();
            }
            // Update the location on the cache
            if (!this.dataCache[panoId].location) {
                this.dataCache[panoId].location = { lat: this.panorama.location.latLng.lat(), lng: this.panorama.location.latLng.lng()};
            }
            
            
            let prevLocation = this.dataCache[this.currentPanoId];
            let currentLocation = this.dataCache[panoId];
            if (currentLocation && prevLocation && prevLocation.links && prevLocation.links[panoId]) {
                if (!currentLocation.position) {
                    // Compute the new position if it doesn't exist
                    this.computePosition3D(this.currentPanoId, panoId, prevLocation.links[panoId].heading);
                    if (currentLocation.position) {
                        this.onPanoPositionChanged(currentLocation.position);
                    }
                }
            }
            this.currentPanoId = panoId;
        });

        this.panorama.addListener("pov_changed", () => {
            // Trigger the callback with the new panorama POV data
            this.updatePov();
        });
    }

    updatePov() {
        let pov = this.panorama.getPov();
        this.onPanoPovChanged(pov);
    }

    getCurrentPosition() {
        return this.dataCache[this.currentPanoId].position;
    }
}

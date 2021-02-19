import * as CT from './constants.js';
import { THREE } from './constants.js';

class Location {
    constructor() {
        this.data = null;
        this.position = null;
        this.links = null;
    }
    setData(data) {
        this.data = data;
    }
}

export class Panorama{
    constructor() {
        this.panorama = null;
        this.canvas = null;
        this.dataCache = {};
        this.currentPanoId = null;
        this.config = null;
        this.loaded = false;
        this.onPanoramaLoaded = null;
        this.positionChanged = false;
        this.firstRun = true;
        this.offsets = [];
        this.maxOffsetDistance = 3;
        this.currentOffsetIdx = -1;
    }

    computeOffsetsAt(nodes, point) {
        let avaliableOffsets = [];
        for (let i = 0; i < this.offsets.length; i++) {
            avaliableOffsets.push(true);
        }
        let ids = Object.keys(nodes);
        let recomputeCurrentOffset = false;
        for (let i = 0; i < ids.length; i++) {
            let node = nodes[ids[i]];
            if (node.position.distanceTo(point) < (this.maxOffsetDistance + CT.EPSILON)) {
                let nodeOffset = new THREE.Vector3().copy(node.position).sub(point);
                let offsetFound = -1;
                this.offsets.forEach(offset, index => {
                    if (this.offset.distanceTo(nodeOffset) < CT.EPSILON) {
                        recomputeCurrentOffset = recomputeCurrentOffset || index === this.currentOffsetIdx;
                        offsetFound = index;
                        avaliableOffsets[index] = false;
                    }
                });
                if (offsetFound !== -1) {
                    node.offsetIndex = offsetFound;
                    break;
                }
            }
        }
        if (recomputeCurrentOffset) {
            for (let i = 0; i < avaliableOffsets.length; i++) {
                if (avaliableOffsets[i]) {
                    this.currentOffsetIdx = i;
                }
            }
        }
        return this.offsets[this.currentOffsetIdx];
    }

    generateOffsets() {
        let aroundCount = 6;
        for (let j = 1; j <= this.maxOffsetDistance; j++) {
            for (let i = 0; i < aroundCount - 1; i++) {
                let angle = 2 * Math.PI * (i / aroundCount);
                let offset = new THREE.Vector3(1.5 * j * Math.cos(angle), 0.0, 1.5 * j * Math.sin(angle));
                this.offsets.push(offset);
            }
        }
    }

    computePosition(fromId, toId, heading) {
        let fromData = this.dataCache[fromId];
        let toData = this.dataCache[toId];
        if (fromData && toData && fromData.data && toData.data) {
            let distance = 1.4 * Panorama.getDistanceBetween(fromData.data.location, toData.data.location);
            //console.log("Distance: " + distance);
            let offset = new THREE.Vector3(-distance * Math.cos(heading / CT.RADIANS_TO_DEGREES), 0, -distance * Math.sin(heading / CT.RADIANS_TO_DEGREES));
            toData.position = new THREE.Vector3(fromData.position.x,fromData.position.y, fromData.position.z);
            toData.position.add(offset);
            //console.log("Catch");
        }
    }

    static getDistanceBetween(loc1, loc2) {
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
    
    tryToCollectDataFrom({panoId, links, fromId, heading}) {
        let location = this.dataCache[panoId];
        if (!location) {
            this.dataCache[panoId] = new Location();
            location = this.dataCache[panoId];
        }
        if (!location.data) {
            this.getPanoData(panoId).then((pdata) => {
                location.setData(pdata);
                if (fromId && heading && this.dataCache[fromId].data) {
                    this.computePosition(fromId, panoId, heading);
                }
            });
        }
        if (links && !location.links) {
            location.links = {};
            links.forEach(link => {
                location.links[link.pano] = link;
                this.tryToCollectDataFrom({panoId: link.pano, fromId: panoId, heading: link.heading});
            });
        }
    }

    init(config) {
        this.config = config;
        this.generateOffsets();
        this.currentOffsetIdx = Math.floor(Math.random() * this.offsets.length);
        this.panorama = new google.maps.StreetViewPanorama(config.container, config);

        this.panorama.addListener("pano_changed", () => {
        });
        
        this.panorama.addListener("links_changed", () => {
            this.tryToCollectDataFrom({panoId: this.currentPanoId, links: this.panorama.getLinks()});
        });

        this.panorama.addListener("position_changed", () => {

            let panoId = this.panorama.getPano();     
            if (!this.loaded) {
                this.dataCache[panoId] = new Location();
                this.dataCache[panoId].position = this.config.initialPosition;
            } 
            if (this.dataCache[panoId] && this.dataCache[panoId].position) {
                let pos = this.dataCache[panoId].position;
                this.onPanoPositionChanged(pos);
            }     
            this.currentPanoId = panoId;
            this.tryToCollectDataFrom({panoId: panoId});
            if (!this.loaded) {
                this.loaded = true;
                this.canvas = this.config.container.querySelector("canvas");                
                this.onPanoramaLoaded();
            }
        });

        this.panorama.addListener("pov_changed", () => {
            this.onPanoPovChanged(this.panorama.getPov());
        });
    }
    async getPanoData(panoId) {
        const request = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?key=${CT.API_TOKEN}&pano=${panoId}`);
        const data = await request.json();
        return data;
    };
}

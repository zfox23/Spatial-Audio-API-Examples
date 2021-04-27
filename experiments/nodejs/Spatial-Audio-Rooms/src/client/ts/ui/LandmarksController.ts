import { Point3D } from "hifi-spatial-audio";
import { appConfigController, localSoundsController } from "..";
import { Utilities } from "../utilities/Utilities";

export class Landmark {
    name: string;
    drawName: boolean;
    positionM: Point3D;
    radiusM: number;
    clickSoundSRC: string;
    randomSoundRate: boolean;

    constructor({
        name,
        drawName = false,
        positionM,
        radiusM,
        clickSoundSRC,
        randomSoundRate = false,
    }: {
        name: string,
        drawName?: boolean;
        positionM: Point3D,
        radiusM: number,
        clickSoundSRC?: string,
        randomSoundRate?: boolean,
    }) {
        this.name = name;
        this.drawName = drawName;
        this.positionM = positionM;
        this.radiusM = radiusM;
        this.clickSoundSRC = clickSoundSRC;
        this.randomSoundRate = randomSoundRate;
    }
}

export class LandmarksController {
    landmarksInitialized: boolean = false;
    landmarks: Array<Landmark>;

    constructor() {
        this.landmarks = [];

        if (appConfigController.configComplete) {
            this.initializeLandmarks();
        } else {
            appConfigController.onConfigComplete.push(this.initializeLandmarks.bind(this));
        }
    }

    initializeLandmarks() {
        this.landmarks = appConfigController.landmarks;
        this.landmarksInitialized = true;
    }

    landmarkClicked(clickedLandmark: Landmark) {
        if (clickedLandmark.clickSoundSRC) {
            let src;
            if (Array.isArray(clickedLandmark.clickSoundSRC)) {
                src = clickedLandmark.clickSoundSRC[Utilities.randomIntBetween(0, clickedLandmark.clickSoundSRC.length)];
            } else {
                src = clickedLandmark.clickSoundSRC;
            }

            localSoundsController.playSound({
                src,
                positionM: clickedLandmark.positionM,
                randomSoundRate: clickedLandmark.randomSoundRate,
                localOnly: false,
            });
        }
    }
}
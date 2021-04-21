import '../../css/signals.scss';
import { Point3D } from "hifi-spatial-audio";
import SignalStar from '../../images/signalStar.png';
import SignalLine from '../../images/signalLine.png';
import PositiveDingC4 from '../../audio/positiveDingC4.mp3';
import PositiveDingE4 from '../../audio/positiveDingE4.mp3';
import PositiveDingG4 from '../../audio/positiveDingG4.mp3';
import NegativeDingC2 from '../../audio/negativeDingC2.mp3';
import NegativeDingDsharp2 from '../../audio/negativeDingDsharp2.mp3';
import NegativeDingG2 from '../../audio/negativeDingG2.mp3';
import { Utilities } from "../utilities/Utilities";
import { PARTICLES, SIGNALS } from "../constants/constants";
import { connectionController, particleController, userDataController, webSocketConnectionController } from "..";
import { Particle } from "./ParticleController";
declare var HIFI_SPACE_NAME: string;

export interface Signal {
    name: string;
    dimensions: Point3D;
    imageSRC: string;
    msAfterTargetReachedToDelete: number;
    sounds: Array<string>;
    volume: number;
}

export interface SignalParams {
    name: string;
    currentWorldPositionM: Point3D;
    dimensionsM: Point3D;
    targetWorldPositionM: Point3D;
    msAfterTargetReachedToDelete: number;
}

export class SignalsController {
    normalModeCanvas: HTMLCanvasElement;
    localAudio1: HTMLAudioElement;
    localAudio2: HTMLAudioElement;
    localAudioElToUse: HTMLAudioElement;
    signalButtonContainer: HTMLDivElement;
    signalButton__positive: HTMLButtonElement;
    signalButton__negative: HTMLButtonElement;
    activeSignal: Signal;
    supportedSignals: Map<string, Signal>;

    constructor() {
        this.activeSignal = undefined;
        this.supportedSignals = new Map();
        this.supportedSignals.set("positive", {
            "name": "positive",
            "dimensions": new Point3D({
                x: 0.15,
                z: 0.15,
            }),
            "imageSRC": SignalStar,
            "msAfterTargetReachedToDelete": 500,
            "sounds": [PositiveDingC4, PositiveDingE4, PositiveDingG4],
            "volume": 0.35
        });
        this.supportedSignals.set("negative", {
            "name": "negative",
            "dimensions": new Point3D({
                x: 0.15,
                z: 0.15,
            }),
            "imageSRC": SignalLine,
            "msAfterTargetReachedToDelete": 500,
            "sounds": [NegativeDingC2, NegativeDingDsharp2, NegativeDingG2],
            "volume": 0.35
        });

        this.normalModeCanvas = document.querySelector('.normalModeCanvas');

        this.localAudio1 = document.createElement("audio");
        this.localAudio1.classList.add("miscLocalAudio1");
        document.body.appendChild(this.localAudio1);

        this.localAudio2 = document.createElement("audio");
        this.localAudio2.classList.add("miscLocalAudio2");
        document.body.appendChild(this.localAudio2);

        this.localAudioElToUse = this.localAudio2;

        this.signalButtonContainer = document.createElement("div");
        this.signalButtonContainer.classList.add('signalButtonContainer');
        document.body.appendChild(this.signalButtonContainer);

        this.signalButton__positive = document.createElement("button");
        this.signalButton__positive.classList.add('signalButton', 'signalButton--positive');
        this.signalButton__positive.addEventListener('click', (e) => {
            this.toggleActiveSignal(this.supportedSignals.get("positive"));
        });
        this.signalButtonContainer.appendChild(this.signalButton__positive);

        this.signalButton__negative = document.createElement("button");
        this.signalButton__negative.classList.add('signalButton', 'signalButton--negative');
        this.signalButton__negative.addEventListener('click', (e) => {
            this.toggleActiveSignal(this.supportedSignals.get("negative"));
        });
        this.signalButtonContainer.appendChild(this.signalButton__negative);
    }

    updateSignalUI() {
        let children = this.signalButtonContainer.children;
        for (let i = 0; i < children.length; i++) {
            children[i].classList.remove('signalButton--active');
        }

        this.normalModeCanvas.classList.remove("normalModeCanvas--positiveCursor");
        this.normalModeCanvas.classList.remove("normalModeCanvas--negativeCursor");

        if (!this.activeSignal) {
            return;
        }

        switch (this.activeSignal.name) {
            case this.supportedSignals.get("positive").name:
                this.signalButton__positive.classList.add('signalButton--active');
                this.normalModeCanvas.classList.add("normalModeCanvas--positiveCursor");
                break;
            case this.supportedSignals.get("negative").name:
                this.signalButton__negative.classList.add('signalButton--active');
                this.normalModeCanvas.classList.add("normalModeCanvas--negativeCursor");
                break;
            default:
                break;
        }
    }

    setActiveSignal(newSignal: Signal) {
        this.activeSignal = newSignal;
        this.updateSignalUI();
    }

    toggleActiveSignal(newSignal: Signal) {
        if (this.activeSignal === newSignal) {
            this.setActiveSignal(undefined);
        } else {
            this.setActiveSignal(newSignal);
        }
    }

    playSignalSound(signalName: string) {
        if (!(this.supportedSignals.has(signalName) && this.supportedSignals.get(signalName).sounds)) {
            return;
        }

        if (!this.localAudio1 || !this.localAudio2) {
            return;
        }

        if (this.localAudioElToUse === this.localAudio1) {
            this.localAudioElToUse = this.localAudio2;
        } else {
            this.localAudioElToUse = this.localAudio1;
        }
        
        let sounds = this.supportedSignals.get(signalName).sounds;
        let src = sounds[Math.floor(Math.random() * sounds.length)];
        
        this.localAudioElToUse.src = src;
        this.localAudioElToUse.volume = this.supportedSignals.get(signalName).volume;
        this.localAudioElToUse.play();
    }

    addSignal(params: SignalParams, forcePlaySound = false) {
        if (!params.name) {
            console.error(`Tried to add signal, but signal name was not specified!`);
            return;
        }

        if (!this.supportedSignals.has(params.name)) {
            console.error(`Tried to add signal, but signal name was unsupported!`);
            return;
        }

        particleController.addParticle(new Particle({
            currentWorldPositionM: params.currentWorldPositionM,
            dimensionsM: params.dimensionsM,
            targetWorldPositionM: params.targetWorldPositionM,
            msAfterTargetReachedToDelete: params.msAfterTargetReachedToDelete,
            imageSRC: this.supportedSignals.get(params.name).imageSRC,
            easing: PARTICLES.EASING.EASE_OUT_QUAD,
        }));

        let isCloseEnough = false;
        const myUserData = userDataController.myAvatar.myUserData;
        if (myUserData && myUserData.positionCurrent) {
            let distance = Utilities.getDistanceBetween2DPoints(params.targetWorldPositionM.x, params.targetWorldPositionM.z, myUserData.positionCurrent.x, myUserData.positionCurrent.z);
            isCloseEnough = distance < SIGNALS.RECEIVE_DISTANCE_M
        }

        if (forcePlaySound || isCloseEnough) {
            this.playSignalSound(params.name);
        }
    }

    addActiveSignal(targetWorldPositionM: Point3D) {
        if (!this.supportedSignals.get(this.activeSignal.name)) {
            console.error(`Tried to add active signal, but signal was unsupported!`);
            return;
        }

        let signalParams = {
            "name": this.activeSignal.name,
            "currentWorldPositionM": new Point3D({
                "x": Utilities.randomFloatBetween(targetWorldPositionM.x - SIGNALS.RANDOM_START_DISTANCE_M, targetWorldPositionM.x + SIGNALS.RANDOM_START_DISTANCE_M),
                "z": Utilities.randomFloatBetween(targetWorldPositionM.z - SIGNALS.RANDOM_START_DISTANCE_M, targetWorldPositionM.z + SIGNALS.RANDOM_START_DISTANCE_M)
            }),
            "dimensionsM": this.supportedSignals.get(this.activeSignal.name).dimensions,
            "targetWorldPositionM": targetWorldPositionM,
            "msAfterTargetReachedToDelete": this.supportedSignals.get(this.activeSignal.name).msAfterTargetReachedToDelete,
        };

        this.addSignal(signalParams, true);

        if (webSocketConnectionController) {
            webSocketConnectionController.socket.emit("addParticle", { visitIDHash: userDataController.myAvatar.myUserData.visitIDHash, spaceName: HIFI_SPACE_NAME, particleData: JSON.stringify(signalParams)} );
        }
    }
}

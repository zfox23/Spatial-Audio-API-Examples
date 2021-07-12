import { OrientationEuler3D, Point3D } from 'hifi-spatial-audio';
import { Howl, Howler } from 'howler';
import { userDataController, webSocketConnectionController } from '..';
import { Utilities } from '../utilities/Utilities';
import chair01 from '../../audio/chair01.wav';
import chair02 from '../../audio/chair02.wav';
import chair03 from '../../audio/chair03.wav';
import chair04 from '../../audio/chair04.wav';
export const chairSounds = [chair01, chair02, chair03, chair04];
declare var HIFI_SPACE_NAME: string;

export interface SoundParams {
    src: string;
    positionM: Point3D;
    randomSoundRate: boolean;
}

export class LocalSoundsController {
    localAudio1: HTMLAudioElement;
    localAudio2: HTMLAudioElement;
    localAudioElToUse: HTMLAudioElement;

    constructor() {
        this.localAudio1 = document.createElement("audio");
        this.localAudio1.classList.add("miscLocalAudio1");
        document.body.appendChild(this.localAudio1);

        this.localAudio2 = document.createElement("audio");
        this.localAudio2.classList.add("miscLocalAudio2");
        document.body.appendChild(this.localAudio2);

        this.localAudioElToUse = this.localAudio2;
    }

    playSound({src, volume = 1.0, interrupt = true}: {src: string, volume?: number, interrupt?: boolean}) {
        if (!this.localAudio1 || !this.localAudio2) {
            return;
        }

        if (!interrupt && !this.localAudioElToUse.paused) {
            return;
        }

        if (this.localAudioElToUse === this.localAudio1) {
            this.localAudioElToUse = this.localAudio2;
        } else {
            this.localAudioElToUse = this.localAudio1;
        }
        
        this.localAudioElToUse.src = src;
        this.localAudioElToUse.volume = volume;
        this.localAudioElToUse.play();
    }
}

export class HowlerController {
    latestHowl: Howl;

    constructor() {
        // We have to call this in order to set up the audio context, because it isn't
        // getting set up automatically, for some reason.
        Howler.volume(1.0);
        Howler.pos(0, 0, 0);
        let howlerAngleRadians = 0;
        //Howler.orientation(Math.cos(howlerAngleRadians), 0, Math.sin(howlerAngleRadians), 0, 1, 0);
    }

    onMyGlobalPositionChanged(myNewGlobalPosition: Point3D) {
        //let howler = Howler.pos(myNewGlobalPosition.x, myNewGlobalPosition.z, myNewGlobalPosition.y);
        Howler.pos(0, 0, 0);
        Howler.stop();
    }

    getHowlerYawAngleRadians(yawAngleDegrees: number) {
        // In Howler space:
        // +x is east.
        // +y is north.
        // +z is up.
        // Translate our avatar's angle into the Howler angle format.
        let howlerAngleRadians = ((yawAngleDegrees + 90) * Math.PI / 180);
        while (howlerAngleRadians < 0) {
            howlerAngleRadians += (Math.PI * 2);
        }
        howlerAngleRadians %= (Math.PI * 2);
        return howlerAngleRadians;
    }

    updateHowlerOrientation(newOrientation: OrientationEuler3D) {
        let rads = this.getHowlerYawAngleRadians(newOrientation.yawDegrees);
        Howler.orientation(Math.cos(rads), Math.sin(rads), 0, 0, 0, 1);
    }

    playSound({src, volume = 1.0, positionM, randomSoundRate = false, localOnly = true}: { src: string, volume?: number, positionM: Point3D, randomSoundRate?: boolean, localOnly?: boolean}) {
        if (!(userDataController.myAvatar.myUserData.positionCurrent && positionM)) {
            return;
        }

        let sound = new Howl({
            src,
        });

        this.latestHowl = sound;

        // In Howler space:
        // +x is east.
        // +y is north.
        // +z is up.
        let originalSoundPosition = {
            "x": -(userDataController.myAvatar.myUserData.positionCurrent.x - positionM.x),
            "y": userDataController.myAvatar.myUserData.positionCurrent.z - positionM.z,
            "z": 0
        };

        console.log(`In Howler coordinates, playing sound at position relative to listener of\n{x: ${originalSoundPosition.x}, y: ${originalSoundPosition.y}, z: ${originalSoundPosition.z}}`);

        sound.pos(originalSoundPosition.x, originalSoundPosition.y, originalSoundPosition.z);
        if (randomSoundRate) {
            sound.rate(Utilities.randomFloatBetween(0.8, 1.5));
        }
        sound.volume(volume);

        sound.play();
        
        let rads = this.getHowlerYawAngleRadians(userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees);
        Howler.orientation(Math.cos(rads), Math.sin(rads), 0, 0, 0, 1);

        if (!localOnly && webSocketConnectionController) {
            let soundParams: SoundParams = {
                "src": src,
                "positionM": positionM,
                "randomSoundRate": randomSoundRate
            };

            webSocketConnectionController.socket.emit("addSound", { visitIDHash: userDataController.myAvatar.myUserData.visitIDHash, spaceName: HIFI_SPACE_NAME, soundParams: JSON.stringify(soundParams)} );
        }
    }
}
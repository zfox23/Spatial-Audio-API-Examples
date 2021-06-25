import { OrientationEuler3D, Point3D } from 'hifi-spatial-audio';
import { Howl, Howler } from 'howler';
import { userDataController, webSocketConnectionController } from '..';
import { Utilities } from '../utilities/Utilities';
declare var HIFI_SPACE_NAME: string;

export interface SoundParams {
    src: string;
    positionM: Point3D;
    randomSoundRate: boolean;
}

export class LocalSoundsController {
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

    playSound({src, positionM, randomSoundRate = false, localOnly = true}: { src: string, positionM: Point3D, randomSoundRate?: boolean, localOnly?: boolean}) {
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
import { OrientationEuler3D, Point3D } from 'hifi-spatial-audio';
import { Howl, Howler } from 'howler';
import { userDataController, webSocketConnectionController } from '..';
import { Utilities } from '../utilities/Utilities';
declare var HIFI_SPACE_NAME: string;

export interface SoundParams {
    src: string;
    positionM: Point3D;
}

export class LocalSoundsController {
    constructor() {
        // We have to call this in order to set up the audio context, because it isn't
        // getting set up automatically, for some reason.
        Howler.volume(1.0);
    }

    updateLocalPosition(newPosition: Point3D) {
        // This doesn't seem to actually set the listener position in Howler?
        console.log(`Setting Howler position: ${JSON.stringify(newPosition)}`);
        let howler = Howler.pos(newPosition.x, newPosition.y, newPosition.z);
        console.log(howler);
    }

    updateLocalOrientation(newOrientation: OrientationEuler3D) {
        // Translate our avatar's angle into the Howler angle format.
        let angleRadians = (newOrientation.yawDegrees - 90) * Math.PI / 180;
        Howler.orientation(Math.cos(angleRadians), 0, Math.sin(angleRadians), 0, -1, 0);
    }

    playSound({src, positionM, randomSoundRate = false, localOnly = true}: { src: string, positionM: Point3D, randomSoundRate?: boolean, localOnly?: boolean}) {
        let sound = new Howl({
            src,
        });
        sound.pos(positionM.x, positionM.y, positionM.z);
        if (randomSoundRate) {
            sound.rate(Utilities.randomFloatBetween(0.8, 1.5));
        }
        sound.play();

        if (!localOnly && webSocketConnectionController) {
            let soundParams: SoundParams = {
                "src": src,
                "positionM": positionM
            };

            webSocketConnectionController.socket.emit("addSound", { visitIDHash: userDataController.myAvatar.myUserData.visitIDHash, spaceName: HIFI_SPACE_NAME, soundParams: JSON.stringify(soundParams)} );
        }
    }
}
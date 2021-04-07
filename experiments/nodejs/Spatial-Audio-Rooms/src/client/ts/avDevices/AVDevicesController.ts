import { getBestAudioConstraints } from "hifi-spatial-audio";
import { connectionController, videoController } from "..";

export class AVDevicesController {
    inputAudioMediaStream: MediaStream;
    outputAudioElement: HTMLAudioElement;
    audioConstraints: MediaTrackConstraints;
    currentAudioInputDeviceID: string;
    currentVideoDeviceID: string;

    constructor() {
        this.audioConstraints = getBestAudioConstraints();
        this.inputAudioMediaStream = undefined;
        this.outputAudioElement = document.createElement("audio");
        this.outputAudioElement.classList.add("displayNone");
        this.outputAudioElement.setAttribute("autoplay", "true");
        document.body.appendChild(this.outputAudioElement);
    }

    async changeAudioInputDevice(newInputDeviceID: string) {
        console.log(`Attempting to change audio input device to device with ID \`${newInputDeviceID}\`...`);

        let oldInputDeviceID = this.currentAudioInputDeviceID;

        try {
            this.audioConstraints.deviceId = newInputDeviceID;
            await connectionController.setNewInputAudioMediaStream();
        } catch (e) {
            this.audioConstraints.deviceId = oldInputDeviceID;
            console.log(`Couldn't change audio input device:\n${e}`);
            return;
        }

        this.currentAudioInputDeviceID = newInputDeviceID;
        console.log(`Successfully changed audio input device!`);
    }

    async changeVideoDevice(newVideoDeviceID: string) {
        console.log(`Attempting to change video device to device with ID \`${newVideoDeviceID}\`...`);
        this.currentVideoDeviceID = newVideoDeviceID;
        if (!videoController.videoIsMuted) {
            await videoController.toggleVideo();
            await videoController.toggleVideo();
        }
    }
}
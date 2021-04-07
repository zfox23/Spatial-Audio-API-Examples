import { getBestAudioConstraints } from "hifi-spatial-audio";
import { connectionController, videoController } from "..";

export class AVDevicesController {
    inputAudioMediaStream: MediaStream;
    outputAudioElement: HTMLAudioElement;
    audioConstraints: MediaTrackConstraints;
    currentAudioInputDeviceID: string;
    currentAudioOutputDeviceID: string;
    currentVideoDeviceID: string;

    constructor() {
        this.audioConstraints = getBestAudioConstraints();
        this.inputAudioMediaStream = undefined;
        this.outputAudioElement = document.createElement("audio");
        this.outputAudioElement.classList.add("outputAudioElement", "displayNone");
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

    changeAudioOutputDevice(newOutputDeviceID: string) {
        console.log(`Attempting to change audio output device to device with ID \`${newOutputDeviceID}\`...`);
        this.currentAudioOutputDeviceID = newOutputDeviceID;

        let allAudioNodes = document.querySelectorAll("audio");
        allAudioNodes.forEach((audioNode) => {
            if (typeof (audioNode as any).sinkId !== 'undefined') {
                (audioNode as any).setSinkId(this.currentAudioOutputDeviceID)
                    .then(() => {
                        console.log(`New audio output device with ID \`${this.currentAudioOutputDeviceID}\` successfully attached to \`${audioNode.classList[0]}\`.`);
                    })
                    .catch((error: any) => {
                        console.error(`Error when setting output device on \`${audioNode}\`:\n${error}`);
                    });
            } else {
                console.error('Your browser does not support output device selection.');
            }
        });
    
        let allVideoNodes = document.querySelectorAll("video");
        allVideoNodes.forEach((videoNode) => {
            if (typeof (videoNode as any).sinkId !== 'undefined') {
                (videoNode as any).setSinkId(this.currentAudioOutputDeviceID)
                    .then(() => {
                        console.log(`New audio output device with ID \`${this.currentAudioOutputDeviceID}\` successfully attached to \`${videoNode.classList[0]}\`.`);
                    })
                    .catch((error: any) => {
                        console.error(`Error when setting output device on \`${videoNode}\`:\n${error}`);
                    });
            } else {
                console.error('Your browser does not support output device selection.');
            }
        });
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
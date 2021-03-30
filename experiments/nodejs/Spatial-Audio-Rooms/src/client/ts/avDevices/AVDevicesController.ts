export class AVDevicesController {
    inputAudioMediaStream: MediaStream;
    outputAudioElement: HTMLAudioElement;

    constructor() {
        this.inputAudioMediaStream = undefined;
        this.outputAudioElement = document.createElement("audio");
        this.outputAudioElement.classList.add("displayNone");
        this.outputAudioElement.setAttribute("autoplay", "true");
        document.body.appendChild(this.outputAudioElement);
    }
}
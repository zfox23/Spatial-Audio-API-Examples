export class UIController {
    mainCanvas: HTMLElement;
    bottomControlsContainer: HTMLElement;

    constructor() {
        this.mainCanvas = document.createElement("canvas");
        this.mainCanvas.classList.add("mainCanvas");
        document.body.appendChild(this.mainCanvas);

        this.bottomControlsContainer = document.createElement("div");
        this.bottomControlsContainer.classList.add("bottomControlsContainer");
        this.bottomControlsContainer.innerHTML = "hello world";
        document.body.appendChild(this.bottomControlsContainer);
    }
}

import '../../css/controls.scss';
import { AudionetInitResponse, ConnectionController } from '../connection/ConnectionController';
import { CanvasRenderer } from './CanvasRenderer';

export class UIController {
    playOverlay: HTMLElement;
    canvasRenderer: CanvasRenderer;
    bottomControlsContainer: HTMLElement;
    toggleInputMuteButton: HTMLButtonElement;
    toggleOutputMuteButton: HTMLButtonElement;
    toggleVideoButton: HTMLButtonElement;
    participantsListContainer: HTMLElement;

    connectionController: ConnectionController;

    constructor({ connectionController }: {connectionController: ConnectionController}) {
        this.initPlayOverlay();
        this.canvasRenderer = new CanvasRenderer();
        this.initMainUI();
        this.removeLoadingOverlay();

        this.connectionController = connectionController;
    }

    initPlayOverlay() {
        this.playOverlay = document.createElement("div");
        this.playOverlay.classList.add("playOverlay");
        document.body.appendChild(this.playOverlay);

        let playContainer = document.createElement("div");
        playContainer.classList.add("playOverlay__container");
        this.playOverlay.appendChild(playContainer);

        let playHeader = document.createElement("h1");
        playHeader.classList.add("playOverlay__header");
        playContainer.appendChild(playHeader);

        let playText = document.createElement("h2");
        playText.classList.add("playOverlay__playText");
        playText.innerHTML = `Put on your <span class="playOverlay__headphones">headphones</span> <span class="playOverlay__thenPress">then press play:</span>`;
        playContainer.appendChild(playText);

        let playButton = document.createElement("button");
        playButton.setAttribute('aria-label', "Enter Spatial Audio Rooms Demo");
        playButton.classList.add("playOverlay__button");

        let playAnimation = document.createElement("div");
        playAnimation.classList.add("playOverlay__playAnimation");
        playButton.appendChild(playAnimation);
        playContainer.appendChild(playButton);

        playButton.addEventListener("click", (e) => { this.startConnectionProcess(); });
    }

    initMainUI() {
        this.bottomControlsContainer = document.createElement("div");
        this.bottomControlsContainer.classList.add("bottomControlsContainer");
        document.body.appendChild(this.bottomControlsContainer);

        this.toggleInputMuteButton = document.createElement("button");
        this.toggleInputMuteButton.classList.add("toggleInputMuteButton");
        this.bottomControlsContainer.appendChild(this.toggleInputMuteButton);

        this.toggleOutputMuteButton = document.createElement("button");
        this.toggleOutputMuteButton.classList.add("toggleOutputMuteButton");
        this.bottomControlsContainer.appendChild(this.toggleOutputMuteButton);

        this.toggleVideoButton = document.createElement("button");
        this.toggleVideoButton.classList.add("toggleVideoButton");
        this.bottomControlsContainer.appendChild(this.toggleVideoButton);

        this.participantsListContainer = document.createElement("div");
        this.participantsListContainer.classList.add("participantsListContainer", "displayNone");
        document.body.appendChild(this.participantsListContainer);
    }

    removeLoadingOverlay() {
        document.querySelector('.loadingScreen').remove();
    }

    async startConnectionProcess() {
        this.playOverlay.classList.add("displayNone");

        let audionetInitResponse: AudionetInitResponse;
        try {
            audionetInitResponse = await this.connectionController.startConnectionProcess();
        } catch (e) {
            console.error(`Couldn't connect to High Fidelity! Error:\n${e}`);
            return;
        }
    }
}

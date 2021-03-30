import '../../css/controls.scss';

export class UIController {
    playOverlay: HTMLElement;
    mainCanvas: HTMLElement;
    bottomControlsContainer: HTMLElement;
    participantsListContainer: HTMLElement;

    onPlayButtonClicked: EventListener;

    constructor({ onPlayButtonClicked }: {onPlayButtonClicked: EventListener}) {
        this.initPlayOverlay();
        this.initMainUI();
        this.removeLoadingOverlay();

        this.onPlayButtonClicked = onPlayButtonClicked;
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

        playButton.addEventListener("click", (e) => { this.onPlayButtonClicked(e); });
    }

    initMainUI() {
        this.mainCanvas = document.createElement("canvas");
        this.mainCanvas.classList.add("mainCanvas");
        document.body.appendChild(this.mainCanvas);

        this.bottomControlsContainer = document.createElement("div");
        this.bottomControlsContainer.classList.add("bottomControlsContainer");
        document.body.appendChild(this.bottomControlsContainer);

        this.participantsListContainer = document.createElement("div");
        this.participantsListContainer.classList.add("participantsListContainer", "displayNone");
        document.body.appendChild(this.participantsListContainer);
    }

    removeLoadingOverlay() {
        document.querySelector('.loadingScreen').remove();
    }
}

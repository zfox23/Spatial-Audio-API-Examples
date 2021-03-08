class SignalsController {
    constructor() {
        this.activeSignalName = undefined;
        this.SUPPORTED_SIGNALS = {
            "POSITIVE": {
                "name": "POSITIVE",
                "dimensionsM": {
                    "width": 0.15,
                    "height": 0.15,
                },
                "imageSRC": "/spatial-speaker-space/images/signalStar.png",
                "msAfterTargetReachedToDelete": 500,
                "sound": {
                    "src": ["/spatial-speaker-space/audio/positiveDingC4.mp3", "/spatial-speaker-space/audio/positiveDingE4.mp3", "/spatial-speaker-space/audio/positiveDingG4.mp3"],
                    "volume": 0.35,
                },
            },
            "NEGATIVE": {
                "name": "NEGATIVE",
                "dimensionsM": {
                    "width": 0.15,
                    "height": 0.15,
                },
                "imageSRC": "/spatial-speaker-space/images/signalLine.png",
                "msAfterTargetReachedToDelete": 500,
                "sound": {
                    "src": ["/spatial-speaker-space/audio/negativeDingC2.mp3", "/spatial-speaker-space/audio/negativeDingDsharp2.mp3", "/spatial-speaker-space/audio/negativeDingG2.mp3"],
                    "volume": 0.35,
                },
            },
        };

        this.mainCanvas = document.querySelector('.mainCanvas');
        this.localAudio1 = document.querySelector(".miscLocalAudio1");
        this.localAudio2 = document.querySelector(".miscLocalAudio2");
        this.localAudioElToUse = this.localAudio1;

        this.signalButtonContainer = document.querySelector('.signalButtonContainer');

        this.signalButton__positive = document.querySelector('.signalButton--positive');
        this.signalButton__positive.addEventListener('click', (e) => {
            this.toggleActiveSignal(this.SUPPORTED_SIGNALS.POSITIVE.name);
        });

        this.signalButton__negative = document.querySelector('.signalButton--negative');
        this.signalButton__negative.addEventListener('click', (e) => {
            this.toggleActiveSignal(this.SUPPORTED_SIGNALS.NEGATIVE.name);
        });
    }

    updateSignalUI() {
        this.signalButtonContainer.childNodes.forEach((child) => {
            child.classList.remove('signalButton--active');
        });

        this.mainCanvas.classList.remove("mainCanvas--positiveCursor");
        this.mainCanvas.classList.remove("mainCanvas--negativeCursor");

        switch (this.activeSignalName) {
            case this.SUPPORTED_SIGNALS.POSITIVE.name:
                this.signalButton__positive.classList.add('signalButton--active');
                this.mainCanvas.classList.add("mainCanvas--positiveCursor");
                break;
            case this.SUPPORTED_SIGNALS.NEGATIVE.name:
                this.signalButton__negative.classList.add('signalButton--active');
                this.mainCanvas.classList.add("mainCanvas--negativeCursor");
                break;
            default:
                break;
        }
    }

    setActiveSignalByName(signalName) {
        this.activeSignalName = signalName;

        this.updateSignalUI();
    }

    toggleActiveSignal(signalName) {
        if (this.activeSignalName === signalName) {
            this.setActiveSignalByName(undefined);
        } else {
            this.setActiveSignalByName(signalName);
        }
    }

    playSignalSound(signalName) {
        if (!this.SUPPORTED_SIGNALS[signalName].sound) {
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
        
        let src = this.SUPPORTED_SIGNALS[signalName].sound.src;
        if (Array.isArray(src)) {
            src = src[Math.floor(Math.random() * src.length)];
        }
        
        this.localAudioElToUse.src = src;
        this.localAudioElToUse.volume = this.SUPPORTED_SIGNALS[signalName].sound.volume;
        this.localAudioElToUse.play();
    }

    addSignal(params, forcePlaySound = false) {
        if (!params.signalName) {
            console.error(`Tried to add signal, but signal name was not specified!`);
            return;
        }

        if (!this.SUPPORTED_SIGNALS[params.signalName]) {
            console.error(`Tried to add signal, but signal name was unsupported!`);
            return;
        }

        if (!params.imageSRC) {
            params.imageSRC = this.SUPPORTED_SIGNALS[this.activeSignalName].imageSRC;
        }

        params.easing = PARTICLES.EASING.EASE_OUT_QUAD;

        particleController.addParticle(params);

        let isCloseEnough = false;
        if (myUserData && myUserData.position) {
            let distance = getDistanceBetween2DPoints(params.targetWorldPositionM.x, params.targetWorldPositionM.z, myUserData.position.x, myUserData.position.z);
            isCloseEnough = distance < SIGNALS.RECEIVE_DISTANCE_M
        }

        if (forcePlaySound || isCloseEnough) {
            this.playSignalSound(params.signalName);
        }
    }

    addActiveSignal(targetWorldPositionM) {
        if (!this.SUPPORTED_SIGNALS[this.activeSignalName]) {
            console.error(`Tried to add active signal, but signal was unsupported!`);
            return;
        }

        let particleParams = {
            "signalName": this.activeSignalName,
            "currentWorldPositionM": {
                "x": randomFloatBetween(targetWorldPositionM.x - SIGNALS.RANDOM_START_DISTANCE_M, targetWorldPositionM.x + SIGNALS.RANDOM_START_DISTANCE_M),
                "z": randomFloatBetween(targetWorldPositionM.z - SIGNALS.RANDOM_START_DISTANCE_M, targetWorldPositionM.z + SIGNALS.RANDOM_START_DISTANCE_M)
            },
            "dimensionsM": this.SUPPORTED_SIGNALS[this.activeSignalName].dimensionsM,
            "targetWorldPositionM": targetWorldPositionM,
            "msAfterTargetReachedToDelete": this.SUPPORTED_SIGNALS[this.activeSignalName].msAfterTargetReachedToDelete,
        };

        this.addSignal(particleParams, true);

        if (socket) {
            socket.emit("addParticle", { visitIDHash: myVisitIDHash, spaceName, particleData: JSON.stringify(particleParams)} );
        }
    }
}

let signalsController = new SignalsController();
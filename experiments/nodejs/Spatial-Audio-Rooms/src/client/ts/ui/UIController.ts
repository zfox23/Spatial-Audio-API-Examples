import { avDevicesController, connectionController, physicsController, roomController, twoDimensionalRenderer, uiThemeController, userDataController, userInputController, webSocketConnectionController } from '..';
import '../../css/controls.scss';
import { AudionetInitResponse, ConnectionController } from '../connection/ConnectionController';
import { UserData } from '../userData/UserDataController';
import { Utilities } from '../utilities/Utilities';
import { TwoDimensionalRenderer } from '../render/TwoDimensionalRenderer';
import { PHYSICS } from '../constants/constants';

export class UIController {
    playOverlay: HTMLElement;
    modalBackground: HTMLDivElement;
    avatarContextMenu: HTMLDivElement;
    hasCompletedTutorial: boolean;
    zoomUIContainer: HTMLDivElement;

    constructor() {
        this.initPlayOverlay();
        this.initMainUI();
        this.initZoomUI();
        this.initContextMenu();
        this.hideLoadingOverlay();

        this.hasCompletedTutorial = localStorage.getItem("hasCompletedTutorial") === "true";
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
        let bottomBar = document.createElement("div");
        bottomBar.classList.add("bottomBar");
        bottomBar.addEventListener("click", (e) => { userInputController.hideSettingsMenu(); });
        document.body.appendChild(bottomBar);

        let bottomControlsContainer = document.createElement("div");
        bottomControlsContainer.classList.add("bottomControlsContainer");

        let myProfileContainer = document.createElement("div");
        myProfileContainer.classList.add("myProfileContainer");

        let myProfileImageContainer = document.createElement("div");
        myProfileImageContainer.classList.add("myProfileImageContainer");
        let myProfileImage = document.createElement("div");
        myProfileImage.classList.add("myProfileImage");
        myProfileImage.addEventListener("click", (e) => {
            this.showAvatarContextMenu(userDataController.myAvatar.myUserData);
        });
        myProfileImageContainer.appendChild(myProfileImage);
        myProfileContainer.appendChild(myProfileImageContainer);

        let myDisplayName = document.createElement("span");
        myDisplayName.classList.add("myDisplayName");
        myProfileContainer.appendChild(myDisplayName);

        let editMyProfileLink = document.createElement("a");
        editMyProfileLink.innerHTML = "Edit My Profile";
        editMyProfileLink.classList.add("editMyProfileLink");
        editMyProfileLink.addEventListener("click", (e) => {
            this.showAvatarContextMenu(userDataController.myAvatar.myUserData);
        });
        myProfileContainer.appendChild(editMyProfileLink);

        bottomControlsContainer.appendChild(myProfileContainer);

        let toggleInputMuteButton = document.createElement("button");
        toggleInputMuteButton.classList.add("bottomControlButton", "toggleInputMuteButton", "toggleInputMuteButton--unmuted");
        bottomControlsContainer.appendChild(toggleInputMuteButton);

        let toggleOutputMuteButton = document.createElement("button");
        toggleOutputMuteButton.classList.add("bottomControlButton", "toggleOutputMuteButton", "toggleOutputMuteButton--unmuted");
        bottomControlsContainer.appendChild(toggleOutputMuteButton);

        let toggleVideoButton = document.createElement("button");
        toggleVideoButton.classList.add("bottomControlButton", "toggleVideoButton");
        bottomControlsContainer.appendChild(toggleVideoButton);

        let toggleSettingsButton = document.createElement("button");
        toggleSettingsButton.classList.add("bottomControlButton", "toggleSettingsButton");
        bottomControlsContainer.appendChild(toggleSettingsButton);
        
        bottomBar.appendChild(bottomControlsContainer);

        let watchPartyControlsContainer = document.createElement("div");
        watchPartyControlsContainer.classList.add("watchPartyControlsContainer", "displayNone");

        let watchTogetherURLInput = document.createElement("input");
        watchTogetherURLInput.classList.add("watchTogetherURLInput");
        watchTogetherURLInput.type = "text";
        watchTogetherURLInput.placeholder = "Paste a YouTube URL";
        watchPartyControlsContainer.appendChild(watchTogetherURLInput);

        let watchTogetherButton = document.createElement("button");
        watchTogetherButton.classList.add("watchTogetherButton");
        watchTogetherButton.innerHTML = `Watch Together`;
        watchPartyControlsContainer.appendChild(watchTogetherButton);

        let leaveWatchPartyButton = document.createElement("button");
        leaveWatchPartyButton.classList.add("leaveWatchPartyButton", "displayNone");
        leaveWatchPartyButton.innerHTML = `Leave Watch Party`;
        watchPartyControlsContainer.appendChild(leaveWatchPartyButton);

        bottomBar.appendChild(watchPartyControlsContainer);

        this.modalBackground = document.createElement("div");
        this.modalBackground.classList.add("modalBackground", "displayNone");
        this.modalBackground.addEventListener("click", this.hideAvatarContextMenu.bind(this));
        document.body.appendChild(this.modalBackground);
    }

    updateMyProfileImage() {
        let myProfileImage = document.querySelector(".myProfileImage");
        if (myProfileImage) {
            (<HTMLElement>myProfileImage).style.backgroundColor = userDataController.myAvatar.myUserData.colorHex;
        }
    }

    updateMyDisplayName() {
        let myDisplayName = document.querySelector(".myDisplayName");
        if (myDisplayName) {
            myDisplayName.innerHTML = userDataController.myAvatar.myUserData.displayName;
        }
    }

    initZoomUI() {
        this.zoomUIContainer = document.createElement("div");
        this.zoomUIContainer.classList.add("zoomUIContainer");
        document.body.appendChild(this.zoomUIContainer);

        let zoomInButton = document.createElement("button");
        zoomInButton.classList.add("zoomButton", "zoomInButton");
        zoomInButton.addEventListener("click", () => {
            physicsController.smoothZoomStartTimestamp = undefined;
            physicsController.pxPerMTarget = (physicsController.pxPerMTarget || physicsController.pxPerMCurrent) + PHYSICS.PX_PER_M_STEP;
        });
        this.zoomUIContainer.appendChild(zoomInButton);

        let zoomOutButton = document.createElement("button");
        zoomOutButton.classList.add("zoomButton", "zoomOutButton");
        zoomOutButton.addEventListener("click", () => {
            physicsController.smoothZoomStartTimestamp = undefined;
            physicsController.pxPerMTarget = (physicsController.pxPerMTarget || physicsController.pxPerMCurrent) - PHYSICS.PX_PER_M_STEP;
        });
        this.zoomUIContainer.appendChild(zoomOutButton);
    }

    hideZoomUI() {
        this.zoomUIContainer.classList.add("displayNone");
    }

    showZoomUI() {
        this.zoomUIContainer.classList.remove("displayNone");
    }

    initContextMenu() {
        this.avatarContextMenu = document.createElement("div");
        this.avatarContextMenu.classList.add("avatarContextMenu", "displayNone");
        this.avatarContextMenu.addEventListener("click", (e) => { e.stopPropagation(); });
        this.modalBackground.appendChild(this.avatarContextMenu);
    }

    hideLoadingOverlay() {
        document.querySelector('.loadingScreen').classList.add("displayNone");
    }

    showConnectingOverlay() {
        let loadingScreen = <HTMLDivElement>document.querySelector('.loadingScreen');
        let loadingScreen__text = <HTMLDivElement>document.querySelector('.loadingScreen--text');
        loadingScreen__text.innerHTML = `connecting...`;
        loadingScreen.style.background = 'transparent';
        loadingScreen.classList.remove("displayNone");
    }

    async startConnectionProcess() {
        this.playOverlay.classList.add("displayNone");
        this.showConnectingOverlay();

        let audionetInitResponse: AudionetInitResponse;
        try {
            audionetInitResponse = await connectionController.startConnectionProcess();
        } catch (e) {
            console.error(`Couldn't connect to High Fidelity! Error:\n${e}`);
            return;
        }
        
        this.hideLoadingOverlay();
        roomController.toggleRoomList();
    }

    hideAvatarContextMenu() {
        this.modalBackground.classList.add("displayNone");
        this.avatarContextMenu.classList.add("displayNone");
        this.avatarContextMenu.removeAttribute('visit-id-hash');
    }

    generateCloseButtonUI() {
        let closeButton = document.createElement("button");
        closeButton.innerHTML = "X";
        closeButton.classList.add("avatarContextMenu__closeButton");
        uiThemeController.refreshThemedElements();
        closeButton.addEventListener("click", (e) => {
            this.hideAvatarContextMenu();
        });
        this.avatarContextMenu.appendChild(closeButton);
    }

    generateDisplayNameUI(userData: UserData) {
        let displayName;
        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
            displayName = document.createElement("input");
            displayName.classList.add("avatarContextMenu__displayName--mine");
            displayName.type = "text";
            displayName.value = userData.displayName;

            displayName.addEventListener('input', (e) => {
                userDataController.myAvatar.onMyDisplayNameChanged((<HTMLInputElement>e.target).value);
            });
        } else {
            displayName = document.createElement("h1");
            displayName.innerText = userData.displayName && userData.displayName.length > 0 ? userData.displayName : userData.providedUserID;
        }
        displayName.classList.add("avatarContextMenu__displayName");
        this.avatarContextMenu.appendChild(displayName);

        uiThemeController.refreshThemedElements();
    }

    generateColorHexUI(userData: UserData) {
        let colorHexInput;
        colorHexInput = document.createElement("input");
        colorHexInput.type = "color";
        colorHexInput.value = userData.colorHex || Utilities.hexColorFromString(userData.visitIDHash);

        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
            colorHexInput.classList.add("avatarContextMenu__colorHexInput--mine");

            colorHexInput.addEventListener('input', (e) => {
                userDataController.myAvatar.onMyColorHexChanged((<HTMLInputElement>e.target).value);
            });
        } else {
            colorHexInput.disabled = true;
        }

        colorHexInput.classList.add("avatarContextMenu__colorHexInput");
        this.avatarContextMenu.appendChild(colorHexInput);
    }

    generateEchoCancellationUI(userData: UserData) {
        if (typeof (userData.echoCancellationEnabled) !== "boolean") {
            return;
        }

        let echoCancellationContainer = document.createElement("div");
        echoCancellationContainer.classList.add("echoCancellationContainer");
        this.avatarContextMenu.appendChild(echoCancellationContainer);

        let echoCancellationCheckbox = document.createElement("input");
        echoCancellationCheckbox.id = "echoCancellationCheckbox";
        echoCancellationCheckbox.classList.add("echoCancellationCheckbox");
        echoCancellationCheckbox.type = "checkbox";
        echoCancellationCheckbox.checked = userData.echoCancellationEnabled;
        echoCancellationCheckbox.addEventListener("click", (e) => {
            let newEchoCancellationStatus = (<HTMLInputElement>e.target).checked;
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                userInputController.setEchoCancellationStatus(newEchoCancellationStatus)
            } else {
                if (webSocketConnectionController && newEchoCancellationStatus) {
                    webSocketConnectionController.requestToEnableEchoCancellation(userData.visitIDHash);
                } else if (webSocketConnectionController && !newEchoCancellationStatus) {
                    webSocketConnectionController.requestToDisableEchoCancellation(userData.visitIDHash);
                }
            }
        });
        echoCancellationContainer.appendChild(echoCancellationCheckbox);

        let echoCancellationCheckboxLabel = document.createElement("label");
        echoCancellationCheckboxLabel.setAttribute("for", "echoCancellationCheckbox");
        echoCancellationCheckboxLabel.classList.add("echoCancellationCheckboxLabel");
        echoCancellationCheckboxLabel.innerHTML = "Echo Cancellation";
        echoCancellationContainer.appendChild(echoCancellationCheckboxLabel);
    }

    generateAGCUI(userData: UserData) {
        if (typeof (userData.agcEnabled) !== "boolean") {
            return;
        }

        let agcContainer = document.createElement("div");
        agcContainer.classList.add("agcContainer");
        this.avatarContextMenu.appendChild(agcContainer);

        let agcCheckbox = document.createElement("input");
        agcCheckbox.id = "agcCheckbox";
        agcCheckbox.classList.add("agcCheckbox");
        agcCheckbox.type = "checkbox";
        agcCheckbox.checked = userData.agcEnabled;
        agcCheckbox.addEventListener("click", (e) => {
            let newAGCStatus = (<HTMLInputElement>e.target).checked;
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                userInputController.setAGCStatus(newAGCStatus)
            } else {
                if (webSocketConnectionController && newAGCStatus) {
                    webSocketConnectionController.requestToEnableAGC(userData.visitIDHash);
                } else if (webSocketConnectionController && !newAGCStatus) {
                    webSocketConnectionController.requestToDisableAGC(userData.visitIDHash);
                }
            }
        });
        agcContainer.appendChild(agcCheckbox);

        let agcCheckboxLabel = document.createElement("label");
        agcCheckboxLabel.setAttribute("for", "agcCheckbox");
        agcCheckboxLabel.classList.add("agcCheckboxLabel");
        agcCheckboxLabel.innerHTML = "Automatic Gain Control";
        agcContainer.appendChild(agcCheckboxLabel);
    }

    generateNoiseSuppressionUI(userData: UserData) {
        if (typeof (userData.noiseSuppressionEnabled) !== "boolean") {
            return;
        }

        let noiseSuppressionContainer = document.createElement("div");
        noiseSuppressionContainer.classList.add("noiseSuppressionContainer");
        this.avatarContextMenu.appendChild(noiseSuppressionContainer);

        let noiseSuppressionCheckbox = document.createElement("input");
        noiseSuppressionCheckbox.id = "noiseSuppressionCheckbox";
        noiseSuppressionCheckbox.classList.add("noiseSuppressionCheckbox");
        noiseSuppressionCheckbox.type = "checkbox";
        noiseSuppressionCheckbox.checked = userData.noiseSuppressionEnabled;
        noiseSuppressionCheckbox.addEventListener("click", (e) => {
            let newNoiseSuppressionStatus = (<HTMLInputElement>e.target).checked;
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                userInputController.setNoiseSuppressionStatus(newNoiseSuppressionStatus)
            } else {
                if (webSocketConnectionController && newNoiseSuppressionStatus) {
                    webSocketConnectionController.requestToEnableNoiseSuppression(userData.visitIDHash);
                } else if (webSocketConnectionController && !newNoiseSuppressionStatus) {
                    webSocketConnectionController.requestToDisableNoiseSuppression(userData.visitIDHash);
                }
            }
        });
        noiseSuppressionContainer.appendChild(noiseSuppressionCheckbox);

        let noiseSuppressionCheckboxLabel = document.createElement("label");
        noiseSuppressionCheckboxLabel.setAttribute("for", "noiseSuppressionCheckbox");
        noiseSuppressionCheckboxLabel.classList.add("noiseSuppressionCheckboxLabel");
        noiseSuppressionCheckboxLabel.innerHTML = "Noise Suppression";
        noiseSuppressionContainer.appendChild(noiseSuppressionCheckboxLabel);
    }

    generateUserGainForThisConnectionUI(userData: UserData) {
        let hifiCommunicator = connectionController.hifiCommunicator;

        if (!hifiCommunicator || userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
            return;
        }

        if (userData.userGainForThisConnection === undefined) {
            userData.userGainForThisConnection = 1.0;
        }

        let avatarContextMenu__userGainForThisConnectionContainer = document.createElement("div");
        avatarContextMenu__userGainForThisConnectionContainer.classList.add("avatarContextMenu__userGainForThisConnectionContainer");
        this.avatarContextMenu.appendChild(avatarContextMenu__userGainForThisConnectionContainer);

        let avatarContextMenu__userGainForThisConnectionHeader = document.createElement("h3");
        avatarContextMenu__userGainForThisConnectionHeader.innerHTML = `Volume (Personal): ${Math.round(userData.userGainForThisConnection * 100)}%`;
        avatarContextMenu__userGainForThisConnectionHeader.classList.add("avatarContextMenu__userGainForThisConnectionHeader");
        avatarContextMenu__userGainForThisConnectionContainer.appendChild(avatarContextMenu__userGainForThisConnectionHeader);

        let avatarContextMenu__userGainForThisConnectionSlider = document.createElement("input");
        avatarContextMenu__userGainForThisConnectionSlider.type = "range";
        avatarContextMenu__userGainForThisConnectionSlider.min = "0.0";
        avatarContextMenu__userGainForThisConnectionSlider.max = "4.0";
        avatarContextMenu__userGainForThisConnectionSlider.value = userData.userGainForThisConnection.toString();
        avatarContextMenu__userGainForThisConnectionSlider.step = "0.1";
        avatarContextMenu__userGainForThisConnectionSlider.classList.add("avatarContextMenu__userGainForThisConnectionSlider");

        // The `change` event fires when the user lets go of the slider.
        // The `input` event fires as the user moves the slider.
        avatarContextMenu__userGainForThisConnectionSlider.addEventListener("input", async (e) => {
            let userGainForThisConnectionSliderValue = parseFloat((<HTMLInputElement>e.target).value);
            try {
                await hifiCommunicator.setOtherUserGainForThisConnection(userData.visitIDHash, userGainForThisConnectionSliderValue);
                userData.userGainForThisConnection = userGainForThisConnectionSliderValue;
            } catch (e) {
                console.error(`Couldn't set user gain for this connection for Visit ID Hash \`${userData.visitIDHash}\`! Error:\n${JSON.stringify(e)}`);
                avatarContextMenu__userGainForThisConnectionSlider.value = userData.userGainForThisConnection.toString();
            }
            this.maybeUpdateAvatarContextMenu(userData);
        });

        avatarContextMenu__userGainForThisConnectionContainer.appendChild(avatarContextMenu__userGainForThisConnectionSlider);
    }

    generateHiFiGainUI(userData: UserData) {
        if (typeof (userData.hiFiGain) !== "number") {
            return;
        }

        let avatarContextMenu__hiFiGainContainer = document.createElement("div");
        avatarContextMenu__hiFiGainContainer.classList.add("avatarContextMenu__hiFiGainContainer");
        this.avatarContextMenu.appendChild(avatarContextMenu__hiFiGainContainer);

        let avatarContextMenu__hiFiGainHeader = document.createElement("h3");
        avatarContextMenu__hiFiGainHeader.innerHTML = `HiFi Gain (Global): ${Math.round(userData.hiFiGain * 100)}%`;
        avatarContextMenu__hiFiGainHeader.classList.add("avatarContextMenu__hiFiGainHeader");
        avatarContextMenu__hiFiGainContainer.appendChild(avatarContextMenu__hiFiGainHeader);

        let avatarContextMenu__hiFiGainSlider = document.createElement("input");
        avatarContextMenu__hiFiGainSlider.type = "range";
        avatarContextMenu__hiFiGainSlider.min = "1";
        avatarContextMenu__hiFiGainSlider.max = "21";
        avatarContextMenu__hiFiGainSlider.value = userData.hiFiGainSliderValue;
        avatarContextMenu__hiFiGainSlider.step = "1";
        avatarContextMenu__hiFiGainSlider.classList.add("avatarContextMenu__hiFiGainSlider");

        // The `input` event fires as the user is changing the value of the slider.
        avatarContextMenu__hiFiGainSlider.addEventListener("input", (e) => {
            let gainSliderValue = (<HTMLInputElement>e.target).value;
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                userInputController.setHiFiGainFromSliderValue(gainSliderValue);
            } else {
                webSocketConnectionController.requestToChangeHiFiGainSliderValue(userData.visitIDHash, gainSliderValue);
            }
        });

        avatarContextMenu__hiFiGainContainer.appendChild(avatarContextMenu__hiFiGainSlider);
    }

    generateVolumeThresholdUI(userData: UserData) {
        if (typeof (userData.volumeThreshold) !== "number") {
            return;
        }

        let avatarContextMenu__volumeThresholdContainer = document.createElement("div");
        avatarContextMenu__volumeThresholdContainer.classList.add("avatarContextMenu__volumeThresholdContainer");
        this.avatarContextMenu.appendChild(avatarContextMenu__volumeThresholdContainer);

        let avatarContextMenu__volumeThresholdHeader = document.createElement("h3");
        avatarContextMenu__volumeThresholdHeader.innerHTML = `Mic Threshold (Global): ${userData.volumeThreshold} dB`;
        avatarContextMenu__volumeThresholdHeader.classList.add("avatarContextMenu__volumeThresholdHeader");
        avatarContextMenu__volumeThresholdContainer.appendChild(avatarContextMenu__volumeThresholdHeader);

        let avatarContextMenu__volumeThresholdSlider = document.createElement("input");
        avatarContextMenu__volumeThresholdSlider.type = "range";
        avatarContextMenu__volumeThresholdSlider.min = "-96";
        avatarContextMenu__volumeThresholdSlider.max = "0";
        avatarContextMenu__volumeThresholdSlider.value = userData.volumeThreshold.toString();
        avatarContextMenu__volumeThresholdSlider.step = "1";
        avatarContextMenu__volumeThresholdSlider.classList.add("avatarContextMenu__volumeThresholdSlider");

        avatarContextMenu__volumeThresholdSlider.addEventListener("input", (e) => {
            let volumeThresholdSliderValue = parseInt((<HTMLInputElement>e.target).value);
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                userInputController.setVolumeThreshold(volumeThresholdSliderValue);
            } else {
                webSocketConnectionController.requestToChangeVolumeThreshold(userData.visitIDHash, volumeThresholdSliderValue);
            }
        });

        avatarContextMenu__volumeThresholdContainer.appendChild(avatarContextMenu__volumeThresholdSlider);
    }

    generateMuteForAllUI(userData: UserData) {
        if (typeof (userData.hiFiGain) !== "number") {
            return;
        }

        let muteForAllButton;
        muteForAllButton = document.createElement("button");
        muteForAllButton.classList.add("avatarContextMenu__muteForAllButton");
        muteForAllButton.innerHTML = "Mute this user's mic (Global)";
        muteForAllButton.addEventListener('click', (e) => {
            webSocketConnectionController.requestToMuteAudioInputDevice(userData.visitIDHash);
        });
        muteForAllButton.classList.add("avatarContextMenu__muteForAllButton");
        this.avatarContextMenu.appendChild(muteForAllButton);
    }

    showAvatarContextMenu(userData: UserData) {
        roomController.hideRoomList();

        this.avatarContextMenu.innerHTML = ``;

        this.generateCloseButtonUI();
        this.generateDisplayNameUI(userData);
        this.generateColorHexUI(userData);
        this.generateEchoCancellationUI(userData);
        this.generateAGCUI(userData);
        this.generateNoiseSuppressionUI(userData);
        this.generateUserGainForThisConnectionUI(userData);
        this.generateHiFiGainUI(userData);
        this.generateVolumeThresholdUI(userData);
        this.generateMuteForAllUI(userData);

        this.avatarContextMenu.setAttribute('visit-id-hash', userData.visitIDHash);

        this.modalBackground.classList.remove("displayNone");
        this.avatarContextMenu.classList.remove("displayNone");

        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
            this.hasCompletedTutorial = true;
            localStorage.setItem("hasCompletedTutorial", "true");
        }
    }

    maybeUpdateAvatarContextMenu(userData: UserData) {
        if (this.avatarContextMenu.getAttribute('visit-id-hash') !== userData.visitIDHash) {
            return;
        }

        (<HTMLHeadingElement>this.avatarContextMenu.querySelector('.avatarContextMenu__displayName')).innerText = userData.displayName ? userData.displayName : userData.providedUserID;

        let echoCancellationCheckbox = this.avatarContextMenu.querySelector(".echoCancellationCheckbox");
        if (echoCancellationCheckbox) {
            (<HTMLInputElement>echoCancellationCheckbox).checked = userData.echoCancellationEnabled;
        }

        let agcCheckbox = this.avatarContextMenu.querySelector(".agcCheckbox");
        if (agcCheckbox) {
            (<HTMLInputElement>agcCheckbox).checked = userData.agcEnabled;
        }

        let noiseSuppressionCheckbox = this.avatarContextMenu.querySelector(".noiseSuppressionCheckbox");
        if (noiseSuppressionCheckbox) {
            (<HTMLInputElement>noiseSuppressionCheckbox).checked = userData.noiseSuppressionEnabled;
        }

        let avatarContextMenu__hiFiGainSlider = <HTMLInputElement>this.avatarContextMenu.querySelector(".avatarContextMenu__hiFiGainSlider");
        let avatarContextMenu__hiFiGainHeader = <HTMLHeadingElement>this.avatarContextMenu.querySelector(".avatarContextMenu__hiFiGainHeader");
        if (avatarContextMenu__hiFiGainSlider) {
            avatarContextMenu__hiFiGainSlider.value = userData.hiFiGainSliderValue;
            avatarContextMenu__hiFiGainHeader.innerHTML = `HiFi Gain (Global): ${Math.round(userData.hiFiGain * 100)}%`;
        }

        let avatarContextMenu__userGainForThisConnectionSlider = <HTMLInputElement>this.avatarContextMenu.querySelector(".avatarContextMenu__userGainForThisConnectionSlider");
        let avatarContextMenu__userGainForThisConnectionHeader = <HTMLHeadingElement>this.avatarContextMenu.querySelector(".avatarContextMenu__userGainForThisConnectionHeader");
        if (avatarContextMenu__userGainForThisConnectionSlider) {
            avatarContextMenu__userGainForThisConnectionSlider.value = userData.userGainForThisConnection.toString();
            avatarContextMenu__userGainForThisConnectionHeader.innerHTML = `Volume (Personal): ${Math.round(userData.userGainForThisConnection * 100)}%`;
        }

        let avatarContextMenu__volumeThresholdSlider = <HTMLInputElement>this.avatarContextMenu.querySelector(".avatarContextMenu__volumeThresholdSlider");
        let avatarContextMenu__volumeThresholdHeader = <HTMLHeadingElement>this.avatarContextMenu.querySelector(".avatarContextMenu__volumeThresholdHeader");
        if (avatarContextMenu__volumeThresholdSlider) {
            avatarContextMenu__volumeThresholdSlider.value = userData.volumeThreshold.toString();
            avatarContextMenu__volumeThresholdHeader.innerHTML = `Mic Threshold (Global): ${userData.volumeThreshold} dB`;
        }
    }

    hiFiGainFromSliderValue(hiFiGainSliderValue: string) {
        // Make the UI look nice with a default gain slider value of 1.0 instead of 1.05...
        if (hiFiGainSliderValue === "11") {
            return 1.0;
        } else {
            return Utilities.logarithmicScale(parseInt(hiFiGainSliderValue), 1, 21, 1, 110) / 10;
        }
    }
}

import { accessibilityController, appConfigController, avDevicesController, connectionController, editorModeController, landmarksController, localSoundsController, pathsController, physicsController, roomController, signalsController, twoDimensionalRenderer, uiController, uiThemeController, userDataController, watchPartyController, webSocketConnectionController } from "..";
import { AVATAR, ROOM, CONTROLS, PHYSICS, PARTICLES } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";
import { SpatialStandupRoom, SpatialStandupRoomType, SpatialAudioSeat } from "../ui/RoomController";
import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { Landmark } from "./LandmarksController";

export class UserInputController {
    normalModeCanvas: HTMLCanvasElement;
    pointerEventCache: Array<PointerEvent> = [];
    documentKeyboardEventCache: Array<KeyboardEvent> = [];
    normalModeCanvasKeyboardEventCache: Array<KeyboardEvent> = [];
    wasMutedBeforePTT: boolean = false;
    toggleInputMuteButton: HTMLButtonElement;
    toggleOutputMuteButton: HTMLButtonElement;
    toggleVideoButton: HTMLButtonElement;
    toggleSettingsButton: HTMLButtonElement;
    leftClickStartPositionPX: any;
    lastDistanceBetweenLeftClickEvents: number;
    highlightedUserData: UserData;
    highlightedSeat: SpatialAudioSeat;
    highlightedRoom: SpatialStandupRoom;
    highlightedLandmark: Landmark;

    constructor() {
        this.toggleInputMuteButton = document.querySelector('.toggleInputMuteButton');
        this.toggleInputMuteButton.addEventListener("click", (e) => { this.toggleInputMute(); });
        this.toggleInputMuteButton.addEventListener("contextmenu", (e) => { this.toggleShowSettingsMenu(); e.preventDefault(); }, false);

        this.toggleOutputMuteButton = document.querySelector('.toggleOutputMuteButton');
        this.toggleOutputMuteButton.addEventListener("click", (e) => { this.toggleOutputMute(); });
        this.toggleOutputMuteButton.addEventListener("contextmenu", (e) => { this.toggleShowSettingsMenu(); e.preventDefault(); }, false);

        this.toggleVideoButton = document.querySelector('.toggleVideoButton');
        this.toggleVideoButton.addEventListener("contextmenu", (e) => { this.toggleShowSettingsMenu(); e.preventDefault(); }, false);

        this.toggleSettingsButton = document.querySelector('.toggleSettingsButton');
        this.toggleSettingsButton.addEventListener("click", (e) => { this.toggleShowSettingsMenu(); });
        this.toggleSettingsButton.addEventListener("contextmenu", (e) => { this.toggleShowSettingsMenu(); e.preventDefault(); }, false);

        this.normalModeCanvas = document.querySelector('.normalModeCanvas');
        this.normalModeCanvas.addEventListener("click", this.handleCanvasClick.bind(this));
        if (window.PointerEvent) {
            this.normalModeCanvas.addEventListener('pointerdown', this.handleGestureOnCanvasStart.bind(this), true);
            this.normalModeCanvas.addEventListener('pointermove', this.handleGestureOnCanvasMove.bind(this), true);
            this.normalModeCanvas.addEventListener('pointerup', this.handleGestureOnCanvasEnd.bind(this), true);
            this.normalModeCanvas.addEventListener("pointerout", this.handleGestureOnCanvasCancel.bind(this), true);
        } else {
            this.normalModeCanvas.addEventListener('touchstart', this.handleGestureOnCanvasStart.bind(this), true);
            this.normalModeCanvas.addEventListener('touchmove', this.handleGestureOnCanvasMove.bind(this), true);
            this.normalModeCanvas.addEventListener('touchend', this.handleGestureOnCanvasEnd.bind(this), true);
            this.normalModeCanvas.addEventListener("touchcancel", this.handleGestureOnCanvasCancel.bind(this), true);

            this.normalModeCanvas.addEventListener("mousedown", this.handleGestureOnCanvasStart.bind(this), true);
        }
        this.normalModeCanvas.addEventListener("gesturestart", (e) => { e.preventDefault(); }, false);
        this.normalModeCanvas.addEventListener("gesturechange", (e) => { e.preventDefault(); }, false);
        this.normalModeCanvas.addEventListener("gestureend", (e) => { e.preventDefault(); }, false);
        this.normalModeCanvas.addEventListener("contextmenu", (e) => { e.preventDefault(); }, false);

        this.normalModeCanvas.addEventListener("wheel", this.onWheel.bind(this), false);

        this.normalModeCanvas.addEventListener('keydown', this.onNormalModeCanvasKeyDown.bind(this), false);
        this.normalModeCanvas.addEventListener('keyup', this.onNormalModeCanvasKeyUp.bind(this), false);
        
        document.addEventListener('keydown', this.onDocumentKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onDocumentKeyUp.bind(this), false);
    }

    shouldIgnoreKeyDown() {
        let allInputElements = document.querySelectorAll("input");
        for (let i = 0; i < allInputElements.length; i++) {
            if (allInputElements[i] === document.activeElement) {
                return true;
            }
        }

        let allButtonElements = document.querySelectorAll("button");
        for (let i = 0; i < allButtonElements.length; i++) {
            if (allButtonElements[i] === document.activeElement) {
                return true;
            }
        }

        return false;
    }

    onDocumentKeyDown(event: KeyboardEvent) {
        let shouldAddKeyEvent = true;
        for (let i = 0; i < this.documentKeyboardEventCache.length; i++) {
            if (this.documentKeyboardEventCache[i].code === event.code) {
                shouldAddKeyEvent = false;
                break;
            }
        }
        if (shouldAddKeyEvent) {
            this.documentKeyboardEventCache.unshift(event);
        }

        if (this.shouldIgnoreKeyDown() || this.documentKeyboardEventCache.length === 0) {
            return;
        }

        switch (this.documentKeyboardEventCache[0].code) {
            case CONTROLS.LEFT_ARROW_KEY_CODE:
            case CONTROLS.A_KEY_CODE:
                userDataController.myAvatar.rotationalVelocityDegreesPerS = CONTROLS.ROTATIONAL_VELOCITY_DEGREES_PER_SEC;
                break;
            case CONTROLS.RIGHT_ARROW_KEY_CODE:
            case CONTROLS.D_KEY_CODE:
                userDataController.myAvatar.rotationalVelocityDegreesPerS = -CONTROLS.ROTATIONAL_VELOCITY_DEGREES_PER_SEC;
                break;
            case CONTROLS.E_KEY_CODE:
                if (this.documentKeyboardEventCache[0].ctrlKey) {
                    this.documentKeyboardEventCache[0].preventDefault();
                    editorModeController.toggleEditorMode();
                }
                break;
            case CONTROLS.M_KEY_CODE:
                this.toggleInputMute();
                break;
            case CONTROLS.SPACE_KEY_CODE:
                if (userDataController.myAvatar.myUserData.isAudioInputMuted) {
                    this.wasMutedBeforePTT = true;
                    this.setInputMute(false);
                }
                break;
            case CONTROLS.MINUS_KEY_CODE:
            case CONTROLS.NUMPAD_SUBTRACT_KEY_CODE:
                physicsController.smoothZoomStartTimestamp = undefined;
                physicsController.pxPerMTarget = (physicsController.pxPerMTarget || physicsController.pxPerMCurrent) - PHYSICS.PX_PER_M_STEP;
                break;
            case CONTROLS.EQUAL_KEY_CODE:
            case CONTROLS.NUMPAD_ADD_KEY_CODE:
                physicsController.smoothZoomStartTimestamp = undefined;
                physicsController.pxPerMTarget = (physicsController.pxPerMTarget || physicsController.pxPerMCurrent) + PHYSICS.PX_PER_M_STEP;
                break;
            case CONTROLS.DIGIT1_KEY_CODE:
                signalsController.toggleActiveSignal(signalsController.supportedSignals.get("positive"));
                break;
            case CONTROLS.DIGIT2_KEY_CODE:
                signalsController.toggleActiveSignal(signalsController.supportedSignals.get("negative"));
                break;
            case CONTROLS.ESC_KEY_CODE:
                signalsController.setActiveSignal(undefined);
                watchPartyController.leaveWatchParty();
                uiController.hideAvatarContextMenu();
                roomController.hideRoomList();
                this.hideSettingsMenu();
                break;
            case CONTROLS.U_KEY_CODE:
                userDataController.myAvatarEars.toggleConnection();
                break;
        }
    }

    onDocumentKeyUp(event: KeyboardEvent) {
        for (let i = this.documentKeyboardEventCache.length - 1; i >= 0; i--) {
            if (this.documentKeyboardEventCache[i].code === event.code) {
                this.documentKeyboardEventCache.splice(i, 1);
            }
        }

        switch (event.code) {
            case CONTROLS.LEFT_ARROW_KEY_CODE:
            case CONTROLS.A_KEY_CODE:
                userDataController.myAvatar.rotationalVelocityDegreesPerS = 0;
                break;
            case CONTROLS.RIGHT_ARROW_KEY_CODE:
            case CONTROLS.D_KEY_CODE:
                userDataController.myAvatar.rotationalVelocityDegreesPerS = 0;
                break;
            case CONTROLS.SPACE_KEY_CODE:
                if (this.wasMutedBeforePTT) {
                    this.setInputMute(true);
                    this.wasMutedBeforePTT = false;
                }
                break;
        }

        if (this.documentKeyboardEventCache.length > 0) {
            this.onDocumentKeyDown(this.documentKeyboardEventCache[0]);
        }
    }

    onNormalModeCanvasKeyDown(event: KeyboardEvent) {
        let shouldAddKeyEvent = true;
        for (let i = 0; i < this.normalModeCanvasKeyboardEventCache.length; i++) {
            if (this.normalModeCanvasKeyboardEventCache[i].code === event.code) {
                shouldAddKeyEvent = false;
                break;
            }
        }
        if (shouldAddKeyEvent) {
            this.normalModeCanvasKeyboardEventCache.unshift(event);
        }

        if (this.shouldIgnoreKeyDown() || this.normalModeCanvasKeyboardEventCache.length === 0) {
            return;
        }

        switch (this.normalModeCanvasKeyboardEventCache[0].code) {
            case CONTROLS.J_KEY_CODE:
            case CONTROLS.L_KEY_CODE:
                if (userDataController.myAvatar.myUserData.currentRoom) {
                    let currentHighlightedSeatIndex = 0;
                    if (this.highlightedSeat) {
                        for (let i = 0; i < userDataController.myAvatar.myUserData.currentRoom.seats.length; i++) {
                            let seat = userDataController.myAvatar.myUserData.currentRoom.seats[i];
                            if (seat === this.highlightedSeat) {
                                currentHighlightedSeatIndex = i;
                                break;
                            }
                        }
                    } else if (userDataController.myAvatar.myUserData.currentSeat) {
                        for (let i = 0; i < userDataController.myAvatar.myUserData.currentRoom.seats.length; i++) {
                            let seat = userDataController.myAvatar.myUserData.currentRoom.seats[i];
                            if (seat === userDataController.myAvatar.myUserData.currentSeat) {
                                currentHighlightedSeatIndex = i;
                                break;
                            }
                        }
                    }

                    if (this.normalModeCanvasKeyboardEventCache[0].code === CONTROLS.J_KEY_CODE) {
                        if (currentHighlightedSeatIndex === userDataController.myAvatar.myUserData.currentRoom.seats.length - 1) {
                            currentHighlightedSeatIndex = 0;
                        } else {
                            currentHighlightedSeatIndex++;
                        }
                    } else if (this.normalModeCanvasKeyboardEventCache[0].code === CONTROLS.L_KEY_CODE) {
                        if (currentHighlightedSeatIndex === 0) {
                            currentHighlightedSeatIndex = userDataController.myAvatar.myUserData.currentRoom.seats.length - 1;
                        } else {
                            currentHighlightedSeatIndex--;
                        }
                    }

                    let seat = userDataController.myAvatar.myUserData.currentRoom.seats[currentHighlightedSeatIndex];

                    if (seat.occupiedUserData) {
                        this.highlightedUserData = seat.occupiedUserData;
                        accessibilityController.speak(this.highlightedUserData.displayName, "polite", 250);
                    } else {
                        this.highlightedUserData = undefined;
                    }

                    this.highlightedSeat = seat;
                    if (!this.highlightedUserData && this.highlightedSeat) {
                        accessibilityController.speak("Open seat.", "polite", 250);
                    }
                }
                break;
            case CONTROLS.K_KEY_CODE:
                if (this.highlightedUserData) {
                    uiController.showAvatarContextMenu(this.highlightedUserData);
                    this.highlightedUserData = undefined;
                } else if (this.highlightedSeat) {
                    userDataController.myAvatar.moveToNewSeat(this.highlightedSeat);
                    this.highlightedSeat = undefined;
                }
                break;
        }
    }

    onNormalModeCanvasKeyUp(event: KeyboardEvent) {
        for (let i = this.normalModeCanvasKeyboardEventCache.length - 1; i >= 0; i--) {
            if (this.normalModeCanvasKeyboardEventCache[i].code === event.code) {
                this.normalModeCanvasKeyboardEventCache.splice(i, 1);
            }
        }

        switch (event.code) {
        }

        if (this.normalModeCanvasKeyboardEventCache.length > 0) {
            this.onNormalModeCanvasKeyDown(this.normalModeCanvasKeyboardEventCache[0]);
        }
    }

    hideSettingsMenu() {
        let settingsMenu = document.querySelector(".settingsMenu");
        if (settingsMenu) {
            settingsMenu.remove();
        }

        this.toggleSettingsButton.setAttribute("aria-label", "Open Device Settings");
    }

    toggleShowSettingsMenu() {
        roomController.hideRoomList();

        let settingsMenu = document.querySelector(".settingsMenu");
        if (settingsMenu) {
            this.hideSettingsMenu();
        } else {
            this.toggleSettingsButton.setAttribute("aria-label", "Close Device Settings");
            navigator.mediaDevices.enumerateDevices()
                .then((devices) => {
                    settingsMenu = document.createElement("div");
                    settingsMenu.classList.add("settingsMenu");

                    let settingsMenu__header = document.createElement("h1");
                    settingsMenu__header.id = "settingsMenu__header";
                    settingsMenu__header.setAttribute("aria-label", "Audio and Video Devices Menu");
                    settingsMenu__header.classList.add("settingsMenu__h1");
                    settingsMenu__header.innerHTML = "Devices";
                    settingsMenu.appendChild(settingsMenu__header);

                    let changeAudioInputDeviceMenu__header = document.createElement("h2");
                    changeAudioInputDeviceMenu__header.id = "changeAudioInputDeviceMenu__header";
                    changeAudioInputDeviceMenu__header.setAttribute("aria-label", "Audio Input Device");
                    changeAudioInputDeviceMenu__header.classList.add("settingsMenu__h2");
                    changeAudioInputDeviceMenu__header.innerHTML = `AUDIO INPUT DEVICE`;

                    let changeAudioInputDeviceMenu__select = document.createElement("select");
                    changeAudioInputDeviceMenu__select.setAttribute("aria-labelledby", "settingsMenu__header changeAudioInputDeviceMenu__header");
                    changeAudioInputDeviceMenu__select.classList.add("settingsMenu__select");

                    let numAudioInputDevices = 0;

                    let changeAudioOutputDeviceMenu__header = document.createElement("h2");
                    changeAudioOutputDeviceMenu__header.id = "changeAudioOutputDeviceMenu__header";
                    changeAudioOutputDeviceMenu__header.setAttribute("aria-label", "Audio Output Device");
                    changeAudioOutputDeviceMenu__header.classList.add("settingsMenu__h2");
                    changeAudioOutputDeviceMenu__header.innerHTML = `AUDIO OUTPUT DEVICE`;

                    let changeAudioOutputDeviceMenu__select = document.createElement("select");
                    changeAudioOutputDeviceMenu__select.setAttribute("aria-labelledby", "settingsMenu__header changeAudioOutputDeviceMenu__header");
                    changeAudioOutputDeviceMenu__select.classList.add("settingsMenu__select");

                    let numAudioOutputDevices = 0;

                    let changeVideoDeviceMenu__header = document.createElement("h2");
                    changeVideoDeviceMenu__header.id = "changeVideoDeviceMenu__header";
                    changeVideoDeviceMenu__header.setAttribute("aria-label", "Camera Device");
                    changeVideoDeviceMenu__header.classList.add("settingsMenu__h2");
                    changeVideoDeviceMenu__header.innerHTML = `VIDEO DEVICE`;

                    let changeVideoDeviceMenu__select = document.createElement("select");
                    changeVideoDeviceMenu__select.setAttribute("aria-labelledby", "settingsMenu__header changeVideoDeviceMenu__header");
                    changeVideoDeviceMenu__select.classList.add("settingsMenu__select");

                    let numVideoDevices = 0;

                    for (let i = 0; i < devices.length; i++) {
                        if (devices[i].kind === "audioinput") {
                            let deviceLabel = devices[i].label;

                            if (!deviceLabel || deviceLabel.length === 0) {
                                deviceLabel = "Unknown Device";
                            }

                            let changeAudioInputDeviceMenu__option = document.createElement("option");
                            changeAudioInputDeviceMenu__option.classList.add("settingsMenu__option");
                            changeAudioInputDeviceMenu__option.innerHTML = deviceLabel;
                            changeAudioInputDeviceMenu__option.value = devices[i].deviceId;

                            changeAudioInputDeviceMenu__select.appendChild(changeAudioInputDeviceMenu__option);

                            if (avDevicesController.currentAudioInputDeviceID && avDevicesController.currentAudioInputDeviceID === devices[i].deviceId) {
                                changeAudioInputDeviceMenu__select.selectedIndex = numAudioInputDevices;
                            }
                            numAudioInputDevices++;
                        } else if (devices[i].kind === "audiooutput") {
                            let deviceLabel = devices[i].label;

                            if (!deviceLabel || deviceLabel.length === 0) {
                                deviceLabel = "Unknown Device";
                            }

                            let changeAudioOutputDeviceMenu__option = document.createElement("option");
                            changeAudioOutputDeviceMenu__option.classList.add("settingsMenu__option");
                            changeAudioOutputDeviceMenu__option.innerHTML = deviceLabel;
                            changeAudioOutputDeviceMenu__option.value = devices[i].deviceId;

                            changeAudioOutputDeviceMenu__select.appendChild(changeAudioOutputDeviceMenu__option);

                            if (avDevicesController.currentAudioOutputDeviceID && avDevicesController.currentAudioOutputDeviceID === devices[i].deviceId) {
                                changeAudioOutputDeviceMenu__select.selectedIndex = numAudioOutputDevices;
                            }
                            numAudioOutputDevices++;
                        } else if (devices[i].kind === "videoinput") {
                            let deviceLabel = devices[i].label;

                            if (!deviceLabel || deviceLabel.length === 0) {
                                deviceLabel = "Unknown Device";
                            }

                            let changeVideoDeviceMenu__option = document.createElement("option");
                            changeVideoDeviceMenu__option.classList.add("settingsMenu__option");
                            changeVideoDeviceMenu__option.innerHTML = deviceLabel;
                            changeVideoDeviceMenu__option.value = devices[i].deviceId;

                            changeVideoDeviceMenu__select.appendChild(changeVideoDeviceMenu__option);

                            if (avDevicesController.currentVideoDeviceID && avDevicesController.currentVideoDeviceID === devices[i].deviceId) {
                                changeVideoDeviceMenu__select.selectedIndex = numVideoDevices;
                            }
                            numVideoDevices++;
                        }
                    };

                    changeAudioInputDeviceMenu__select.addEventListener("change", (e) => {
                        avDevicesController.changeAudioInputDevice((<HTMLSelectElement>e.target).value);
                    });

                    changeAudioOutputDeviceMenu__select.addEventListener("change", (e) => {
                        avDevicesController.changeAudioOutputDevice((<HTMLSelectElement>e.target).value);
                    });

                    changeVideoDeviceMenu__select.addEventListener("change", (e) => {
                        avDevicesController.changeVideoDevice((<HTMLSelectElement>e.target).value);
                    });

                    if (numAudioInputDevices > 0) {
                        settingsMenu.appendChild(changeAudioInputDeviceMenu__header);
                        settingsMenu.appendChild(changeAudioInputDeviceMenu__select);
                    }

                    if (numAudioOutputDevices > 0) {
                        settingsMenu.appendChild(changeAudioOutputDeviceMenu__header);
                        settingsMenu.appendChild(changeAudioOutputDeviceMenu__select);
                    }

                    if (numVideoDevices > 0) {
                        settingsMenu.appendChild(changeVideoDeviceMenu__header);
                        settingsMenu.appendChild(changeVideoDeviceMenu__select);
                    }

                    let closeButton = document.createElement("button");
                    closeButton.setAttribute("aria-label", "Close Device Settings");
                    closeButton.classList.add("settingsMenu__closeButton");
                    closeButton.addEventListener("click", (e) => {
                        this.hideSettingsMenu();
                    });
                    settingsMenu.appendChild(closeButton);

                    document.body.appendChild(settingsMenu);
                    uiThemeController.refreshThemedElements();
                })
                .catch((err) => {
                    console.error(`Error during \`enumerateDevices()\`: ${err}`);
                });
        }
    }

    async toggleInputMute() {
        await this.setInputMute(!userDataController.myAvatar.myUserData.isAudioInputMuted);

        if (userDataController.myAvatar.myUserData.isAudioInputMuted) {
            this.toggleInputMuteButton.setAttribute("aria-label", "Un-mute your Input Audio Device");
        } else {
            this.toggleInputMuteButton.setAttribute("aria-label", "Mute your Input Audio Device");
        }
    }

    async setInputMute(newMuteStatus: boolean) {
        let hifiCommunicator = connectionController.hifiCommunicator;

        if (!hifiCommunicator) {
            return;
        }

        if (userDataController.myAvatar.myUserData.isAudioInputMuted === newMuteStatus) {
            return;
        }

        if (await hifiCommunicator.setInputAudioMuted(newMuteStatus)) {
            userDataController.myAvatar.myUserData.isAudioInputMuted = newMuteStatus;

            if (userDataController.myAvatar.myUserData.isAudioInputMuted) {
                this.toggleInputMuteButton.classList.add("toggleInputMuteButton--muted");
                this.toggleInputMuteButton.classList.remove("toggleInputMuteButton--unmuted");
                uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleInputMuteButton, 'toggleInputMuteButton--unmuted', false);
            } else {
                this.toggleInputMuteButton.classList.remove("toggleInputMuteButton--muted");
                uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleInputMuteButton, 'toggleInputMuteButton--muted', false);
                this.toggleInputMuteButton.classList.add("toggleInputMuteButton--unmuted");
            }
            uiThemeController.refreshThemedElements();
            webSocketConnectionController.updateMyUserDataOnWebSocketServer();
        }
    }

    toggleOutputMute() {
        this.setOutputMute(!avDevicesController.outputAudioElement.muted);

        if (avDevicesController.outputAudioElement.muted) {
            this.toggleOutputMuteButton.setAttribute("aria-label", "Un-mute your Output Audio Device");
        } else {
            this.toggleOutputMuteButton.setAttribute("aria-label", "Mute your Output Audio Device");
        }
    }

    setOutputMute(newMuteStatus: boolean) {
        let allAudioNodes = document.querySelectorAll("audio");
        allAudioNodes.forEach((audioNode) => {
            audioNode.muted = !!newMuteStatus;
        });
        let allVideoNodes = document.querySelectorAll("video");
        allVideoNodes.forEach((videoNode) => {
            videoNode.muted = !!newMuteStatus;
        });
        console.log(`Set output mute status to \`${avDevicesController.outputAudioElement.muted}\``);

        if (avDevicesController.outputAudioElement.muted) {
            this.toggleOutputMuteButton.classList.remove("toggleOutputMuteButton--unmuted");
            uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleOutputMuteButton, 'toggleOutputMuteButton--unmuted', false);
            this.toggleOutputMuteButton.classList.add("toggleOutputMuteButton--muted");
        } else {
            this.toggleOutputMuteButton.classList.remove("toggleOutputMuteButton--muted");
            uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleOutputMuteButton, 'toggleOutputMuteButton--muted', false);
            this.toggleOutputMuteButton.classList.add("toggleOutputMuteButton--unmuted");
            // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
            avDevicesController.outputAudioElement.play();
        }
        uiThemeController.refreshThemedElements();
    }

    setEchoCancellationStatus(newEchoCancellationStatus: boolean) {
        if (typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().echoCancellation) {
            avDevicesController.audioConstraints.echoCancellation = newEchoCancellationStatus;
            connectionController.setNewInputAudioMediaStream();
        } else {
            console.warn("Can't set echoCancellation constraint; current browser doesn't support that constraint!");
        }
    }

    setAGCStatus(newAGCStatus: boolean) {
        if (typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().autoGainControl) {
            avDevicesController.audioConstraints.autoGainControl = newAGCStatus;
            connectionController.setNewInputAudioMediaStream();
        } else {
            console.warn("Can't set autoGainControl constraint; current browser doesn't support that constraint!");
        }
    }

    setNoiseSuppressionStatus(newNSStatus: boolean) {
        if (typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().noiseSuppression) {
            avDevicesController.audioConstraints.noiseSuppression = newNSStatus;
            connectionController.setNewInputAudioMediaStream();
        } else {
            console.warn("Can't set noiseSuppression constraint; current browser doesn't support that constraint!");
        }
    }

    setStereoInputStatus(newStereoInputStatus: boolean) {
        userDataController.myAvatar.myUserData.stereoInput = newStereoInputStatus;
        connectionController.setNewInputAudioMediaStream();
    }

    setHiFiGainFromSliderValue(newHiFiGainSliderValue: string) {
        let newHiFiGain = uiController.hiFiGainFromSliderValue(newHiFiGainSliderValue);

        userDataController.myAvatar.myUserData.hiFiGain = newHiFiGain;
        userDataController.myAvatar.myUserData.hiFiGainSliderValue = newHiFiGainSliderValue;
        console.log(`User changed their HiFiGain to ${newHiFiGain}`);
        connectionController.hifiCommunicator.updateUserDataAndTransmit({
            hiFiGain: newHiFiGain,
        });
        uiController.maybeUpdateAvatarContextMenu(userDataController.myAvatar.myUserData);
        webSocketConnectionController.updateMyUserDataOnWebSocketServer();

        return newHiFiGain;
    }

    setVolumeThreshold(newVolumeThreshold: number) {
        userDataController.myAvatar.myUserData.volumeThreshold = newVolumeThreshold;
        console.log(`User changed their Mic Volume Threshold to ${newVolumeThreshold}`);
        connectionController.hifiCommunicator.updateUserDataAndTransmit({
            volumeThreshold: newVolumeThreshold,
        });
        uiController.maybeUpdateAvatarContextMenu(userDataController.myAvatar.myUserData);
        webSocketConnectionController.updateMyUserDataOnWebSocketServer();
    }

    handleCanvasClick(event: TouchEvent | MouseEvent | PointerEvent) {
        editorModeController.handleCanvasClick(event);

        if (signalsController.activeSignal && (event instanceof MouseEvent || event instanceof PointerEvent)) {
            let clickM = new Point3D(Utilities.normalModeCanvasPXToM({ x: event.offsetX, y: event.offsetY }));

            let isCloseEnough = false;
            if (userDataController.myAvatar.myUserData && userDataController.myAvatar.myUserData.positionCurrent) {
                isCloseEnough = Utilities.getDistanceBetween2DPoints(userDataController.myAvatar.myUserData.positionCurrent.x, userDataController.myAvatar.myUserData.positionCurrent.z, clickM.x, clickM.z) < PARTICLES.CLOSE_ENOUGH_ADD_M;
            }

            if (isCloseEnough) {
                signalsController.addActiveSignal(clickM);
            }
        } else if (this.highlightedUserData) {
            uiController.showAvatarContextMenu(this.highlightedUserData);
            this.highlightedUserData = undefined;
        } else if (this.highlightedSeat && !this.highlightedSeat.occupiedUserData && !pathsController.currentPath) {
            console.log(`User clicked on a new seat at ${JSON.stringify(this.highlightedSeat.position)}! Target seat yaw orientation: ${JSON.stringify(this.highlightedSeat.orientation)} degrees.`);
            userDataController.myAvatar.moveToNewSeat(this.highlightedSeat);
            this.highlightedSeat = undefined;
        } else if (this.highlightedRoom && !pathsController.currentPath && this.highlightedRoom !== userDataController.myAvatar.myUserData.currentRoom) {
            console.log(`User clicked on the room named ${this.highlightedRoom.name}!`);
            userDataController.myAvatar.positionSelfInRoom(this.highlightedRoom.name);
            this.highlightedRoom = undefined;
        } else if (this.highlightedLandmark) {
            landmarksController.landmarkClicked(this.highlightedLandmark);
        }

        document.body.classList.remove("cursorPointer");
    }

    pushEvent(event: PointerEvent) {
        this.pointerEventCache.push(event);
    }

    removeEvent(event: PointerEvent) {
        for (let i = 0; i < this.pointerEventCache.length; i++) {
            if (this.pointerEventCache[i].pointerId === event.pointerId) {
                this.pointerEventCache.splice(i, 1);
                i--;
                break;
            }
        }
    }

    getEventFromCacheByID(idToFind: number) {
        for (let i = 0; i < this.pointerEventCache.length; i++) {
            let id = this.pointerEventCache[i].pointerId;

            if (id == idToFind) {
                return this.pointerEventCache[i];
            }
        }
        return null;
    }

    handleGestureOnCanvasStart(event: TouchEvent | MouseEvent | PointerEvent) {
        event.preventDefault();

        roomController.hideRoomList();
        uiController.hideAvatarContextMenu();
        this.hideSettingsMenu();

        let target = <HTMLElement>event.target;

        target.focus();

        if (event instanceof PointerEvent && event.pointerId) {
            this.pushEvent(event);
        } else if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent && event.changedTouches) {
            let touches = event.changedTouches;
            for (let i = 0; i < touches.length; i++) {
                let currentEvent = touches[i];
                let newEvent = new PointerEvent("pointerdown", {
                    "pointerId": currentEvent.identifier,
                    "clientX": currentEvent.clientX,
                    "clientY": currentEvent.clientY,
                    "button": 0,
                    "buttons": 0
                });
                this.pushEvent(newEvent);
            }
        }

        if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent && event.touches && event.touches.length > 1) {
            return;
        }

        if (window.PointerEvent && event instanceof PointerEvent) {
            target.setPointerCapture(event.pointerId);
        } else {
            this.normalModeCanvas.addEventListener('mousemove', this.handleGestureOnCanvasMove.bind(this), true);
            this.normalModeCanvas.addEventListener('mouseup', this.handleGestureOnCanvasEnd.bind(this), true);
        }

        let gesturePointPX = Utilities.getGesturePointFromEvent(event);

        if ((event instanceof PointerEvent || event instanceof MouseEvent) && event.buttons === 1) {
            this.leftClickStartPositionPX = gesturePointPX;
        }
    }

    handleGestureOnCanvasMove(event: TouchEvent | MouseEvent | PointerEvent) {
        event.preventDefault();

        let gesturePointPX = Utilities.getGesturePointFromEvent(event);

        if (this.pointerEventCache.length <= 1 && ((event instanceof MouseEvent || event instanceof PointerEvent) && event.buttons === 1) && this.leftClickStartPositionPX !== undefined && !pathsController.currentPath && !(userDataController.myAvatarEars.isConnecting || userDataController.myAvatarEars.isConnected)) {
            let newDistance = gesturePointPX.x - this.leftClickStartPositionPX.x;
            let deltaDistance = newDistance - this.lastDistanceBetweenLeftClickEvents;
            this.lastDistanceBetweenLeftClickEvents = newDistance;

            if (userDataController.myAvatar && userDataController.myAvatar.myUserData.orientationEulerCurrent) {
                let newYawDegrees = userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees - deltaDistance * CONTROLS.RIGHT_CLICK_ROTATION_SENSITIVITY;
                if (!isNaN(newYawDegrees)) {
                    userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees = newYawDegrees % 360;
                    let hifiCommunicator = connectionController.hifiCommunicator;
                    if (hifiCommunicator) {
                        hifiCommunicator.updateUserDataAndTransmit({ orientationEuler: new OrientationEuler3D({ yawDegrees: newYawDegrees }) });
                    }
                    localSoundsController.updateHowlerOrientation(userDataController.myAvatar.myUserData.orientationEulerCurrent);
                }
            }
        } else if (this.pointerEventCache.length <= 1 && (event instanceof MouseEvent || event instanceof PointerEvent)) {
            let hoverM = Utilities.normalModeCanvasPXToM({ x: event.offsetX, y: event.offsetY });

            if (!(hoverM && userDataController.myAvatar.myUserData.positionCurrent)) {
                return;
            }

            let wasHoveringOverUser = !!this.highlightedUserData;

            this.highlightedUserData = userDataController.allOtherUserData.find((userData) => {
                return userData.displayName && userData.positionCurrent && Utilities.getDistanceBetween2DPoints(userData.positionCurrent.x, userData.positionCurrent.z, hoverM.x, hoverM.z) < AVATAR.RADIUS_M;
            });

            if (!this.highlightedUserData && Utilities.getDistanceBetween2DPoints(userDataController.myAvatar.myUserData.positionCurrent.x, userDataController.myAvatar.myUserData.positionCurrent.z, hoverM.x, hoverM.z) < AVATAR.RADIUS_M) {
                this.highlightedUserData = userDataController.myAvatar.myUserData;
            }

            if (!wasHoveringOverUser && this.highlightedUserData) {
                accessibilityController.speak(`Hovering over ${this.highlightedUserData.displayName}.`);
            }

            if (!this.highlightedUserData) {
                for (let i = 0; i < roomController.rooms.length; i++) {
                    let room = roomController.rooms[i];

                    let wasHoveringOverSeat = !!this.highlightedSeat;

                    this.highlightedSeat = room.seats.find((seat) => {
                        return !seat.occupiedUserData && Utilities.getDistanceBetween2DPoints(seat.position.x, seat.position.z, hoverM.x, hoverM.z) < ROOM.SEAT_RADIUS_HOVER_M;
                    });

                    if (!wasHoveringOverSeat && this.highlightedSeat) {
                        accessibilityController.speak(`Hovering over vacant seat in ${room.name}.`);
                    }

                    if (this.highlightedSeat) {
                        break;
                    }
                }
            }

            if (!(this.highlightedUserData && this.highlightedSeat && this.highlightedRoom)) {
                let wasHoveringOverLandmark = !!this.highlightedLandmark;
                let found = false;

                for (let i = 0; i < landmarksController.landmarks.length; i++) {
                    let landmark = landmarksController.landmarks[i];

                    if (Utilities.getDistanceBetween2DPoints(landmark.positionM.x, landmark.positionM.z, hoverM.x, hoverM.z) < landmark.radiusM) {
                        this.highlightedLandmark = landmark;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    this.highlightedLandmark = undefined;
                }

                if (!wasHoveringOverLandmark && this.highlightedLandmark) {
                    accessibilityController.speak(`Hovering over ${this.highlightedLandmark.name}.`);
                }
            }
        } else if (this.pointerEventCache.length === 2) {
            userDataController.myAvatar.linearVelocityMPerS.forward = 0;
            userDataController.myAvatar.linearVelocityMPerS.right = 0;
    
            let lastDistanceBetweenTouchPointsPixels = Utilities.getDistanceBetween2DPoints(this.pointerEventCache[0].clientX, this.pointerEventCache[0].clientY, this.pointerEventCache[1].clientX, this.pointerEventCache[1].clientY);
    
            if (event instanceof PointerEvent && event.pointerId) {
                for (let i = 0; i < this.pointerEventCache.length; i++) {
                    if (this.pointerEventCache[i].pointerId === event.pointerId) {
                        this.pointerEventCache[i] = event;
                    }
                }
            } else if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent && event.changedTouches) {
                let touches = event.changedTouches;
                for (let i = 0; i < touches.length; i++) {
                    let currentEvent = this.getEventFromCacheByID(touches[i].identifier);
                    if (currentEvent) {
                        let dict: any = {};
                        Object.assign(dict, currentEvent);
                        dict.clientX = touches[i].clientX;
                        dict.clientY = touches[i].clientY;
                        let newEvent = new PointerEvent(currentEvent.type, dict);
                        this.removeEvent(currentEvent);
                        this.pushEvent(newEvent);
                    }
                }
            }
    
            let newDistance = Utilities.getDistanceBetween2DPoints(this.pointerEventCache[0].clientX, this.pointerEventCache[0].clientY, this.pointerEventCache[1].clientX, this.pointerEventCache[1].clientY);
    
            let deltaDistance = newDistance - lastDistanceBetweenTouchPointsPixels;
            let scaleFactor = 1 + deltaDistance * CONTROLS.PINCH_TO_ZOOM_FACTOR;
    
            let targetPXPerSU = physicsController.pxPerMCurrent * scaleFactor;
            targetPXPerSU = Utilities.clamp(targetPXPerSU, physicsController.pxPerMMin, physicsController.pxPerMMax);
            physicsController.pxPerMTarget = undefined;
            physicsController.pxPerMCurrent = targetPXPerSU;
        }

        if (this.highlightedUserData ||
            this.highlightedSeat ||
            this.highlightedRoom ||
            this.highlightedLandmark) {
            document.body.classList.add("cursorPointer");
        } else {
            document.body.classList.remove("cursorPointer");
        }
    }

    handleGestureOnCanvasEnd(event: PointerEvent | MouseEvent | TouchEvent) {
        event.preventDefault();

        if (event instanceof PointerEvent && event.pointerId) {
            this.removeEvent(event);
        } else if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent && event.changedTouches) {
            let touches = event.changedTouches;
            for (let i = touches.length - 1; i >= 0; i--) {
                let currentEvent = this.getEventFromCacheByID(touches[i].identifier);
                if (currentEvent) {
                    this.removeEvent(currentEvent);
                }
            }
        }

        if (this.pointerEventCache.length > 0) { 
            this.leftClickStartPositionPX = undefined;
        }
    
        if ((typeof TouchEvent !== "undefined" && event instanceof TouchEvent && event.touches && event.touches.length > 0) || this.pointerEventCache.length > 0) {
            return;
        }

        let target = <HTMLElement>event.target;

        // Remove Event Listeners
        if (window.PointerEvent) {
            if (event instanceof PointerEvent && event.pointerId) {
                target.releasePointerCapture(event.pointerId);
            }
        } else {
            // Remove Mouse Listeners
            this.normalModeCanvas.removeEventListener('mousemove', this.handleGestureOnCanvasMove, true);
            this.normalModeCanvas.removeEventListener('mouseup', this.handleGestureOnCanvasEnd, true);
        }

        if ((typeof TouchEvent !== "undefined" && event instanceof TouchEvent && event.touches.length === 0) || ((event instanceof PointerEvent || event instanceof MouseEvent) && event.buttons === 0)) {
            let gesturePointPX = Utilities.getGesturePointFromEvent(event);
            if (this.leftClickStartPositionPX && Utilities.getDistanceBetween2DPoints(this.leftClickStartPositionPX.x, this.leftClickStartPositionPX.y, gesturePointPX.x, gesturePointPX.y) <= CONTROLS.FUZZY_LEFT_CLICK_DISTANCE_PX) {
                this.leftClickStartPositionPX = undefined;
                this.handleGestureOnCanvasMove(event);
            }
        }

        if ((typeof TouchEvent !== "undefined" && event instanceof TouchEvent && event.touches.length === 0) || ((event instanceof PointerEvent || event instanceof MouseEvent) && event.buttons === 0) && this.leftClickStartPositionPX !== undefined) {
            this.leftClickStartPositionPX = undefined;
            this.lastDistanceBetweenLeftClickEvents = 0;
        }
    }

    handleGestureOnCanvasCancel(event: MouseEvent | PointerEvent) {
        this.handleGestureOnCanvasEnd(event);
    }

    onWheel(e: WheelEvent) {
        e.preventDefault();

        let deltaY;
        // This is a nasty hack that all major browsers subscribe to:
        // "Pinch" gestures on multi-touch trackpads are rendered as wheel events
        // with `e.ctrlKey` set to `true`.
        if (e.ctrlKey) {
            deltaY = e.deltaY * 10;
        } else {
            deltaY = (e as any).wheelDeltaY || (-e.deltaY * 10);
        }

        let scaleFactor = deltaY * CONTROLS.MOUSE_WHEEL_ZOOM_FACTOR;

        physicsController.smoothZoomDurationMS = PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS;
        physicsController.smoothZoomStartTimestamp = undefined;
        physicsController.pxPerMTarget = (physicsController.pxPerMTarget || physicsController.pxPerMCurrent) + scaleFactor;
    }
}

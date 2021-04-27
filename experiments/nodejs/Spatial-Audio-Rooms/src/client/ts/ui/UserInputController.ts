import { appConfigController, avDevicesController, connectionController, editorModeController, landmarksController, localSoundsController, pathsController, physicsController, roomController, signalsController, twoDimensionalRenderer, uiController, uiThemeController, userDataController, watchPartyController, webSocketConnectionController } from "..";
import { AVATAR, ROOM, CONTROLS, PHYSICS, PARTICLES } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";
import { SpatialAudioRoom, SpatialAudioRoomType, SpatialAudioSeat } from "../ui/RoomController";
import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { Landmark } from "./LandmarksController";

export class UserInputController {
    normalModeCanvas: HTMLCanvasElement;
    keyboardEventCache: Array<KeyboardEvent>;
    wasMutedBeforePTT: boolean = false;
    toggleInputMuteButton: HTMLButtonElement;
    toggleOutputMuteButton: HTMLButtonElement;
    toggleVideoButton: HTMLButtonElement;
    toggleSettingsButton: HTMLButtonElement;
    leftClickStartPositionPX: any;
    lastDistanceBetweenLeftClickEvents: number;
    hoveredUserData: UserData;
    hoveredSeat: SpatialAudioSeat;
    zoomedOutTooFarToRenderSeats: boolean = false;
    hoveredRoom: SpatialAudioRoom;
    hoveredLandmark: Landmark;

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

        this.keyboardEventCache = [];
        document.addEventListener('keydown', this.onDocumentKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onDocumentKeyUp.bind(this), false);
    }

    onDocumentKeyDown(event: KeyboardEvent) {
        let shouldAddKeyEvent = true;
        for (let i = 0; i < this.keyboardEventCache.length; i++) {
            if (this.keyboardEventCache[i].code === event.code) {
                shouldAddKeyEvent = false;
                break;
            }
        }
        if (shouldAddKeyEvent) {
            this.keyboardEventCache.unshift(event);
        }

        switch (this.keyboardEventCache[0].code) {
            case CONTROLS.M_KEY_CODE:
                this.toggleInputMute();
                break;
            case CONTROLS.SPACE_KEY_CODE:
                if (userDataController.myAvatar.myUserData.isMuted) {
                    this.wasMutedBeforePTT = true;
                    this.setInputMute(false);
                }
                break;
            case CONTROLS.MINUS_KEY_CODE:
            case CONTROLS.NUMPAD_SUBTRACT_KEY_CODE:
                if (userDataController.myAvatar.myUserData.currentRoom.roomType === SpatialAudioRoomType.Normal) {
                    physicsController.smoothZoomStartTimestamp = undefined;
                    physicsController.pxPerMTarget = (physicsController.pxPerMTarget || physicsController.pxPerMCurrent) - PHYSICS.PX_PER_M_STEP;
                }
                break;
            case CONTROLS.EQUAL_KEY_CODE:
            case CONTROLS.NUMPAD_ADD_KEY_CODE:
                if (userDataController.myAvatar.myUserData.currentRoom.roomType === SpatialAudioRoomType.Normal) {
                    physicsController.smoothZoomStartTimestamp = undefined;
                    physicsController.pxPerMTarget = (physicsController.pxPerMTarget || physicsController.pxPerMCurrent) + PHYSICS.PX_PER_M_STEP;
                }
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
                break;
            case CONTROLS.U_KEY_CODE:
                userDataController.myAvatarEars.toggleConnection();
                break;
            case CONTROLS.T_KEY_CODE:
                uiThemeController.cycleThemes();
                break;
            case CONTROLS.E_KEY_CODE:
                if (this.keyboardEventCache[0].ctrlKey) {
                    this.keyboardEventCache[0].preventDefault();
                    editorModeController.toggleEditorMode();
                }
                break;
        }
    }

    onDocumentKeyUp(event: KeyboardEvent) {
        for (let i = this.keyboardEventCache.length - 1; i >= 0; i--) {
            if (this.keyboardEventCache[i].code === event.code) {
                this.keyboardEventCache.splice(i, 1);
            }
        }

        switch (event.code) {
            case CONTROLS.SPACE_KEY_CODE:
                if (this.wasMutedBeforePTT) {
                    this.setInputMute(true);
                    this.wasMutedBeforePTT = false;
                }
                break;
        }

        if (this.keyboardEventCache.length > 0) {
            this.onDocumentKeyDown(this.keyboardEventCache[0]);
        }
    }

    hideSettingsMenu() {
        let settingsMenu = document.querySelector(".settingsMenu");
        if (settingsMenu) {
            settingsMenu.remove();
        }
    }

    toggleShowSettingsMenu() {
        roomController.hideRoomList();

        let settingsMenu = document.querySelector(".settingsMenu");
        if (settingsMenu) {
            this.hideSettingsMenu();
        } else {
            navigator.mediaDevices.enumerateDevices()
                .then((devices) => {
                    settingsMenu = document.createElement("div");
                    settingsMenu.classList.add("settingsMenu");

                    let closeButton = document.createElement("button");
                    closeButton.innerHTML = "X";
                    closeButton.classList.add("settingsMenu__closeButton");
                    closeButton.addEventListener("click", (e) => {
                        this.hideSettingsMenu();
                    });
                    settingsMenu.appendChild(closeButton);

                    let settingsMenu__header = document.createElement("h2");
                    settingsMenu__header.classList.add("settingsMenu__h1");
                    settingsMenu__header.innerHTML = "DEVICES";
                    settingsMenu.appendChild(settingsMenu__header);

                    let changeAudioInputDeviceMenu__header = document.createElement("h2");
                    changeAudioInputDeviceMenu__header.classList.add("settingsMenu__h2");
                    changeAudioInputDeviceMenu__header.innerHTML = `AUDIO INPUT DEVICE`;

                    let changeAudioInputDeviceMenu__select = document.createElement("select");
                    changeAudioInputDeviceMenu__select.classList.add("settingsMenu__select");

                    let numAudioInputDevices = 0;

                    let changeAudioOutputDeviceMenu__header = document.createElement("h2");
                    changeAudioOutputDeviceMenu__header.classList.add("settingsMenu__h2");
                    changeAudioOutputDeviceMenu__header.innerHTML = `AUDIO OUTPUT DEVICE`;

                    let changeAudioOutputDeviceMenu__select = document.createElement("select");
                    changeAudioOutputDeviceMenu__select.classList.add("settingsMenu__select");

                    let numAudioOutputDevices = 0;

                    let changeVideoDeviceMenu__header = document.createElement("h2");
                    changeVideoDeviceMenu__header.classList.add("settingsMenu__h2");
                    changeVideoDeviceMenu__header.innerHTML = `VIDEO DEVICE`;

                    let changeVideoDeviceMenu__select = document.createElement("select");
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

                    settingsMenu.appendChild(changeAudioInputDeviceMenu__header);
                    settingsMenu.appendChild(changeAudioInputDeviceMenu__select);
                    
                    settingsMenu.appendChild(changeAudioOutputDeviceMenu__header);
                    settingsMenu.appendChild(changeAudioOutputDeviceMenu__select);
                    
                    settingsMenu.appendChild(changeVideoDeviceMenu__header);
                    settingsMenu.appendChild(changeVideoDeviceMenu__select);

                    document.body.appendChild(settingsMenu);
                    uiThemeController.refreshThemedElements();
                })
                .catch((err) => {
                    console.error(`Error during \`enumerateDevices()\`: ${err}`);
                });
        }
    }

    async toggleInputMute() {
        await this.setInputMute(!userDataController.myAvatar.myUserData.isMuted);
    }

    async setInputMute(newMuteStatus: boolean) {
        let hifiCommunicator = connectionController.hifiCommunicator;

        if (!hifiCommunicator) {
            return;
        }

        if (userDataController.myAvatar.myUserData.isMuted === newMuteStatus) {
            return;
        }

        if (await hifiCommunicator.setInputAudioMuted(newMuteStatus)) {
            userDataController.myAvatar.myUserData.isMuted = newMuteStatus;

            if (userDataController.myAvatar.myUserData.isMuted) {
                this.toggleInputMuteButton.classList.add("toggleInputMuteButton--muted");
                this.toggleInputMuteButton.classList.remove("toggleInputMuteButton--unmuted");
                uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleInputMuteButton, 'toggleInputMuteButton--unmuted', false);
            } else {
                this.toggleInputMuteButton.classList.remove("toggleInputMuteButton--muted");
                uiThemeController.clearThemesFromElement(<HTMLElement>this.toggleInputMuteButton, 'toggleInputMuteButton--muted', false);
                this.toggleInputMuteButton.classList.add("toggleInputMuteButton--unmuted");
            }
            uiThemeController.refreshThemedElements();
        }
    }

    toggleOutputMute() {
        this.setOutputMute(!avDevicesController.outputAudioElement.muted);
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
        avDevicesController.audioConstraints.echoCancellation = newEchoCancellationStatus;
        connectionController.setNewInputAudioMediaStream();
    }

    setAGCStatus(newAGCStatus: boolean) {
        avDevicesController.audioConstraints.autoGainControl = newAGCStatus;
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
            let clickM = new Point3D(Utilities.normalModeCanvasPXToM({x: event.offsetX, y: event.offsetY}));

            let isCloseEnough = false;
            if (userDataController.myAvatar.myUserData && userDataController.myAvatar.myUserData.positionCurrent) {
                isCloseEnough = Utilities.getDistanceBetween2DPoints(userDataController.myAvatar.myUserData.positionCurrent.x, userDataController.myAvatar.myUserData.positionCurrent.z, clickM.x, clickM.z) < PARTICLES.CLOSE_ENOUGH_ADD_M;
            }

            if (isCloseEnough) {
                signalsController.addActiveSignal(clickM);
            }
        } else if (this.hoveredUserData) {
            uiController.showAvatarContextMenu(this.hoveredUserData);
            this.hoveredUserData = undefined;
        } else if (this.hoveredSeat && !this.hoveredSeat.occupiedUserData && !pathsController.currentPath) {
            console.log(`User clicked on a new seat at ${JSON.stringify(this.hoveredSeat.position)}! Target seat yaw orientation: ${JSON.stringify(this.hoveredSeat.orientation)} degrees.`);
            userDataController.myAvatar.moveToNewSeat(this.hoveredSeat);
            this.hoveredSeat = undefined;
        } else if (this.hoveredRoom && !pathsController.currentPath && this.hoveredRoom !== userDataController.myAvatar.myUserData.currentRoom) {
            console.log(`User clicked on the room named ${this.hoveredRoom.name}!`);
            userDataController.myAvatar.positionSelfInRoom(this.hoveredRoom.name);
            this.hoveredRoom = undefined;
        } else if (this.hoveredLandmark) {
            landmarksController.landmarkClicked(this.hoveredLandmark);
        }

        document.body.classList.remove("cursorPointer");
    }

    handleGestureOnCanvasStart(event: TouchEvent | MouseEvent | PointerEvent) {
        event.preventDefault();

        roomController.hideRoomList();
        uiController.hideAvatarContextMenu();
        this.hideSettingsMenu();

        let target = <HTMLElement>event.target;

        target.focus();

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

    handleGestureOnCanvasMove(event: MouseEvent | PointerEvent) {
        event.preventDefault();

        let gesturePointPX = Utilities.getGesturePointFromEvent(event);

        if (event.buttons === 1 && this.leftClickStartPositionPX !== undefined && !pathsController.currentPath && !(userDataController.myAvatarEars.isConnecting || userDataController.myAvatarEars.isConnected)) {
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
        } else {
            let hoverM = Utilities.normalModeCanvasPXToM({ x: event.offsetX, y: event.offsetY });

            if (!(hoverM && userDataController.myAvatar.myUserData.positionCurrent)) {
                return;
            }

            this.hoveredUserData = userDataController.allOtherUserData.find((userData) => {
                return userData.positionCurrent && Utilities.getDistanceBetween2DPoints(userData.positionCurrent.x, userData.positionCurrent.z, hoverM.x, hoverM.z) < AVATAR.RADIUS_M;
            });

            if (!this.hoveredUserData && Utilities.getDistanceBetween2DPoints(userDataController.myAvatar.myUserData.positionCurrent.x, userDataController.myAvatar.myUserData.positionCurrent.z, hoverM.x, hoverM.z) < AVATAR.RADIUS_M) {
                this.hoveredUserData = userDataController.myAvatar.myUserData;
            }

            if (!this.hoveredUserData) {
                if (this.zoomedOutTooFarToRenderSeats) {
                    this.hoveredSeat = undefined;
                } else {
                    for (let i = 0; i < roomController.rooms.length; i++) {
                        let room = roomController.rooms[i];
                        this.hoveredSeat = room.seats.find((seat) => {
                            return !seat.occupiedUserData && Utilities.getDistanceBetween2DPoints(seat.position.x, seat.position.z, hoverM.x, hoverM.z) < ROOM.SEAT_RADIUS_M;
                        });
    
                        if (this.hoveredSeat) {
                            break;
                        }
                    }
                }
            }

            if (!(this.hoveredUserData && this.hoveredSeat)) {
                this.hoveredRoom = undefined;

                    for (let i = 0; i < roomController.rooms.length; i++) {
                        let room = roomController.rooms[i];
    
                        if (Utilities.getDistanceBetween2DPoints(room.seatingCenter.x, room.seatingCenter.z, hoverM.x, hoverM.z) < room.seatingRadiusM) {
                            if (this.zoomedOutTooFarToRenderSeats) {
                                this.hoveredRoom = room;
                                break;
                            }
                        }
                }
            }

            if (!(this.hoveredUserData && this.hoveredSeat && this.hoveredRoom)) {
                this.hoveredLandmark = undefined;

                    for (let i = 0; i < landmarksController.landmarks.length; i++) {
                        let landmark = landmarksController.landmarks[i];
    
                        if (Utilities.getDistanceBetween2DPoints(landmark.positionM.x, landmark.positionM.z, hoverM.x, hoverM.z) < landmark.radiusM) {
                            this.hoveredLandmark = landmark;
                            break;
                        }
                }
            }
        }

        if (this.hoveredUserData ||
            this.hoveredSeat ||
            this.hoveredRoom ||
            this.hoveredLandmark) {
            document.body.classList.add("cursorPointer");
        } else {
            document.body.classList.remove("cursorPointer");
        }
    }

    handleGestureOnCanvasEnd(event: MouseEvent | PointerEvent) {
        event.preventDefault();

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

        if (event.buttons === 0 && this.leftClickStartPositionPX !== undefined) {
            this.leftClickStartPositionPX = undefined;
            this.lastDistanceBetweenLeftClickEvents = 0;
        }
    }

    handleGestureOnCanvasCancel(event: MouseEvent | PointerEvent) {
        this.handleGestureOnCanvasEnd(event);
    }

    onWheel(e: WheelEvent) {
        e.preventDefault();

        if (userDataController.myAvatar.myUserData.currentRoom.roomType === SpatialAudioRoomType.WatchParty) {
            return;
        }

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

import { avDevicesController, connectionController, pathsController, physicsController, roomController, signalsController, twoDimensionalRenderer, uiController, userDataController } from "..";
import { AVATAR, ROOM, CONTROLS, PHYSICS, PARTICLES } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";
import { SpatialAudioSeat } from "../ui/RoomController";
import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import * as e from "express";

export class UserInputController {
    mainCanvas: HTMLCanvasElement;
    keyboardEventCache: Array<KeyboardEvent>;
    wasMutedBeforePTT: boolean = false;
    changeAudioInputDeviceButton: HTMLButtonElement;
    toggleInputMuteButton: HTMLButtonElement;
    changeAudioOutputDeviceButton: HTMLButtonElement;
    toggleOutputMuteButton: HTMLButtonElement;
    changeVideoDeviceButton: HTMLButtonElement;
    toggleVideoButton: HTMLButtonElement;
    leftClickStartPositionPX: any;
    lastDistanceBetweenLeftClickEvents: number;
    hoveredUserData: UserData;
    hoveredSeat: SpatialAudioSeat;

    constructor() {
        this.keyboardEventCache = [];
        document.addEventListener('keydown', this.onUserKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onUserKeyUp.bind(this), false);

        this.changeAudioInputDeviceButton = document.querySelector('.changeAudioInputDeviceButton');
        this.changeAudioInputDeviceButton.addEventListener("click", (e) => {
            this.toggleShowChangeAudioInputDeviceMenu();
        });
        this.toggleInputMuteButton = document.querySelector('.toggleInputMuteButton');
        this.toggleInputMuteButton.addEventListener("click", (e) => {
            this.toggleInputMute();
        });

        this.changeAudioOutputDeviceButton = document.querySelector('.changeAudioOutputDeviceButton');
        if (this.changeAudioOutputDeviceButton) {
            this.changeAudioOutputDeviceButton.addEventListener("click", (e) => {
                this.toggleShowChangeAudioOutputDeviceMenu();
            });
        }
        this.toggleOutputMuteButton = document.querySelector('.toggleOutputMuteButton');
        this.toggleOutputMuteButton.addEventListener("click", (e) => {
            this.toggleOutputMute();
        });

        this.changeVideoDeviceButton = document.querySelector('.changeVideoDeviceButton');
        this.changeVideoDeviceButton.addEventListener("click", (e) => {
            this.toggleShowChangeVideoDeviceMenu();
        });
        this.toggleVideoButton = document.querySelector('.toggleVideoButton');

        this.mainCanvas = document.querySelector('.mainCanvas');
        this.mainCanvas.addEventListener("click", this.handleCanvasClick.bind(this));
        if (window.PointerEvent) {
            this.mainCanvas.addEventListener('pointerdown', this.handleGestureOnCanvasStart.bind(this), true);
            this.mainCanvas.addEventListener('pointermove', this.handleGestureOnCanvasMove.bind(this), true);
            this.mainCanvas.addEventListener('pointerup', this.handleGestureOnCanvasEnd.bind(this), true);
            this.mainCanvas.addEventListener("pointerout", this.handleGestureOnCanvasCancel.bind(this), true);
        } else {
            this.mainCanvas.addEventListener('touchstart', this.handleGestureOnCanvasStart.bind(this), true);
            this.mainCanvas.addEventListener('touchmove', this.handleGestureOnCanvasMove.bind(this), true);
            this.mainCanvas.addEventListener('touchend', this.handleGestureOnCanvasEnd.bind(this), true);
            this.mainCanvas.addEventListener("touchcancel", this.handleGestureOnCanvasCancel.bind(this), true);

            this.mainCanvas.addEventListener("mousedown", this.handleGestureOnCanvasStart.bind(this), true);
        }
        this.mainCanvas.addEventListener("gesturestart", (e) => { e.preventDefault(); }, false);
        this.mainCanvas.addEventListener("gesturechange", (e) => { e.preventDefault(); }, false);
        this.mainCanvas.addEventListener("gestureend", (e) => { e.preventDefault(); }, false);
        this.mainCanvas.addEventListener("contextmenu", (e) => { e.preventDefault(); }, false);

        this.mainCanvas.addEventListener("wheel", this.onWheel.bind(this), false);
    }

    onUserKeyDown(event: KeyboardEvent) {
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
                break;
        }
    }

    onUserKeyUp(event: KeyboardEvent) {
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
            this.onUserKeyDown(this.keyboardEventCache[0]);
        }
    }

    hideChangeAudioInputDeviceMenu() {
        let changeAudioInputDeviceMenu = document.querySelector(".changeAudioInputDeviceMenu");
        if (changeAudioInputDeviceMenu) {
            changeAudioInputDeviceMenu.remove();
        }
    }

    toggleShowChangeAudioInputDeviceMenu() {
        let changeAudioInputDeviceMenu = document.querySelector(".changeAudioInputDeviceMenu");
        if (changeAudioInputDeviceMenu) {
            this.hideChangeAudioInputDeviceMenu();
        } else {
            this.hideChangeVideoDeviceMenu();
            this.hideChangeAudioInputDeviceMenu();
            this.hideChangeAudioOutputDeviceMenu();
            navigator.mediaDevices.enumerateDevices()
                .then((devices) => {
                    changeAudioInputDeviceMenu = document.createElement("div");
                    changeAudioInputDeviceMenu.classList.add("changeDeviceMenu", "changeAudioInputDeviceMenu");

                    let changeAudioInputDeviceMenu__header = document.createElement("h2");
                    changeAudioInputDeviceMenu__header.classList.add("changeDeviceMenu__header", "changeAudioInputDeviceMenu__header");
                    changeAudioInputDeviceMenu__header.innerHTML = `Audio Input Device`;
                    changeAudioInputDeviceMenu.appendChild(changeAudioInputDeviceMenu__header);

                    let changeAudioInputDeviceMenu__select = document.createElement("select");
                    changeAudioInputDeviceMenu__select.classList.add("changeDeviceMenu__select", "changeAudioInputDeviceMenu__select");

                    let numAudioInputDevices = 0;

                    for (let i = 0; i < devices.length; i++) {
                        if (devices[i].kind === "audioinput") {
                            let deviceLabel = devices[i].label;

                            if (!deviceLabel || deviceLabel.length === 0) {
                                deviceLabel = "Unknown Device";
                            }

                            let changeAudioInputDeviceMenu__option = document.createElement("option");
                            changeAudioInputDeviceMenu__option.classList.add("changeDeviceMenu__option", "changeAudioInputDeviceMenu__option");
                            changeAudioInputDeviceMenu__option.innerHTML = deviceLabel;
                            changeAudioInputDeviceMenu__option.value = devices[i].deviceId;

                            changeAudioInputDeviceMenu__select.appendChild(changeAudioInputDeviceMenu__option);

                            if (avDevicesController.currentAudioInputDeviceID && avDevicesController.currentAudioInputDeviceID === devices[i].deviceId) {
                                changeAudioInputDeviceMenu__select.selectedIndex = numAudioInputDevices;
                            }
                            numAudioInputDevices++;
                        }
                    };

                    changeAudioInputDeviceMenu__select.addEventListener("change", (e) => {
                        avDevicesController.changeAudioInputDevice((<HTMLSelectElement>e.target).value);
                    });

                    changeAudioInputDeviceMenu.appendChild(changeAudioInputDeviceMenu__select);
                    document.body.appendChild(changeAudioInputDeviceMenu);
                })
                .catch((err) => {
                    console.error(`Error during \`enumerateDevices()\`: ${err}`);
                });
        }
    }

    hideChangeAudioOutputDeviceMenu() {
        let changeAudioOutputDeviceMenu = document.querySelector(".changeAudioOutputDeviceMenu");
        if (changeAudioOutputDeviceMenu) {
            changeAudioOutputDeviceMenu.remove();
        }
    }

    toggleShowChangeAudioOutputDeviceMenu() {
        let changeAudioOutputDeviceMenu = document.querySelector(".changeAudioOutputDeviceMenu");
        if (changeAudioOutputDeviceMenu) {
            this.hideChangeAudioOutputDeviceMenu();
        } else {
            this.hideChangeVideoDeviceMenu();
            this.hideChangeAudioInputDeviceMenu();
            this.hideChangeAudioOutputDeviceMenu();
            navigator.mediaDevices.enumerateDevices()
                .then((devices) => {
                    changeAudioOutputDeviceMenu = document.createElement("div");
                    changeAudioOutputDeviceMenu.classList.add("changeDeviceMenu", "changeAudioOutputDeviceMenu");

                    let changeAudioOutputDeviceMenu__header = document.createElement("h2");
                    changeAudioOutputDeviceMenu__header.classList.add("changeDeviceMenu__header", "changeAudioOutputDeviceMenu__header");
                    changeAudioOutputDeviceMenu__header.innerHTML = `Audio Output Device`;
                    changeAudioOutputDeviceMenu.appendChild(changeAudioOutputDeviceMenu__header);

                    let changeAudioOutputDeviceMenu__select = document.createElement("select");
                    changeAudioOutputDeviceMenu__select.classList.add("changeDeviceMenu__select", "changeAudioOutputDeviceMenu__select");

                    let numAudioOutputDevices = 0;

                    for (let i = 0; i < devices.length; i++) {
                        if (devices[i].kind === "audiooutput") {
                            let deviceLabel = devices[i].label;

                            if (!deviceLabel || deviceLabel.length === 0) {
                                deviceLabel = "Unknown Device";
                            }

                            let changeAudioOutputDeviceMenu__option = document.createElement("option");
                            changeAudioOutputDeviceMenu__option.classList.add("changeDeviceMenu__option", "changeAudioOutputDeviceMenu__option");
                            changeAudioOutputDeviceMenu__option.innerHTML = deviceLabel;
                            changeAudioOutputDeviceMenu__option.value = devices[i].deviceId;

                            changeAudioOutputDeviceMenu__select.appendChild(changeAudioOutputDeviceMenu__option);

                            if (avDevicesController.currentAudioOutputDeviceID && avDevicesController.currentAudioOutputDeviceID === devices[i].deviceId) {
                                changeAudioOutputDeviceMenu__select.selectedIndex = numAudioOutputDevices;
                            }
                            numAudioOutputDevices++;
                        }
                    };

                    changeAudioOutputDeviceMenu__select.addEventListener("change", (e) => {
                        avDevicesController.changeAudioOutputDevice((<HTMLSelectElement>e.target).value);
                    });

                    changeAudioOutputDeviceMenu.appendChild(changeAudioOutputDeviceMenu__select);
                    document.body.appendChild(changeAudioOutputDeviceMenu);
                })
                .catch((err) => {
                    console.error(`Error during \`enumerateDevices()\`: ${err}`);
                });
        }
    }

    hideChangeVideoDeviceMenu() {
        let changeVideoDeviceMenu = document.querySelector(".changeVideoDeviceMenu");
        if (changeVideoDeviceMenu) {
            changeVideoDeviceMenu.remove();
        }
    }

    toggleShowChangeVideoDeviceMenu() {
        let changeVideoDeviceMenu = document.querySelector(".changeVideoDeviceMenu");
        if (changeVideoDeviceMenu) {
            this.hideChangeVideoDeviceMenu();
        } else {
            this.hideChangeVideoDeviceMenu();
            this.hideChangeAudioInputDeviceMenu();
            this.hideChangeAudioOutputDeviceMenu();
            navigator.mediaDevices.enumerateDevices()
                .then((devices) => {
                    changeVideoDeviceMenu = document.createElement("div");
                    changeVideoDeviceMenu.classList.add("changeDeviceMenu", "changeVideoDeviceMenu");

                    let changeVideoDeviceMenu__header = document.createElement("h2");
                    changeVideoDeviceMenu__header.classList.add("changeDeviceMenu__header", "changeVideoDeviceMenu__header");
                    changeVideoDeviceMenu__header.innerHTML = `Video Device`;
                    changeVideoDeviceMenu.appendChild(changeVideoDeviceMenu__header);

                    let changeVideoDeviceMenu__select = document.createElement("select");
                    changeVideoDeviceMenu__select.classList.add("changeDeviceMenu__select", "changeVideoDeviceMenu__select");

                    let numVideoDevices = 0;

                    for (let i = 0; i < devices.length; i++) {
                        if (devices[i].kind === "videoinput") {
                            let deviceLabel = devices[i].label;

                            if (!deviceLabel || deviceLabel.length === 0) {
                                deviceLabel = "Unknown Device";
                            }

                            let changeVideoDeviceMenu__option = document.createElement("option");
                            changeVideoDeviceMenu__option.classList.add("changeDeviceMenu__option", "changeVideoDeviceMenu__option");
                            changeVideoDeviceMenu__option.innerHTML = deviceLabel;
                            changeVideoDeviceMenu__option.value = devices[i].deviceId;

                            changeVideoDeviceMenu__select.appendChild(changeVideoDeviceMenu__option);

                            if (avDevicesController.currentVideoDeviceID && avDevicesController.currentVideoDeviceID === devices[i].deviceId) {
                                changeVideoDeviceMenu__select.selectedIndex = numVideoDevices;
                            }
                            numVideoDevices++;
                        }
                    };

                    changeVideoDeviceMenu__select.addEventListener("change", (e) => {
                        avDevicesController.changeVideoDevice((<HTMLSelectElement>e.target).value);
                    });

                    changeVideoDeviceMenu.appendChild(changeVideoDeviceMenu__select);
                    document.body.appendChild(changeVideoDeviceMenu);
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
            } else {
                this.toggleInputMuteButton.classList.remove("toggleInputMuteButton--muted");
            }
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
            this.toggleOutputMuteButton.classList.add("toggleOutputMuteButton--muted");
        } else {
            this.toggleOutputMuteButton.classList.remove("toggleOutputMuteButton--muted");
            // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
            avDevicesController.outputAudioElement.play();
        }
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
        connectionController.webSocketConnectionController.updateMyUserDataOnWebSocketServer();
    }

    setVolumeThreshold(newVolumeThreshold: number) {
        userDataController.myAvatar.myUserData.volumeThreshold = newVolumeThreshold;
        console.log(`User changed their Mic Volume Threshold to ${newVolumeThreshold}`);
        connectionController.hifiCommunicator.updateUserDataAndTransmit({
            volumeThreshold: newVolumeThreshold,
        });
        uiController.maybeUpdateAvatarContextMenu(userDataController.myAvatar.myUserData);
        connectionController.webSocketConnectionController.updateMyUserDataOnWebSocketServer();
    }

    getGesturePointFromEvent(evt: MouseEvent | TouchEvent) {
        let point = {
            x: 0,
            y: 0
        };

        if (typeof (TouchEvent) !== "undefined" && evt instanceof TouchEvent) {
            // Prefer Touch Events
            point.x = evt.targetTouches[0].clientX;
            point.y = evt.targetTouches[0].clientY;
        } else {
            // Either Mouse event or Pointer Event
            point.x = (<MouseEvent>evt).clientX;
            point.y = (<MouseEvent>evt).clientY;
        }

        return point;
    }

    handleCanvasClick(event: TouchEvent | MouseEvent | PointerEvent) {
        if (signalsController.activeSignal && (event instanceof MouseEvent || event instanceof PointerEvent)) {
            let clickM = new Point3D(Utilities.canvasPXToM({x: event.offsetX, y: event.offsetY}));

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
        }

        document.body.classList.remove("cursorPointer");
    }

    handleGestureOnCanvasStart(event: TouchEvent | MouseEvent | PointerEvent) {
        event.preventDefault();

        roomController.hideRoomList();
        uiController.hideAvatarContextMenu();
        this.hideChangeAudioInputDeviceMenu();

        let target = <HTMLElement>event.target;

        target.focus();

        if (window.PointerEvent && event instanceof PointerEvent) {
            target.setPointerCapture(event.pointerId);
        } else {
            this.mainCanvas.addEventListener('mousemove', this.handleGestureOnCanvasMove.bind(this), true);
            this.mainCanvas.addEventListener('mouseup', this.handleGestureOnCanvasEnd.bind(this), true);
        }

        let gesturePointPX = this.getGesturePointFromEvent(event);

        if ((event instanceof PointerEvent || event instanceof MouseEvent) && event.buttons === 1) {
            this.leftClickStartPositionPX = gesturePointPX;
        }
    }

    handleGestureOnCanvasMove(event: MouseEvent | PointerEvent) {
        event.preventDefault();

        let gesturePointPX = this.getGesturePointFromEvent(event);

        if (event.buttons === 1 && this.leftClickStartPositionPX !== undefined && !pathsController.currentPath) {
            let newDistance = gesturePointPX.x - this.leftClickStartPositionPX.x;
            let deltaDistance = newDistance - this.lastDistanceBetweenLeftClickEvents;
            this.lastDistanceBetweenLeftClickEvents = newDistance;

            if (userDataController.myAvatar && userDataController.myAvatar.myUserData.orientationEulerCurrent) {
                let newYawDegrees = userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees - deltaDistance * CONTROLS.RIGHT_CLICK_ROTATION_SENSITIVITY;
                if (!isNaN(newYawDegrees)) {
                    userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees = newYawDegrees;
                    let hifiCommunicator = connectionController.hifiCommunicator;
                    if (hifiCommunicator) {
                        hifiCommunicator.updateUserDataAndTransmit({ orientationEuler: new OrientationEuler3D({ yawDegrees: newYawDegrees }) });
                    }
                }
            }
        } else {
            let hoverM = Utilities.canvasPXToM({ x: event.offsetX, y: event.offsetY });

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

        if (this.hoveredUserData || this.hoveredSeat) {
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
            this.mainCanvas.removeEventListener('mousemove', this.handleGestureOnCanvasMove, true);
            this.mainCanvas.removeEventListener('mouseup', this.handleGestureOnCanvasEnd, true);
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

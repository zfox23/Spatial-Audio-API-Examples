import { connectionController, pathsController, physicsController, roomController, uiController, userDataController } from "..";
import { AVATAR, ROOM, CONTROLS, PHYSICS } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";
import { Seat } from "../ui/RoomController";
import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";

export class UserInputController {
    mainCanvas: HTMLCanvasElement;
    keyboardEventCache: Array<KeyboardEvent>;
    wasMutedBeforePTT: boolean = false;
    toggleInputMuteButton: HTMLButtonElement;
    toggleOutputMuteButton: HTMLButtonElement;
    toggleVideoButton: HTMLButtonElement;
    rightClickStartPositionPX: any;
    lastDistanceBetweenRightClickEvents: number;
    hoveredUserData: UserData;
    hoveredSeat: Seat;
    lastOnWheelTimestamp: number;

    constructor() {
        this.keyboardEventCache = [];
        document.addEventListener('keydown', this.onUserKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onUserKeyUp.bind(this), false);

        this.toggleInputMuteButton = document.querySelector('.toggleInputMuteButton');
        this.toggleInputMuteButton.addEventListener("click", (e) => {
            this.toggleInputMute();
        });

        this.toggleOutputMuteButton = document.querySelector('.toggleOutputMuteButton');
        this.toggleOutputMuteButton.addEventListener("click", (e) => {
            this.toggleOutputMute();
        });

        this.toggleVideoButton = document.querySelector('.toggleVideoButton');

        this.mainCanvas = document.querySelector('.mainCanvas');
        this.mainCanvas.addEventListener("click", this.onUserClick.bind(this));
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
        this.setOutputMute(!connectionController.avDevicesController.outputAudioElement.muted);
    }
    
    setOutputMute(newMuteStatus: boolean) {        
        connectionController.avDevicesController.outputAudioElement.muted = !!newMuteStatus;
        console.log(`Set output mute status to \`${connectionController.avDevicesController.outputAudioElement.muted}\``);
    
        if (connectionController.avDevicesController.outputAudioElement.muted) {
            this.toggleOutputMuteButton.classList.add("toggleOutputMuteButton--muted");
        } else {
            this.toggleOutputMuteButton.classList.remove("toggleOutputMuteButton--muted");
            // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
            connectionController.avDevicesController.outputAudioElement.play();
        }
    }

    setEchoCancellationStatus(newEchoCancellationStatus: boolean) {
        connectionController.audioConstraints.echoCancellation = newEchoCancellationStatus;
        connectionController.setNewInputAudioMediaStream();
    }

    setAGCStatus(newAGCStatus: boolean) {
        connectionController.audioConstraints.autoGainControl = newAGCStatus;
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

    onUserClick(event: TouchEvent | MouseEvent | PointerEvent) {
        if (this.hoveredUserData) {
            uiController.showAvatarContextMenu(this.hoveredUserData);
            this.hoveredUserData = undefined;
        } else if (this.hoveredSeat && !pathsController.currentPath) {
            console.log(`User clicked on a new seat at ${JSON.stringify(this.hoveredSeat.position)}! Target seat yaw orientation: ${JSON.stringify(this.hoveredSeat.orientation)} degrees.`);
            userDataController.myAvatar.moveToNewSeat(this.hoveredSeat.position, this.hoveredSeat.orientation.yawDegrees);
            this.hoveredSeat = undefined;
        }

        document.body.classList.remove("cursorPointer");
    }

    handleGestureOnCanvasStart(event: TouchEvent | MouseEvent | PointerEvent) {
        event.preventDefault();
        
        roomController.hideRoomList();
        uiController.hideAvatarContextMenu();

        let target = <HTMLElement>event.target;

        target.focus();
    
        if (window.PointerEvent && event instanceof PointerEvent) {
            target.setPointerCapture(event.pointerId);
        } else {
            this.mainCanvas.addEventListener('mousemove', this.handleGestureOnCanvasMove.bind(this), true);
            this.mainCanvas.addEventListener('mouseup', this.handleGestureOnCanvasEnd.bind(this), true);
        }
    
        let gesturePointPX = this.getGesturePointFromEvent(event);
    
        if ((event instanceof PointerEvent || event instanceof MouseEvent) && event.button === 2) {
            this.rightClickStartPositionPX = gesturePointPX;
        }
    }

    handleGestureOnCanvasMove(event: MouseEvent | PointerEvent) {
        event.preventDefault();
    
        let gesturePointPX = this.getGesturePointFromEvent(event);
        
        if (event.buttons === 2 && this.rightClickStartPositionPX !== undefined && !pathsController.currentPath) {
            let newDistance = gesturePointPX.x - this.rightClickStartPositionPX.x;
            let deltaDistance = newDistance - this.lastDistanceBetweenRightClickEvents;
            this.lastDistanceBetweenRightClickEvents = newDistance;
    
            if (userDataController.myAvatar && userDataController.myAvatar.myUserData.orientationEulerCurrent) {
                let newYawDegrees = userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees - deltaDistance * CONTROLS.RIGHT_CLICK_ROTATION_SENSITIVITY;
                if (!isNaN(newYawDegrees)) {
                    userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees = newYawDegrees;
                    let hifiCommunicator = connectionController.hifiCommunicator;
                    if (hifiCommunicator) {
                        hifiCommunicator.updateUserDataAndTransmit({orientationEuler: new OrientationEuler3D({yawDegrees: newYawDegrees})});
                    }
                }
            }
        } else {
            let hoverM = Utilities.canvasPXToM({x: event.offsetX, y: event.offsetY});

            let room = roomController.getRoomFromName(userDataController.myAvatar.myUserData.currentRoomName);

            if (!(hoverM && room && userDataController.myAvatar.myUserData.positionCurrent)) {
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
                        return Utilities.getDistanceBetween2DPoints(seat.position.x, seat.position.z, hoverM.x, hoverM.z) < ROOM.SEAT_RADIUS_M;
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
        
        if (event.button === 2 && this.rightClickStartPositionPX !== undefined) {
            this.rightClickStartPositionPX = undefined;
            this.lastDistanceBetweenRightClickEvents = 0;
        }
    }

    handleGestureOnCanvasCancel(event: MouseEvent | PointerEvent) {
        this.handleGestureOnCanvasEnd(event);
    }
    
    onWheel(e: WheelEvent) {
        e.preventDefault();
    
        if (this.lastOnWheelTimestamp) {
            physicsController.onWheelTimestampDeltaMS = Date.now() - this.lastOnWheelTimestamp;
        }
    
        let deltaY;
        // This is a nasty hack that all major browsers subscribe to:
        // "Pinch" gestures on multi-touch trackpads are rendered as wheel events
        // with `e.ctrlKey` set to `true`.
        if (e.ctrlKey) {
            deltaY = e.deltaY * 10;
        } else {
            // tslint:disable-next-line
            deltaY = (e as any).wheelDeltaY || (-e.deltaY * 10);
        }
    
        let scaleFactor = 1 + deltaY * CONTROLS.MOUSE_WHEEL_ZOOM_FACTOR;

        physicsController.smoothZoomDurationMS = PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS;
        physicsController.smoothZoomStartTimestamp = undefined;
        physicsController.pxPerMTarget = physicsController.pxPerMCurrent * scaleFactor;
    
        this.lastOnWheelTimestamp = Date.now();
    }
}

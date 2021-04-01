import { connectionController, roomController, uiController, userDataController } from "..";
import { AVATAR_RADIUS_M, SEAT_RADIUS_M } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";
import { Seat } from "../ui/RoomController";

const M_KEY_CODE = "KeyM";
const SPACE_KEY_CODE = "Space";
const RIGHT_CLICK_ROTATION_SENSITIVITY = 0.5;

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
            case M_KEY_CODE:
                this.toggleInputMute();
                break;
            case SPACE_KEY_CODE:
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
            case SPACE_KEY_CODE:
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

    getGesturePointFromEvent(evt: MouseEvent | TouchEvent) {
        let point = {
            x: 0,
            y: 0
        };
    
        if (evt instanceof TouchEvent) {
            // Prefer Touch Events
            point.x = evt.targetTouches[0].clientX;
            point.y = evt.targetTouches[0].clientY;
        } else {
            // Either Mouse event or Pointer Event
            point.x = evt.clientX;
            point.y = evt.clientY;
        }
    
        return point;
    }

    onUserClick(event: TouchEvent | MouseEvent | PointerEvent) {
        if (this.hoveredUserData) {

            this.hoveredUserData = undefined;
        } else if (this.hoveredSeat) {
            console.log(`User clicked on a new seat at ${JSON.stringify(this.hoveredSeat.position)}! New yaw orientation: ${JSON.stringify(this.hoveredSeat.orientation)} degrees.`);
            userDataController.myAvatar.updateMyPositionAndOrientation(this.hoveredSeat.position, this.hoveredSeat.orientation.yawDegrees);

            this.hoveredSeat = undefined;
        }
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
        
        if (event.buttons === 2 && this.rightClickStartPositionPX !== undefined) {
            let newDistance = gesturePointPX.x - this.rightClickStartPositionPX.x;
            let deltaDistance = newDistance - this.lastDistanceBetweenRightClickEvents;
            this.lastDistanceBetweenRightClickEvents = newDistance;
    
            if (userDataController.myAvatar && userDataController.myAvatar.myUserData.orientationEuler) {
                let newYawDegrees = userDataController.myAvatar.myUserData.orientationEuler.yawDegrees - deltaDistance * RIGHT_CLICK_ROTATION_SENSITIVITY;
                if (!isNaN(newYawDegrees)) {
                    userDataController.myAvatar.updateMyPositionAndOrientation(undefined, newYawDegrees);
                }
            }
        } else {
            let hoverM = Utilities.canvasPXToM({x: event.offsetX, y: event.offsetY});

            let room = roomController.getRoomFromName(userDataController.myAvatar.myUserData.currentRoomName);

            if (!(hoverM && room && userDataController.myAvatar.myUserData.position)) {
                return;
            }

            this.hoveredUserData = userDataController.allOtherUserData.find((userData) => {
                return userData.position && Utilities.getDistanceBetween2DPoints(userData.position.x, userData.position.z, hoverM.x, hoverM.z) < AVATAR_RADIUS_M;
            });

            if (!this.hoveredUserData && Utilities.getDistanceBetween2DPoints(userDataController.myAvatar.myUserData.position.x, userDataController.myAvatar.myUserData.position.z, hoverM.x, hoverM.z) < AVATAR_RADIUS_M) {
                this.hoveredUserData = userDataController.myAvatar.myUserData;
            }

            if (!this.hoveredUserData) {
                for (let i = 0; i < roomController.rooms.length; i++) {
                    let room = roomController.rooms[i];
                    this.hoveredSeat = room.seats.find((seat) => {
                        return Utilities.getDistanceBetween2DPoints(seat.position.x, seat.position.z, hoverM.x, hoverM.z) < SEAT_RADIUS_M;
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
}
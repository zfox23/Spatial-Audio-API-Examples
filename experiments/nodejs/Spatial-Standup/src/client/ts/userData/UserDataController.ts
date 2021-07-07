import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { userDataController, connectionController, roomController, physicsController, pathsController, uiController, twoDimensionalRenderer, webSocketConnectionController, watchPartyController, howlerController, uiThemeController } from "..";
import { Path, Waypoint } from "../ai/PathsController";
import { AVATAR, PHYSICS, UI } from "../constants/constants";
import { chairSounds } from "../sounds/LocalSoundsController";
import { SpatialAudioSeat, SpatialStandupRoom, SpatialStandupRoomType } from "../ui/RoomController";
import { DataToTransmitToHiFi, EasingFunctions, Utilities } from "../utilities/Utilities";
import { MyAvatarEars } from "./MyAvatarEars";

declare var HIFI_PROVIDED_USER_ID: string;

interface TempUserData {
    circleRadius?: number;
    startTheta?: number;
    targetTheta?: number;
    willMoveClockwise?: boolean;
    scrimOpacityInterval?: NodeJS.Timer;
}

export interface UserData {
    visitIDHash?: string;
    providedUserID?: string;
    currentRoom?: SpatialStandupRoom;
    currentSeat?: SpatialAudioSeat;
    displayName?: string;
    colorHex?: string;
    profileImageURL?: string;
    profileImageEl?: HTMLImageElement;
    motionStartTimestamp?: number;
    positionCircleCenter?: Point3D;
    positionStart?: Point3D;
    positionCurrent?: Point3D;
    positionTarget?: Point3D;
    orientationEulerStart?: OrientationEuler3D;
    orientationEulerCurrent?: OrientationEuler3D;
    orientationEulerTarget?: OrientationEuler3D;
    volumeDecibels?: number;
    userGainForThisConnection?: number;
    hiFiGain?: number;
    hiFiGainSliderValue?: string;
    volumeThreshold?: number;
    isAudioInputMuted?: boolean;
    echoCancellationEnabled?: boolean;
    agcEnabled?: boolean;
    noiseSuppressionEnabled?: boolean;
    stereoInput?: boolean;
    currentWatchPartyRoomName?: string;
    tempData?: TempUserData;
}

export enum MyAvatarModes {
    Normal,
    WatchParty,
}

export interface AvatarVelocity {
    x: number;
    z: number;
    forward?: number;
    right?: number;
}

class MyAvatar {
    myUserData: UserData;
    currentMode: MyAvatarModes;
    linearVelocityMPerS: AvatarVelocity = {x: 0, z: 0, forward: 0, right: 0};
    rotationalVelocityDegreesPerS: number = 0;

    constructor() {
        this.myUserData = {
            visitIDHash: undefined,
            providedUserID: HIFI_PROVIDED_USER_ID,
            currentRoom: undefined,
            currentSeat: undefined,
            displayName: undefined,
            colorHex: undefined,
            profileImageURL: undefined,
            profileImageEl: undefined,
            motionStartTimestamp: undefined,
            positionCircleCenter: undefined,
            positionStart: undefined,
            positionCurrent: undefined,
            positionTarget: undefined,
            orientationEulerStart: undefined,
            orientationEulerCurrent: undefined,
            orientationEulerTarget: undefined,
            userGainForThisConnection: 1.0,
            volumeDecibels: undefined,
            volumeThreshold: -60,
            hiFiGain: 1.0,
            hiFiGainSliderValue: "21",
            isAudioInputMuted: false,
            echoCancellationEnabled: false,
            agcEnabled: false,
            noiseSuppressionEnabled: false,
            stereoInput: false,
            currentWatchPartyRoomName: undefined,
            tempData: {},
        };

        this.currentMode = MyAvatarModes.Normal;
    }

    init() {
        if (localStorage.getItem('myDisplayName')) {
            this.onMyDisplayNameChanged(localStorage.getItem('myDisplayName'));
        } else {
            this.onMyDisplayNameChanged(HIFI_PROVIDED_USER_ID);
        }

        if (localStorage.getItem('myColorHex')) {
            this.onMyColorHexChanged(localStorage.getItem('myColorHex'));
        }

        if (localStorage.getItem('myProfileImageURL')) {
            this.onMyProfileImageURLChanged(localStorage.getItem('myProfileImageURL'));
        }
    }

    setMyAvatarVelocity(newVelocity: AvatarVelocity, tau: number) {
        let myVelocity = this.linearVelocityMPerS;
        if (tau < PHYSICS.CONSTANT_VELOCITY_UPDATE_TAU) {
            myVelocity.x += tau * (newVelocity.x - myVelocity.x);
            myVelocity.z += tau * (newVelocity.z - myVelocity.z);
        } else {
            myVelocity.x = newVelocity.x;
            myVelocity.z = newVelocity.z;
        }
    }

    positionSelfInRoom(targetRoomName: string) {
        if (pathsController.currentPath) {
            return;
        }

        let targetRoom = roomController.rooms.find((room) => {
            return room.name === targetRoomName;
        });

        if (!targetRoom) {
            console.error(`\`positionSelfInRoom()\`: Couldn't determine current room!`);
            return;
        }
        
        console.log(`Positioning self in room ${targetRoom.name}...`);

        let newSeat = targetRoom.getOptimalOpenSeat();
        if (!newSeat) {
            console.warn(`\`positionSelfInRoom()\`: Couldn't get first open seat in room named \`${targetRoomName}\`! Searching for open seats in other rooms...`);

            for (let i = 0; i < roomController.rooms.length; i++) {
                targetRoom = roomController.rooms[i];

                if (targetRoom.name === targetRoomName) {
                    continue;
                }

                newSeat = targetRoom.getOptimalOpenSeat();

                if (newSeat) {
                    break;
                }
            }
        }

        if (!newSeat) {
            console.warn(`\`positionSelfInRoom()\`: Couldn't find any open seats in any room!`);
            return;
        }
        console.log(`Found an open spot on seat \`${newSeat.seatID}\` in room ${newSeat.room.name} at ${JSON.stringify(newSeat.position)} with orientation ${JSON.stringify(newSeat.orientation)}.`);
        this.moveToNewSeat(newSeat);
    }

    moveToNewSeat(targetSeat: SpatialAudioSeat) {
        if (!userDataController.myAvatar) {
            console.warn(`Can't move to new seat - \`userDataController.myAvatar\` is falsey!`);
            return;
        }

        let myUserData = userDataController.myAvatar.myUserData;
        let dataToTransmit: DataToTransmitToHiFi = {};

        myUserData.motionStartTimestamp = undefined;

        // We enter this case if this is the first time we're moving to a new seat.
        if (!myUserData.positionCurrent) {
            myUserData.positionStart = undefined;
            myUserData.positionCurrent = new Point3D();
            Object.assign(myUserData.positionCurrent, targetSeat.position);
            howlerController.onMyGlobalPositionChanged(myUserData.positionCurrent);
            myUserData.positionTarget = undefined;
            
            dataToTransmit.position = myUserData.positionCurrent;
        }
        // We enter this case if this is the first time we're moving to a new seat.
        if (!myUserData.orientationEulerCurrent) {
            myUserData.orientationEulerStart = undefined;
            myUserData.orientationEulerCurrent = new OrientationEuler3D();
            myUserData.orientationEulerCurrent.yawDegrees = targetSeat.orientation.yawDegrees;
            howlerController.updateHowlerOrientation(myUserData.orientationEulerCurrent);
            myUserData.orientationEulerTarget = undefined;

            dataToTransmit.orientationEuler = myUserData.orientationEulerCurrent;
        }

        let isFirstMoveInNewSession = dataToTransmit.position || dataToTransmit.orientationEuler;

        if (isFirstMoveInNewSession) {
            let hifiCommunicator = connectionController.hifiCommunicator;
            if (hifiCommunicator) {
                hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);
            } else {
                console.warn(`\`moveToNewSeat()\`: Couldn't transmit user data!`);
            }
            physicsController.autoComputePXPerMFromRoom(targetSeat.room);
        } else {
            howlerController.playSound({ src: chairSounds[Math.floor(Math.random() * chairSounds.length)], randomSoundRate: true, positionM: myUserData.positionCurrent});
        }

        let currentRoom = myUserData.currentRoom;
        let targetRoom = targetSeat.room;

        if (!isFirstMoveInNewSession) {
            console.log(`User is moving from ${currentRoom ? currentRoom.name : "<Unknown Room>"} to ${targetRoom.name}...`);

            if (pathsController.currentPath) {
                pathsController.resetCurrentPath();
            }

            watchPartyController.leaveWatchParty();

            let newPath = new Path();
            newPath.onActivated.push(() => {
                if (myUserData.tempData.scrimOpacityInterval) {
                    clearInterval(myUserData.tempData.scrimOpacityInterval);
                }

                twoDimensionalRenderer.canvasScrimOpacity = 0.0;

                myUserData.tempData.scrimOpacityInterval = setInterval(() => {
                    if (twoDimensionalRenderer.canvasScrimOpacity < UI.CANVAS_SCRIM_OPACITY_DURING_MOTION) {
                        twoDimensionalRenderer.canvasScrimOpacity += 0.05;
                    } else {
                        twoDimensionalRenderer.canvasScrimOpacity = UI.CANVAS_SCRIM_OPACITY_DURING_MOTION;
                        clearInterval(myUserData.tempData.scrimOpacityInterval);
                        myUserData.tempData.scrimOpacityInterval = undefined;
                    }
                }, PHYSICS.PHYSICS_TICKRATE_MS);
            });
            newPath.onDeactivated.push(() => {
                if (myUserData.tempData.scrimOpacityInterval) {
                    clearInterval(myUserData.tempData.scrimOpacityInterval);
                }

                twoDimensionalRenderer.canvasScrimOpacity = UI.CANVAS_SCRIM_OPACITY_DURING_MOTION;

                myUserData.tempData.scrimOpacityInterval = setInterval(() => {
                    if (twoDimensionalRenderer.canvasScrimOpacity > 0.0) {
                        twoDimensionalRenderer.canvasScrimOpacity -= 0.05;
                    } else {
                        twoDimensionalRenderer.canvasScrimOpacity = 0.0;
                        clearInterval(myUserData.tempData.scrimOpacityInterval);
                        myUserData.tempData.scrimOpacityInterval = undefined;
                    }
                }, PHYSICS.PHYSICS_TICKRATE_MS);
            });
            if (currentRoom === targetRoom) {
                let transitionCircleCenter = new Point3D({x: currentRoom.seatingCenter.x, z: currentRoom.seatingCenter.z});

                let orientationEulerInitial = new OrientationEuler3D({yawDegrees: myUserData.orientationEulerCurrent.yawDegrees});
                let orientationEulerFinal = new OrientationEuler3D({yawDegrees: targetSeat.orientation.yawDegrees});

                let step1PositionStart = new Point3D({x: myUserData.positionCurrent.x, z: myUserData.positionCurrent.z});
                let step1PositionTheta = Math.atan2(step1PositionStart.z - transitionCircleCenter.z, step1PositionStart.x - transitionCircleCenter.x);
                let step1PositionEnd = new Point3D({
                    "x": (currentRoom.seatingRadiusM + AVATAR.RADIUS_M * 3) * Math.cos(step1PositionTheta) + transitionCircleCenter.x,
                    "z": (currentRoom.seatingRadiusM + AVATAR.RADIUS_M * 3) * Math.sin(step1PositionTheta) + transitionCircleCenter.z
                });
                let step3PositionEnd = new Point3D({x: targetSeat.position.x, z: targetSeat.position.z});
                let step2PositionTheta = Math.atan2(step3PositionEnd.z - transitionCircleCenter.z, step3PositionEnd.x - transitionCircleCenter.x);

                while (step1PositionTheta > step2PositionTheta) {
                    step2PositionTheta += 2 * Math.PI;
                }

                while (orientationEulerInitial.yawDegrees < orientationEulerFinal.yawDegrees) {
                    orientationEulerInitial.yawDegrees += 360;
                }

                let step2PositionStart = step1PositionEnd;
                let step2PositionEnd = new Point3D({
                    "x": (currentRoom.seatingRadiusM + AVATAR.RADIUS_M * 3) * Math.cos(step2PositionTheta) + transitionCircleCenter.x,
                    "z": (currentRoom.seatingRadiusM + AVATAR.RADIUS_M * 3) * Math.sin(step2PositionTheta) + transitionCircleCenter.z
                });

                let step3PositionStart = step2PositionEnd;

                newPath.pathWaypoints.push(new Waypoint({
                    positionStart: step1PositionStart,
                    positionTarget: step1PositionEnd,
                    orientationEulerStart: orientationEulerInitial,
                    orientationEulerTarget: orientationEulerInitial,
                    durationMS: 750,
                    easingFunction: EasingFunctions.easeOutQuad
                }));
                newPath.pathWaypoints.push(new Waypoint({
                    positionStart: step2PositionStart,
                    positionTarget: step2PositionEnd,
                    positionCircleCenter: transitionCircleCenter,
                    orientationEulerStart: orientationEulerInitial,
                    orientationEulerTarget: orientationEulerFinal,
                    durationMS: 1600,
                    easingFunction: EasingFunctions.easeInOutQuad
                }));
                newPath.pathWaypoints.push(new Waypoint({
                    positionStart: step3PositionStart,
                    positionTarget: step3PositionEnd,
                    orientationEulerStart: orientationEulerFinal,
                    orientationEulerTarget: orientationEulerFinal,
                    durationMS: 750,
                    easingFunction: EasingFunctions.easeOutQuad
                }));
            } else {
                newPath.onDeactivated.push(() => { physicsController.autoComputePXPerMFromRoom(targetRoom); })

                newPath.pathWaypoints.push(new Waypoint({
                    positionStart: new Point3D({x: myUserData.positionCurrent.x, z: myUserData.positionCurrent.z}),
                    positionTarget: new Point3D({x: targetSeat.position.x, z: targetSeat.position.z}),
                    orientationEulerStart: new OrientationEuler3D({yawDegrees: myUserData.orientationEulerCurrent.yawDegrees}),
                    orientationEulerTarget: new OrientationEuler3D({yawDegrees: targetSeat.orientation.yawDegrees}),
                    durationMS: 2000,
                    easingFunction: EasingFunctions.easeOutQuad
                }));
            }
            pathsController.setCurrentPath(newPath);
        }

        // We set the user's "current room" and "current seat" here
        // and update that data for everyone else in the server.
        // Technically, the user isn't necessarily yet _in that room_ or _in that seat_,
        // but doing this here "reserves" the seat for this user.
        if (myUserData.currentSeat) {
            myUserData.currentSeat.occupiedUserData = undefined;
        }
        myUserData.currentRoom = targetSeat.room;
        myUserData.currentSeat = targetSeat;
        if (myUserData.currentSeat) {
            myUserData.currentSeat.occupiedUserData = myUserData;
        }
        webSocketConnectionController.updateMyUserDataOnWebSocketServer();

        let normalModeCanvas = document.querySelector(".normalModeCanvas");
        if (normalModeCanvas) {
            normalModeCanvas.setAttribute("aria-label", myUserData.currentRoom.altText);
        }

        roomController.updateRoomList();

        userDataController.myAvatarEars.onMouthMovedToNewSeat(targetSeat);

        if (myUserData.currentRoom.roomType === SpatialStandupRoomType.WatchParty) {
            document.querySelector(".watchPartyControlsContainer").classList.remove("displayNone");
        } else {
            document.querySelector(".watchPartyControlsContainer").classList.add("displayNone");
        }
    }

    clearCurrentSeat() {
        let myUserData = userDataController.myAvatar.myUserData;
        if (!(myUserData && myUserData.currentSeat)) {
            return;
        }

        if (myUserData.currentSeat) {
            myUserData.currentSeat.occupiedUserData = undefined;
        }
        myUserData.currentSeat = undefined;
        myUserData.currentRoom = undefined;
        webSocketConnectionController.updateMyUserDataOnWebSocketServer();

        watchPartyController.leaveWatchParty();
        document.querySelector(".watchPartyControlsContainer").classList.add("displayNone");
        
        roomController.updateRoomList();
    }

    onMyDisplayNameChanged(newDisplayName?: string) {
        localStorage.setItem('myDisplayName', newDisplayName);
        this.myUserData.displayName = newDisplayName;
        uiController.updateMyDisplayName();
        webSocketConnectionController.updateMyUserDataOnWebSocketServer();
        try {
            roomController.updateRoomList();
        } catch (e) { }
    }

    onMyColorHexChanged(newColorHex?: string) {
        localStorage.setItem('myColorHex', newColorHex);
        this.myUserData.colorHex = newColorHex;
        uiController.updateMyProfileImage();
    }

    onMyProfileImageURLChanged(newProfileImageURL: string) {
        localStorage.setItem('myProfileImageURL', newProfileImageURL);
        this.myUserData.profileImageURL = newProfileImageURL;
        uiController.updateMyProfileImage();
    }
}

export class UserDataController {
    allOtherUserData: Array<UserData>;
    myAvatar: MyAvatar;
    myAvatarEars: MyAvatarEars;

    constructor() {
        this.allOtherUserData = [];
        this.myAvatar = new MyAvatar();
        this.myAvatarEars = new MyAvatarEars();
    }

    init() {
        this.myAvatar.init();
    }
}

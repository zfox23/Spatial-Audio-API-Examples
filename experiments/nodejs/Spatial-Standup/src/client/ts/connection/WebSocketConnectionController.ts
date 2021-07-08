import { avDevicesController, connectionController, howlerController, roomController, signalsController, twoDimensionalRenderer, uiController, userDataController, userInputController, watchPartyController } from "..";
import { SoundParams, HowlerController, chairSounds } from "../sounds/LocalSoundsController";
import { SignalParams } from "../ui/SignalsController";
import { Utilities } from "../utilities/Utilities";
declare var HIFI_SPACE_NAME: string;
declare var APP_MODE: string;

const io = require("socket.io-client");

interface WebSocketParticipantData {
    visitIDHash: string;
    currentSeatID: string;
    displayName: string;
    colorHex: string;
    profileImageURL: string;
    isAudioInputMuted: boolean;
    echoCancellationEnabled: boolean;
    agcEnabled: boolean;
    noiseSuppressionEnabled: boolean;
    hiFiGainSliderValue: string;
    volumeThreshold: number;
    currentWatchPartyRoomName: string;
}

export class WebSocketConnectionController {
    socket: SocketIOClient.Socket;
    readyToSendWebSocketData: boolean = false;
    retrievedInitialWebSocketServerData: boolean = false;

    constructor() {
        const socketURL = APP_MODE === "web" ? "" : "https://standup.highfidelity.com";
        this.socket = io(socketURL, { path: '/socket.io' });

        this.socket.on("connect", (socket: any) => {
            console.log(`Connected to Socket.IO WebSocket server!`);
            this.maybeSendInitialWebSocketData();
        });

        this.socket.on("disconnect", (socket: any) => {
            console.log(`Disconnected from Socket.IO WebSocket server!`);
        });

        this.socket.on("onParticipantsAddedOrEdited", (participantArray: Array<WebSocketParticipantData>) => {
            console.log(`Retrieved information about ${participantArray.length} participant(s) from the server:\n${JSON.stringify(participantArray)}`);
            participantArray.forEach((participant) => {
                let {
                    visitIDHash,
                    currentSeatID,
                    displayName,
                    colorHex,
                    profileImageURL,
                    isAudioInputMuted,
                    echoCancellationEnabled,
                    agcEnabled,
                    noiseSuppressionEnabled,
                    hiFiGainSliderValue,
                    volumeThreshold,
                    currentWatchPartyRoomName,
                } = participant;

                let localUserData = userDataController.allOtherUserData.find((userData) => { return userData.visitIDHash === visitIDHash; });
                if (localUserData) {
                    let playChairSound = false;

                    if (typeof (displayName) === "string") {
                        localUserData.displayName = displayName;
                    }
                    if (typeof (colorHex) === "string") {
                        localUserData.colorHex = colorHex;
                    }
                    if (typeof (profileImageURL) === "string") {
                        localUserData.profileImageURL = profileImageURL;

                        if (localUserData.profileImageURL && localUserData.profileImageURL.length > 0) {
                            localUserData.profileImageEl = new Image();
                            localUserData.profileImageEl.src = localUserData.profileImageURL;
                        } else {
                            localUserData.profileImageEl = undefined;
                        }
                    }
                    if (typeof (isAudioInputMuted) === "boolean") {
                        localUserData.isAudioInputMuted = isAudioInputMuted;
                        if (!localUserData.isAudioInputMuted) {
                            playChairSound = true;
                        }
                    }
                    if (typeof (echoCancellationEnabled) === "boolean") {
                        localUserData.echoCancellationEnabled = echoCancellationEnabled;
                    }
                    if (typeof (agcEnabled) === "boolean") {
                        localUserData.agcEnabled = agcEnabled;
                    }
                    if (typeof (noiseSuppressionEnabled) === "boolean") {
                        localUserData.noiseSuppressionEnabled = noiseSuppressionEnabled;
                    }
                    if (typeof (hiFiGainSliderValue) === "string") {
                        localUserData.hiFiGainSliderValue = hiFiGainSliderValue;
                        localUserData.hiFiGain = uiController.hiFiGainFromSliderValue(localUserData.hiFiGainSliderValue);
                    }
                    if (typeof (volumeThreshold) === "number") {
                        localUserData.volumeThreshold = volumeThreshold;
                    }
                    if (typeof (currentSeatID) === "string") {
                        if (localUserData.currentSeat) {
                            localUserData.currentSeat.occupiedUserData = undefined;
                            playChairSound = true;
                        }
                        localUserData.currentSeat = roomController.getSeatFromSeatID(currentSeatID);
                        if (localUserData.currentSeat) {
                            localUserData.currentSeat.occupiedUserData = localUserData;
                            localUserData.currentRoom = localUserData.currentSeat.room;
                        } else {
                            localUserData.currentRoom = undefined;
                        }
                    }
                    if (typeof (currentWatchPartyRoomName) === "string") {
                        localUserData.currentWatchPartyRoomName = currentWatchPartyRoomName;

                        if (userDataController.myAvatar.myUserData.currentRoom && localUserData.currentWatchPartyRoomName === userDataController.myAvatar.myUserData.currentRoom.name) {
                            watchPartyController.joinWatchParty(userDataController.myAvatar.myUserData.currentRoom.name);
                        }
                    }

                    if (playChairSound) {
                        howlerController.playSound({ src: chairSounds[Math.floor(Math.random() * chairSounds.length)], randomSoundRate: true, positionM: localUserData.positionCurrent, volume: 0.3 });
                    }
                    
                    console.log(`Updated participant:\nVisit ID Hash \`${localUserData.visitIDHash}\`:\nDisplay Name: \`${displayName}\`\nColor: ${colorHex}\nprofileImageURL: ${profileImageURL}\nisAudioInputMuted: ${isAudioInputMuted}\nCurrent Seat ID: ${localUserData.currentSeat ? localUserData.currentSeat.seatID : "undefined"}\nCurrent Room Name: ${localUserData.currentRoom ? localUserData.currentRoom.name : "undefined"}\nechoCancellationEnabled: ${echoCancellationEnabled}\nagcEnabled: ${agcEnabled}\nnsEnabled: ${noiseSuppressionEnabled}\nhiFiGainSliderValue: ${hiFiGainSliderValue}\nvolumeThreshold:${volumeThreshold}\ncurrentWatchPartyRoomName:${currentWatchPartyRoomName}\n`);
                } else if (visitIDHash && displayName) {
                    localUserData = {
                        visitIDHash,
                        displayName,
                        colorHex,
                        profileImageURL,
                        isAudioInputMuted,
                        echoCancellationEnabled,
                        agcEnabled,
                        noiseSuppressionEnabled,
                        hiFiGainSliderValue,
                        volumeThreshold,
                        currentWatchPartyRoomName,
                        tempData: {}
                    };
                    localUserData.hiFiGain = uiController.hiFiGainFromSliderValue(localUserData.hiFiGainSliderValue);

                    if (localUserData.currentSeat) {
                        localUserData.currentSeat.occupiedUserData = undefined;
                    }
                    localUserData.currentSeat = roomController.getSeatFromSeatID(currentSeatID);
                    if (localUserData.currentSeat) {
                        localUserData.currentSeat.occupiedUserData = localUserData;
                        localUserData.currentRoom = localUserData.currentSeat.room;
                    } else {
                        localUserData.currentRoom = undefined;
                    }

                    if (localUserData.profileImageURL && localUserData.profileImageURL.length > 0) {
                        localUserData.profileImageEl = new Image();
                        localUserData.profileImageEl.src = localUserData.profileImageURL;
                    } else {
                        localUserData.profileImageEl = undefined;
                    }

                    userDataController.allOtherUserData.push(localUserData);
                }

                uiController.maybeUpdateAvatarContextMenu(localUserData);
                roomController.updateRoomList();
            });

            if (!this.retrievedInitialWebSocketServerData) {
                this.retrievedInitialWebSocketServerData = true;
                
                if (connectionController.receivedInitialOtherUserDataFromHiFi && roomController.roomsInitialized) {
                    userDataController.myAvatar.positionSelfInRoom(roomController.getStartingRoomName());
                }
            }
        });

        this.socket.on("onRequestToEnableEchoCancellation", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to enable echo cancellation!`);
            if (typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().echoCancellation) {
                avDevicesController.audioConstraints.echoCancellation = true;
                connectionController.setNewInputAudioMediaStream();
            } else {
                console.warn("Can't enable echoCancellation; current browser doesn't support that constraint!");
            }
        });

        this.socket.on("onRequestToDisableEchoCancellation", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to disable echo cancellation!`);
            avDevicesController.audioConstraints.echoCancellation = false;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToEnableAGC", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to enable AGC!`);
            if (typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().autoGainControl) {
                avDevicesController.audioConstraints.autoGainControl = true;
                connectionController.setNewInputAudioMediaStream();
            } else {
                console.warn("Can't enable autoGainControl; current browser doesn't support that constraint!");
            }
        });

        this.socket.on("onRequestToDisableAGC", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to disable AGC!`);
            avDevicesController.audioConstraints.autoGainControl = false;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToEnableNoiseSuppression", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to enable Noise Suppression!`);
            
            if (typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().noiseSuppression) {
                avDevicesController.audioConstraints.noiseSuppression = true;
                connectionController.setNewInputAudioMediaStream();
            } else {
                console.warn("Can't enable noiseSuppression; current browser doesn't support that constraint!");
            }
        });

        this.socket.on("onRequestToDisableNoiseSuppression", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to disable NS!`);
            avDevicesController.audioConstraints.noiseSuppression = false;
            connectionController.setNewInputAudioMediaStream();
        });

        this.socket.on("onRequestToChangeHiFiGainSliderValue", ({ fromVisitIDHash, newHiFiGainSliderValue }: { fromVisitIDHash: string, newHiFiGainSliderValue: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to change HiFiGainSliderValue to \`${newHiFiGainSliderValue}\`!`);
            userInputController.setHiFiGainFromSliderValue(newHiFiGainSliderValue);
        });

        this.socket.on("onRequestToChangeVolumeThreshold", ({ fromVisitIDHash, newVolumeThreshold }: { fromVisitIDHash: string, newVolumeThreshold: number }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to change Volume Threshold to \`${newVolumeThreshold}\`!`);
            userInputController.setVolumeThreshold(newVolumeThreshold);
        });

        this.socket.on("onRequestToMuteAudioInputDevice", ({ fromVisitIDHash }: { fromVisitIDHash: string }) => {
            console.warn(`Got a request from \`${fromVisitIDHash}\` to mute audio input device!`);
            userInputController.setInputMute(true);
        });

        this.socket.on("requestParticleAdd", ({ visitIDHash, particleData }: { visitIDHash: string, particleData: string}) => {
            let particleParams: SignalParams = JSON.parse(particleData);
        
            if (particleParams.name) {
                console.log(`"${visitIDHash}" added a signal particle!`);
                signalsController.addSignal(particleParams);
            }
        });

        this.socket.on("requestSoundAdd", ({ visitIDHash, soundParams }: { visitIDHash: string, soundParams: string}) => {
            let parsedSoundParams: SoundParams = JSON.parse(soundParams);

            console.log(`"${visitIDHash}" requested to play a sound!`);
            howlerController.playSound(parsedSoundParams);
        });
    }

    maybeSendInitialWebSocketData() {
        if (!this.readyToSendWebSocketData) {
            return;
        }

        const myUserData = userDataController.myAvatar.myUserData;
        let userUUID = localStorage.getItem('userUUID');
        if (!userUUID) {
            userUUID = Utilities.generateUUID(true);
            localStorage.setItem('userUUID', userUUID);

            uiController.showFTUE();
        } else {
            document.querySelector(".bottomBar").classList.remove("displayNone");
            document.querySelector(".topBar").classList.remove("displayNone");
            document.querySelector(".bottomRightControlsContainer").classList.remove("displayNone");
            twoDimensionalRenderer.updateCanvasDimensions();
        }

        this.socket.emit("addParticipant", {
            userUUID: userUUID,
            sessionStartTimestamp: Date.now(),
            spaceName: HIFI_SPACE_NAME,
            visitIDHash: myUserData.visitIDHash,
            currentSeatID: myUserData.currentSeat ? myUserData.currentSeat.seatID : "",
            displayName: myUserData.displayName,
            colorHex: myUserData.colorHex,
            profileImageURL: myUserData.profileImageURL,
            isAudioInputMuted: myUserData.isAudioInputMuted,
            echoCancellationEnabled: myUserData.echoCancellationEnabled,
            agcEnabled: myUserData.agcEnabled,
            noiseSuppressionEnabled: myUserData.noiseSuppressionEnabled,
            hiFiGainSliderValue: myUserData.hiFiGainSliderValue,
            volumeThreshold: myUserData.volumeThreshold,
            currentWatchPartyRoomName: myUserData.currentWatchPartyRoomName,
        });
    }

    updateMyUserDataOnWebSocketServer() {
        if (!this.readyToSendWebSocketData) {
            return;
        }

        const myUserData = userDataController.myAvatar.myUserData;

        let dataToUpdate = {
            spaceName: HIFI_SPACE_NAME,
            visitIDHash: myUserData.visitIDHash,
            currentSeatID: myUserData.currentSeat ? myUserData.currentSeat.seatID : "",
            displayName: myUserData.displayName,
            colorHex: myUserData.colorHex,
            profileImageURL: myUserData.profileImageURL,
            isAudioInputMuted: myUserData.isAudioInputMuted,
            echoCancellationEnabled: myUserData.echoCancellationEnabled,
            agcEnabled: myUserData.agcEnabled,
            noiseSuppressionEnabled: myUserData.noiseSuppressionEnabled,
            hiFiGainSliderValue: myUserData.hiFiGainSliderValue,
            volumeThreshold: myUserData.volumeThreshold,
            currentWatchPartyRoomName: myUserData.currentWatchPartyRoomName,
        };

        console.log(`Updating data about me on server:\n${JSON.stringify(dataToUpdate)}`);

        this.socket.emit("editParticipant", dataToUpdate);
    }

    requestToEnableEchoCancellation(visitIDHash: string) {
        this.socket.emit("requestToEnableEchoCancellation", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToDisableEchoCancellation(visitIDHash: string) {
        this.socket.emit("requestToDisableEchoCancellation", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToEnableAGC(visitIDHash: string) {
        this.socket.emit("requestToEnableAGC", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToDisableAGC(visitIDHash: string) {
        this.socket.emit("requestToDisableAGC", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToEnableNoiseSuppression(visitIDHash: string) {
        this.socket.emit("requestToEnableNoiseSuppression", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToDisableNoiseSuppression(visitIDHash: string) {
        this.socket.emit("requestToDisableNoiseSuppression", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    requestToChangeHiFiGainSliderValue(visitIDHash: string, newHiFiGainSliderValue: string) {
        this.socket.emit("requestToChangeHiFiGainSliderValue", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash, newHiFiGainSliderValue });
    }

    requestToChangeVolumeThreshold(visitIDHash: string, newVolumeThreshold: number) {
        this.socket.emit("requestToChangeVolumeThreshold", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash, newVolumeThreshold });
    }

    requestToMuteAudioInputDevice(visitIDHash: string) {
        this.socket.emit("requestToMuteAudioInputDevice", { spaceName: HIFI_SPACE_NAME, toVisitIDHash: visitIDHash, fromVisitIDHash: userDataController.myAvatar.myUserData.visitIDHash });
    }

    stopWebSocketStuff() {
        console.log(`Disconnecting from WebSocket server...`);
        this.socket.disconnect();
        this.readyToSendWebSocketData = false;
    }
}
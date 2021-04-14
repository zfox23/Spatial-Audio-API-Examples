import { HiFiCommunicator, HiFiLogger, HiFiLogLevel, getBestAudioConstraints, HiFiUserDataStreamingScopes, ReceivedHiFiAudioAPIData, UserDataSubscription, AvailableUserDataSubscriptionComponents, OrientationEuler3D, Point3D } from 'hifi-spatial-audio';
import { avDevicesController, roomController, uiController, userDataController, videoController, webSocketConnectionController } from '..';
import { Utilities } from '../utilities/Utilities';
import { WebSocketConnectionController } from './WebSocketConnectionController';

declare var HIFI_JWT: string;
declare var HIFI_ENDPOINT_URL: string;

// For maximum visibility into what the API is doing.
HiFiLogger.setHiFiLogLevel(HiFiLogLevel.Debug);

export interface AudionetInitResponse {
    build_number: string;
    build_type: string;
    build_version: string;
    id: string;
    success: boolean;
    user_id: string;
    visit_id_hash: string;
}

export class ConnectionController {
    hifiCommunicator: HiFiCommunicator;
    receivedInitialOtherUserDataFromHiFi: boolean = false;

    constructor() {
        this.hifiCommunicator = new HiFiCommunicator({
            transmitRateLimitTimeoutMS: 10,
            onUsersDisconnected: this.onUsersDisconnected,
            userDataStreamingScope: HiFiUserDataStreamingScopes.All
        });

        window.addEventListener('beforeunload', this.shutdown.bind(this));
    }

    async setNewInputAudioMediaStream(): Promise<MediaStream> {
        return new Promise(async (resolve, reject) => {
            // Get the audio media stream associated with the user's default audio input device.
            try {
                console.log(`Calling \`getUserMedia()\` with the following audio constraints:\n${JSON.stringify(avDevicesController.audioConstraints)}`);
                avDevicesController.inputAudioMediaStream = await navigator.mediaDevices.getUserMedia({ audio: avDevicesController.audioConstraints, video: false });
            } catch (e) {
                reject(`Error calling \`getUserMedia()\`! Error:\n${e}`);
                return;
            }
            
            if (typeof (avDevicesController.audioConstraints.echoCancellation) !== "undefined") {
                let newEchoCancellationStatus = !!avDevicesController.audioConstraints.echoCancellation.valueOf();
                userDataController.myAvatar.myUserData.echoCancellationEnabled = newEchoCancellationStatus;
            }
            
            if (typeof (avDevicesController.audioConstraints.autoGainControl) !== "undefined") {
                let newAGCStatus = !!avDevicesController.audioConstraints.autoGainControl.valueOf();
                userDataController.myAvatar.myUserData.agcEnabled = newAGCStatus;
            }

            if (webSocketConnectionController) {
                webSocketConnectionController.updateMyUserDataOnWebSocketServer();
            }
            uiController.maybeUpdateAvatarContextMenu(userDataController.myAvatar.myUserData);

            // Set up our `HiFiCommunicator` object and supply our input media stream.
            console.log("Setting input audio stream on `this.hifiCommunicator`...");
            try {
                await this.hifiCommunicator.setInputAudioMediaStream(avDevicesController.inputAudioMediaStream);
                resolve(avDevicesController.inputAudioMediaStream);
            } catch (e) {
                reject(e);
            }
        });
    }

    async connectToHighFidelity(): Promise<AudionetInitResponse> {
        return new Promise(async (resolve, reject) => {
            console.log("Starting connection process...");

            try {
                await this.setNewInputAudioMediaStream();
            } catch (e) {
                return;
            }

            // Get the URL search params for below...
            let searchParams = new URLSearchParams(location.search);
            let audionetInitResponse: AudionetInitResponse;
            try {
                let jwt;
                if (searchParams.get("jwt")) {
                    // Use the JWT embedded in the URL if there is one.
                    jwt = searchParams.get("jwt");
                } else {
                    // Otherwise, use the JWT embedded in the HTML via Webpack's `DefinePlugin`.
                    jwt = HIFI_JWT;
                }

                if (!jwt || jwt.length === 0) {
                    reject("JWT not defined!");
                    return;
                }

                // Overriding the stack parameter is generally for internal High Fidelity use only.
                // See here for more information: https://docs.highfidelity.com/js/latest/classes/classes_hificommunicator.hificommunicator.html#connecttohifiaudioapiserver
                let stackURLOverride = searchParams.get("stack");

                // Connect!
                let connectionStatus = await this.hifiCommunicator.connectToHiFiAudioAPIServer(jwt, stackURLOverride || HIFI_ENDPOINT_URL);
                audionetInitResponse = connectionStatus.audionetInitResponse;
            } catch (e) {
                reject(`Error connecting to High Fidelity:\n${e}`);
                return;
            }

            // Set up a new User Data Subscription to get User Data updates from the server.
            let newUserDataSubscription = new UserDataSubscription({
                // Setting `providedUserID` to `null` (or omitting it) means we will get data updates from **all** connected Users, including ourselves.
                "providedUserID": null,
                // There are other components we could subscribe to here, but we're only subscribing to Volume data updates.
                "components": [
                    AvailableUserDataSubscriptionComponents.Position,
                    AvailableUserDataSubscriptionComponents.OrientationEuler,
                    AvailableUserDataSubscriptionComponents.VolumeDecibels
                ],
                // See above for the definition of `onNewHiFiUserDataReceived`.
                "callback": this.onNewHiFiUserDataReceived.bind(this)
            });
            // Actually add the newly-constructed Data Subscription to the list of our Data Subscriptions on our `HiFiCommunicator`.
            this.hifiCommunicator.addUserDataSubscription(newUserDataSubscription);

            // Set the `srcObject` on our `audio` DOM element to the final, mixed audio stream from the High Fidelity Audio API Server.
            avDevicesController.outputAudioElement.srcObject = this.hifiCommunicator.getOutputAudioMediaStream();
            // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
            avDevicesController.outputAudioElement.play();

            userDataController.myAvatar.myUserData.visitIDHash = audionetInitResponse.visit_id_hash;
            if (!userDataController.myAvatar.myUserData.colorHex) {
                userDataController.myAvatar.onMyColorHexChanged(Utilities.hexColorFromString(userDataController.myAvatar.myUserData.visitIDHash));
            }

            resolve(audionetInitResponse);
        });
    }

    async startConnectionProcess(): Promise<AudionetInitResponse> {
        let audionetInitResponse: AudionetInitResponse;
        try {
            audionetInitResponse = await this.connectToHighFidelity();
        } catch (e) {
            console.error(`Couldn't connect to High Fidelity!`);
            return;
        }

        videoController.connectToTwilio();

        return audionetInitResponse;
    }

    async onNewHiFiUserDataReceived(receivedHiFiAudioAPIDataArray: Array<ReceivedHiFiAudioAPIData>) {
        let myUserData = userDataController.myAvatar.myUserData;
        const myVisitIDHash = userDataController.myAvatar.myUserData.visitIDHash;
        let receivedNewPositionData = false;

        for (let i = 0; i < receivedHiFiAudioAPIDataArray.length; i++) {
            let currentDataFromServer = receivedHiFiAudioAPIDataArray[i];
            let currentVisitIDHash = currentDataFromServer.hashedVisitID;
            let isMine = false;
            let thisAvatarMoved = false;
            let currentLocalUserData = userDataController.allOtherUserData.find((element) => { return element.visitIDHash === currentVisitIDHash; })
            if (!currentLocalUserData && currentVisitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                currentLocalUserData = myUserData;
                isMine = true;
            }

            if (currentLocalUserData) {
                if (currentDataFromServer.providedUserID && !isMine) {
                    currentLocalUserData.providedUserID = currentDataFromServer.providedUserID;
                }

                if (currentDataFromServer.position && !isMine) {
                    let targetPosition = new Point3D();

                    if (typeof (currentDataFromServer.position.x) === "number") {
                        targetPosition.x = currentDataFromServer.position.x;
                    } else if (typeof (currentLocalUserData.positionCurrent.x) === "number") {
                        targetPosition.x = currentLocalUserData.positionCurrent.x;
                    }

                    if (typeof (currentDataFromServer.position.z) === "number") {
                        targetPosition.z = currentDataFromServer.position.z;
                    } else if (typeof (currentLocalUserData.positionCurrent.z) === "number") {
                        targetPosition.z = currentLocalUserData.positionCurrent.z;
                    }

                    if (!currentLocalUserData.positionCurrent) {
                        currentLocalUserData.positionStart = undefined;
                        currentLocalUserData.positionCurrent = new Point3D();
                        Object.assign(currentLocalUserData.positionCurrent, targetPosition);
                        currentLocalUserData.positionTarget = undefined;
                    } else {
                        if (!currentLocalUserData.positionStart) {
                            currentLocalUserData.positionStart = new Point3D();
                        }
                        Object.assign(currentLocalUserData.positionStart, currentLocalUserData.positionCurrent);
                        
                        if (!currentLocalUserData.positionTarget) {
                            currentLocalUserData.positionTarget = new Point3D();
                        }
                        Object.assign(currentLocalUserData.positionTarget, targetPosition);
                    }

                    thisAvatarMoved = true;
                    receivedNewPositionData = true;
                    currentLocalUserData.motionStartTimestamp = undefined;
                }
                
                if (currentDataFromServer.orientationEuler && typeof (currentDataFromServer.orientationEuler.yawDegrees) === "number" && !isMine) {
                    let targetOrientation = new OrientationEuler3D();
                    targetOrientation.yawDegrees = currentDataFromServer.orientationEuler.yawDegrees;
                    targetOrientation.yawDegrees %= 360;

                    // If this avatar has NOT also moved during the current reception of user data,
                    // slam the orientation to whatever the server has sent to us.
                    if (!currentLocalUserData.orientationEulerCurrent || !thisAvatarMoved) {
                        currentLocalUserData.orientationEulerStart = undefined;
                        currentLocalUserData.orientationEulerCurrent = new OrientationEuler3D();
                        Object.assign(currentLocalUserData.orientationEulerCurrent, targetOrientation);
                        currentLocalUserData.orientationEulerTarget = undefined;
                    } else {
                        if (!currentLocalUserData.orientationEulerStart) {
                            currentLocalUserData.orientationEulerStart = new OrientationEuler3D();
                        }
                        Object.assign(currentLocalUserData.orientationEulerStart, currentLocalUserData.orientationEulerCurrent);
                        
                        if (!currentLocalUserData.orientationEulerTarget) {
                            currentLocalUserData.orientationEulerTarget = new OrientationEuler3D();
                        }
                        Object.assign(currentLocalUserData.orientationEulerTarget, targetOrientation);
                    }

                    currentLocalUserData.motionStartTimestamp = undefined;
                }

                if (typeof (currentDataFromServer.volumeDecibels) === "number") {
                    currentLocalUserData.volumeDecibels = currentDataFromServer.volumeDecibels;

                    if (isMine) {
                        let currentPeak = currentLocalUserData.volumeDecibelsPeak;
                        let newPeak = Math.max(currentPeak, currentLocalUserData.volumeDecibels);
                        currentLocalUserData.volumeDecibelsPeak = newPeak;
                    }
                }
            } else {
                console.log(`Received data about new user from Spatial Audio API: ${JSON.stringify(currentDataFromServer)}`);

                receivedNewPositionData = true;

                if (currentDataFromServer.orientationEuler) {
                    currentDataFromServer.orientationEuler.yawDegrees %= 360;
                }

                userDataController.allOtherUserData.push({
                    visitIDHash: currentVisitIDHash,
                    positionCurrent: currentDataFromServer.position,
                    orientationEulerCurrent: currentDataFromServer.orientationEuler,
                    volumeDecibels: currentDataFromServer.volumeDecibels,
                    userGainForThisConnection: 1.0,
                    tempData: {},
                });
            }
        }
            
        let initiallyAlone = false;
        if (!this.receivedInitialOtherUserDataFromHiFi && receivedHiFiAudioAPIDataArray.length === 1 && receivedHiFiAudioAPIDataArray[0].hashedVisitID === myVisitIDHash) {
            console.log("We're the only one here!");
            initiallyAlone = true;
            this.receivedInitialOtherUserDataFromHiFi = true;
        }
        
        if (!this.receivedInitialOtherUserDataFromHiFi || initiallyAlone) {
            if (!this.receivedInitialOtherUserDataFromHiFi) {
                this.receivedInitialOtherUserDataFromHiFi = true;
            }

            if (initiallyAlone || this.receivedInitialOtherUserDataFromHiFi) {
                if (webSocketConnectionController.retrievedInitialWebSocketServerData) {
                    userDataController.myAvatar.positionSelfInRoom(roomController.getStartingRoomName());
                }
            }
        }

        if (!webSocketConnectionController.readyToSendWebSocketData) {
            webSocketConnectionController.readyToSendWebSocketData = true;
            webSocketConnectionController.maybeSendInitialWebSocketData();
        }
    }

    shutdown() {
        console.log(`Shutting down...`);

        webSocketConnectionController.stopWebSocketStuff();

        videoController.disconnectFromTwilio();

        if (this.hifiCommunicator) {
            this.hifiCommunicator.disconnectFromHiFiAudioAPIServer();
        }
        this.hifiCommunicator = null;
    }

    onUsersDisconnected(allDisconnectedUserData: Array<ReceivedHiFiAudioAPIData>) {
        for (const disconnectedUserData of allDisconnectedUserData) {
            console.log(`HiFi User left: ${JSON.stringify(disconnectedUserData)}`);

            let localUser = userDataController.allOtherUserData.find((localUserData) => {
                return localUserData.visitIDHash === disconnectedUserData.hashedVisitID;
            });

            if (localUser && localUser.currentSeat) {
                localUser.currentSeat.occupiedUserData = undefined;
            }

            userDataController.allOtherUserData = userDataController.allOtherUserData.filter((localUserData) => {
                return localUserData.visitIDHash !== disconnectedUserData.hashedVisitID;
            });
        }
    }
}
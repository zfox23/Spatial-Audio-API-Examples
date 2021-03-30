import { HiFiCommunicator, HiFiLogger, HiFiLogLevel, getBestAudioConstraints, HiFiUserDataStreamingScopes, ReceivedHiFiAudioAPIData, UserDataSubscription, AvailableUserDataSubscriptionComponents, OrientationEuler3D, Point3D } from 'hifi-spatial-audio';
import { userDataController } from '..';
import { AVDevicesController } from '../avDevices/AVDevicesController';
import { CLOSE_ENOUGH_M } from '../constants/constants';
import { Utilities } from '../utilities/Utilities';
import { WebSocketConnectionController } from './WebSocketConnectionController';

declare var HIFI_JWT: string;

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
    avDevicesController: AVDevicesController;
    hifiCommunicator: HiFiCommunicator;
    webSocketConnectionController: WebSocketConnectionController;
    receivedInitialOtherUserDataFromHiFi: boolean = false;

    constructor() {
        this.avDevicesController = new AVDevicesController();
        this.webSocketConnectionController = new WebSocketConnectionController();
        this.hifiCommunicator = new HiFiCommunicator({
            transmitRateLimitTimeoutMS: 10,
            onUsersDisconnected: this.onUsersDisconnected,
            userDataStreamingScope: HiFiUserDataStreamingScopes.All
        });

        window.addEventListener("beforeunload", (e) => {
            this.disconnectFromHiFi();
        });
    }

    async startConnectionProcess(): Promise<AudionetInitResponse> {
        return new Promise(async (resolve, reject) => {
            console.log("Starting connection process...");

            // Get the audio media stream associated with the user's default audio input device.
            try {
                console.log("Calling `getUserMedia()`...");
                this.avDevicesController.inputAudioMediaStream = await navigator.mediaDevices.getUserMedia({ audio: getBestAudioConstraints(), video: false });
            } catch (e) {
                reject(`Error calling \`getUserMedia()\`! Error:\n${e}`);
                return;
            }

            // Set up our `HiFiCommunicator` object and supply our input media stream.
            console.log("Setting input audio stream on `this.hifiCommunicator`...");
            await this.hifiCommunicator.setInputAudioMediaStream(this.avDevicesController.inputAudioMediaStream);

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
                let connectionStatus = await this.hifiCommunicator.connectToHiFiAudioAPIServer(jwt, stackURLOverride);
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
            this.avDevicesController.outputAudioElement.srcObject = this.hifiCommunicator.getOutputAudioMediaStream();
            // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
            this.avDevicesController.outputAudioElement.play();

            userDataController.myAvatar.myUserData.visitIDHash = audionetInitResponse.visit_id_hash;
            userDataController.myAvatar.myUserData.colorHex = Utilities.hexColorFromString(userDataController.myAvatar.myUserData.visitIDHash);

            resolve(audionetInitResponse);
        });
    }

    async onNewHiFiUserDataReceived(receivedHiFiAudioAPIDataArray: Array<ReceivedHiFiAudioAPIData>) {
        let myUserData = userDataController.myAvatar.myUserData;
        const myVisitIDHash = userDataController.myAvatar.myUserData.visitIDHash;
        for (let i = 0; i < receivedHiFiAudioAPIDataArray.length; i++) {
            let currentDataFromServer = receivedHiFiAudioAPIDataArray[i];
            let currentVisitIDHash = currentDataFromServer.hashedVisitID;
            let isMine = false;
            let currentLocalUserData = userDataController.allOtherUserData.find((element) => { return element.visitIDHash === currentVisitIDHash; })
            if (!currentLocalUserData) {
                currentLocalUserData = myUserData;
                isMine = true;
            }

            if (currentLocalUserData) {
                if (currentDataFromServer.position && !isMine) {
                    if (!currentLocalUserData.position) {
                        currentLocalUserData.position = new Point3D();
                    }

                    if (typeof (currentDataFromServer.position.x) === "number") {
                        currentLocalUserData.position.x = currentDataFromServer.position.x;
                    }
                    if (typeof (currentDataFromServer.position.z) === "number") {
                        currentLocalUserData.position.z = currentDataFromServer.position.z;
                    }
                }
                
                if (currentDataFromServer.orientationEuler && !isMine) {
                    if (!currentLocalUserData.orientationEuler) {
                        currentLocalUserData.orientationEuler = new OrientationEuler3D();
                    }

                    if (typeof (currentDataFromServer.orientationEuler.yawDegrees) === "number") {
                        currentLocalUserData.orientationEuler.yawDegrees = currentDataFromServer.orientationEuler.yawDegrees;
                        currentLocalUserData.orientationEuler.yawDegrees %= 360;
                    }
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
                console.log(`Received data about new user from Spatial Audio API: ${JSON.stringify(currentDataFromServer)}`)
                if (currentDataFromServer.orientationEuler) {
                    currentDataFromServer.orientationEuler.yawDegrees %= 360;
                }
                userDataController.allOtherUserData.push({
                    visitIDHash: currentVisitIDHash,
                    colorHex: Utilities.hexColorFromString(currentVisitIDHash),
                    position: currentDataFromServer.position,
                    orientationEuler: currentDataFromServer.orientationEuler,
                    volumeDecibels: currentDataFromServer.volumeDecibels,
                });
                //recomputeSpeakerAndAudienceCount();
            }
        }
            
        let allAlone = false;
        if (!this.receivedInitialOtherUserDataFromHiFi && receivedHiFiAudioAPIDataArray.length === 1 && receivedHiFiAudioAPIDataArray[0].hashedVisitID === myVisitIDHash) {
            console.log("We're the only one here!");
            allAlone = true;
            this.receivedInitialOtherUserDataFromHiFi = true;
        }
        
        if (!this.receivedInitialOtherUserDataFromHiFi || allAlone) {
            let mustReposition = false;
            if (!this.receivedInitialOtherUserDataFromHiFi) {
                this.receivedInitialOtherUserDataFromHiFi = true;
                mustReposition = true;
            }

            if (allAlone || mustReposition) {
                userDataController.myAvatar.positionSelfInCrowd();
            }
        }

        if (!this.webSocketConnectionController.readyToSendWebSocketData) {
            this.webSocketConnectionController.readyToSendWebSocketData = true;
            this.webSocketConnectionController.maybeSendInitialWebSocketData();
        }
    }

    disconnectFromHiFi() {
        if (this.hifiCommunicator) {
            this.hifiCommunicator.disconnectFromHiFiAudioAPIServer();
        }
        this.hifiCommunicator = null;
    }

    onUsersDisconnected(allDisconnectedUserData: Array<ReceivedHiFiAudioAPIData>) {
        for (const disconnectedUserData of allDisconnectedUserData) {
            console.log(`HiFi User left: ${JSON.stringify(disconnectedUserData)}`);
            userDataController.allOtherUserData = userDataController.allOtherUserData.filter((localUserData) => {
                return localUserData.visitIDHash !== disconnectedUserData.hashedVisitID;
            });
        }
        //recomputeSpeakerAndAudienceCount();
    }
}
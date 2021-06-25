import { HiFiCommunicator, HiFiUserDataStreamingScopes, OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { AudionetInitResponse } from "../connection/ConnectionController";
import { SpatialAudioSeat } from "../ui/RoomController";
import { UserData } from "./UserDataController";
import { DataToTransmitToHiFi } from "../utilities/Utilities";
import { avDevicesController, connectionController, localSoundsController, userDataController } from "..";
declare var HIFI_JWT: string;
declare var HIFI_ENDPOINT_URL: string;
declare var HIFI_PROVIDED_USER_ID: string;

export class MyAvatarEars {
    hifiCommunicator: HiFiCommunicator;
    mouthUserData: UserData;
    earsOutputAudioElement: HTMLAudioElement;
    currentSeat: SpatialAudioSeat;
    isConnected: boolean = false;
    isConnecting: boolean = false;

    constructor() {
        this.earsOutputAudioElement = document.createElement("audio");
        this.earsOutputAudioElement.classList.add("earsOutputAudioElement", "displayNone");
        this.earsOutputAudioElement.setAttribute("autoplay", "true");
        document.body.appendChild(this.earsOutputAudioElement);

        this.mouthUserData = {
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
            volumeDecibels: undefined,
            volumeDecibelsPeak: undefined,
            volumeThreshold: -60,
            hiFiGain: 1.0,
            hiFiGainSliderValue: "21",
            isAudioInputMuted: false,
            echoCancellationEnabled: false,
            agcEnabled: false,
            noiseSuppressionEnabled: false,
            currentWatchPartyRoomName: undefined,
            userGainForThisConnection: 1.0,
            tempData: {},
        };

        window.addEventListener('beforeunload', this.shutdown.bind(this));
    }

    async toggleConnection(): Promise<any> {
        if (this.isConnecting) {
            console.log(`Can't toggle connection while we're currently connecting.`);
            return;
        }

        if (this.isConnected) {
            return await this.shutdown();
        } else {
            return await this.connectToHighFidelity();
        }
    }

    async connectToHighFidelity(): Promise<AudionetInitResponse> {
        return new Promise(async (resolve, reject) => {
            if (this.isConnected || this.isConnecting) {
                reject(`Already connected or connecting!`);
            }

            this.hifiCommunicator = new HiFiCommunicator({
                transmitRateLimitTimeoutMS: 10,
                userDataStreamingScope: HiFiUserDataStreamingScopes.None
            });

            this.isConnecting = true;

            console.log("Starting connection process for MyAvatarEars...");

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

            // Set the `srcObject` on our `audio` DOM element to the final, mixed audio stream from the High Fidelity Audio API Server.
            this.earsOutputAudioElement.srcObject = this.hifiCommunicator.getOutputAudioMediaStream();
            // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
            this.earsOutputAudioElement.play();

            this.mouthUserData.visitIDHash = audionetInitResponse.visit_id_hash;

            this.isConnected = true;
            this.isConnecting = false;

            this.resetMouthOrientation();
            this.transmitUserData();
            this.muteMyMouthForMyEars();
            this.muteMyOtherEars();

            resolve(audionetInitResponse);
        });
    }

    async shutdown() {
        if (this.hifiCommunicator) {
            await this.hifiCommunicator.disconnectFromHiFiAudioAPIServer();
        }
        this.hifiCommunicator = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.unmuteMyOtherEars();
    }

    resetMouthOrientation() {
        let lockedYawDegrees = userDataController.myAvatar.myUserData.currentSeat.orientation.yawDegrees;
        userDataController.myAvatar.myUserData.orientationEulerCurrent.yawDegrees = lockedYawDegrees;
        let hifiCommunicator = connectionController.hifiCommunicator;
        if (hifiCommunicator) {
            hifiCommunicator.updateUserDataAndTransmit({ orientationEuler: new OrientationEuler3D({ yawDegrees: lockedYawDegrees }) });
        }
        localSoundsController.updateHowlerOrientation(userDataController.myAvatar.myUserData.orientationEulerCurrent);
    }

    muteMyOtherEars() {
        avDevicesController.outputAudioElement.volume = 0.0;
    }

    unmuteMyOtherEars() {
        avDevicesController.outputAudioElement.volume = 1.0;
    }

    muteMyMouthForMyEars() {
        if (!(this.hifiCommunicator && this.isConnected)) {
            return;
        }

        const mouthVisitIDHash = userDataController.myAvatar.myUserData.visitIDHash;
        console.log(`Setting the gain for my "mouth" (Visit ID Hash \`${mouthVisitIDHash}\`) to 0...`);
        this.hifiCommunicator.setOtherUserGainForThisConnection(mouthVisitIDHash, 0);
    }

    onMouthMovedToNewSeat(targetSeat: SpatialAudioSeat) {
        this.currentSeat = targetSeat;

        console.log(`My ears have moved to the room named \`${this.currentSeat.room.name}\`.`);

        this.resetMouthOrientation();

        this.transmitUserData();
    }

    transmitUserData() {
        if (!this.isConnected) {
            return;
        }

        let dataToTransmit: DataToTransmitToHiFi = {
            orientationEuler: new OrientationEuler3D({ yawDegrees: this.currentSeat.orientation.yawDegrees }),
            position: new Point3D({ x: this.currentSeat.room.seatingCenter.x, z: this.currentSeat.room.seatingCenter.z })
        };

        this.hifiCommunicator.updateUserDataAndTransmit(dataToTransmit);
    }
}

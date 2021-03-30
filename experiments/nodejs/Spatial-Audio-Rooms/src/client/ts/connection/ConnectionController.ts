import { HiFiCommunicator, HiFiLogger, HiFiLogLevel, getBestAudioConstraints } from 'hifi-spatial-audio';
import { userDataController } from '..';
import { AVDevicesController } from '../avDevices/AVDevicesController';

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

    constructor() {
        this.avDevicesController = new AVDevicesController();
        this.hifiCommunicator = new HiFiCommunicator();
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

            // Set the `srcObject` on our `audio` DOM element to the final, mixed audio stream from the High Fidelity Audio API Server.
            this.avDevicesController.outputAudioElement.srcObject = this.hifiCommunicator.getOutputAudioMediaStream();
            // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
            this.avDevicesController.outputAudioElement.play();

            userDataController.myAvatar.myUserData.visitIDHash = audionetInitResponse.visit_id_hash;

            resolve(audionetInitResponse);
        });
    }
}
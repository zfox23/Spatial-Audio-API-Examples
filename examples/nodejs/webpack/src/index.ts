import { HiFiCommunicator, HiFiLogger, HiFiLogLevel, getBestAudioConstraints } from 'hifi-spatial-audio';

// We need to declare `HIFI_JWT` here so the TypeScript compiler doesn't complain.
// We're actually defining this variable using Webpack's `DefinePlugin` - see `../webpack.config.js`.
declare var HIFI_JWT: string;

// For maximum visibility into what the API is doing.
HiFiLogger.setHiFiLogLevel(HiFiLogLevel.Debug);

// This gets called when the user clicks the big "Connect" button in the UI.
async function connectToHiFiAudio() {
    // Disable the Connect button after the user clicks it so we don't double-connect.
    connectButton.disabled = true;
    connectButton.innerHTML = `Connecting...`;

    // Get the audio media stream associated with the user's default audio input device.
    let audioMediaStream;
    try {
        audioMediaStream = await navigator.mediaDevices.getUserMedia({ audio: getBestAudioConstraints(), video: false });
    } catch (e) {
        return;
    }

    // Set up our `HiFiCommunicator` object and supply our input media stream.
    let hifiCommunicator = new HiFiCommunicator();
    await hifiCommunicator.setInputAudioMediaStream(audioMediaStream);

    // Get the URL search params for below...
    let searchParams = new URLSearchParams(location.search);
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
            console.error("JWT not defined!");
            return;
        }

        // Overriding the stack parameter is generally for internal High Fidelity use only.
        // See here for more information: https://docs.highfidelity.com/js/latest/classes/classes_hificommunicator.hificommunicator.html#connecttohifiaudioapiserver
        let stackURLOverride = searchParams.get("stack");

        // Connect!
        await hifiCommunicator.connectToHiFiAudioAPIServer(jwt, stackURLOverride);
    } catch (e) {
        console.error(`Error connecting to High Fidelity:\n${e}`);
        connectButton.disabled = false;
        connectButton.innerHTML = `Connection error. Retry?`;
        return;
    }

    // Show the user that we're connected by changing the text on the button.
    connectButton.innerHTML = `Connected!`;

    // Set the `srcObject` on our `audio` DOM element to the final, mixed audio stream from the High Fidelity Audio API Server.
    outputAudioEl.srcObject = hifiCommunicator.getOutputAudioMediaStream();
    // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
    outputAudioEl.play();
}

// Define the `button` HTML element, set its appearance, and set up the click event listener.
let connectButton = document.createElement('button');
connectButton.style.cssText = 'width: 100%; height: 200px; margin: 0;';
connectButton.innerHTML = "Tap to Connect...";
connectButton.addEventListener('click', async (e) => {
    await connectToHiFiAudio();
});

// Define the `audio` HTML element, set its appearance, and ensure it's visible and will autoplay.
let outputAudioEl = document.createElement('audio');
outputAudioEl.style.cssText = 'width: 100%; height: 75px; margin: 30px 0 0 0;';
outputAudioEl.controls = true;
outputAudioEl.autoplay = true;

// Append the above two HTML elements to the DOM.
document.body.appendChild(connectButton);
document.body.appendChild(outputAudioEl);

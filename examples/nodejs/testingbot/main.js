const {
    Point3D,
    HiFiAudioAPIData,
    HiFiCommunicator
} = require("hifi-spatial-audio");
const { MediaStream } = require("wrtc");
const RTCAudioSourceSineWave = require("./rtcaudiosourcesinewave"); // Copied w/o change from wrtc examples.

const HIFI_AUDIO_API_KEY = "abc123";

const source = new RTCAudioSourceSineWave();
const track = source.createTrack();

const communicator = new HiFiCommunicator({
    position: new Point3D({ "x": 0, "y": 0, "z": 0 }),
});

(async function () {
    try {
        let responseLogString = await communicator.connectToHiFiAudioAPIServer(HIFI_AUDIO_API_KEY);
        console.log(responseLogString);
    } catch(error) {
        console.error('connection failed', error);
    }
    await communicator.setInputAudioMediaStream(new MediaStream([track]));
})();

// You can connect with the example/html client and hear the tone.



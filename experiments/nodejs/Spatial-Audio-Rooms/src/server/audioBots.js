const { MediaStream, nonstandard: { RTCAudioSource } } = require('wrtc'); // Used to create the `MediaStream` containing your Audio Bot's audio.
const fetch = require('node-fetch'); // Used to download the MP3 or WAV file from the server.
const path = require('path'); // Used to verify that the specified audio file is an MP3 or WAV file.
const decode = require('audio-decode'); // Used to decode the audio file present on your local disk.
const format = require('audio-format'); // Allows us to retrieve available format properties from an audio-like object, such as our `AudioBuffer`.
const convert = require('pcm-convert'); // Allows us to convert our `AudioBuffer` into the proper `int16` format.
const { HiFiAudioAPIData, HiFiCommunicator, Point3D, preciseInterval } = require('hifi-spatial-audio'); // Used to interface with the Spatial Audio API.
const { generateHiFiJWT } = require('./utilities');
const auth = require('../../auth.json');

/**
 * Play the audio from a file into a High Fidelity Space. The audio will loop indefinitely.
 *
 * @param {string} audioPath - Path to an `.mp3` or `.wav` audio file
 * @param {object} position - The {x, y, z} point at which to spatialize the audio.
 * @param {number} hiFiGain - Set above 1 to boost the volume of the bot, or set below 1 to attenuate the volume of the bot.
 */
async function startAudioBot(providedUserID, audioURL, position, hiFiGain) {
    // Make sure we've been passed an `audioPath`...
    if (!audioURL) {
        console.error(`Audio URL not specified!`);
        return;
    }

    // Make sure that the file at `audioPath` is a `.mp3` or a `.wav` file.
    let audioFileExtension = path.extname(audioURL).toLowerCase();
    if (!(audioFileExtension === ".mp3" || audioFileExtension === ".wav")) {
        console.error(`Specified audio file must be a \`.mp3\` or a \`.wav\`!\nInstead, it's a \`${audioFileExtension}\``);
        return;
    }

    let response, fileBuffer;
    try {
        response = await fetch(audioURL);
    } catch (e) {
        console.error(`Error when fetching ${audioURL}:\n${e}`);
        return;
    }

    try {
        fileBuffer = await response.buffer();
    } catch (e) {
        console.error(`Error when transforming resopnse into buffer:\n${e}`);
        return;
    }

    // Decode the audio file buffer into an AudioBuffer object.
    const audioBuffer = await decode(fileBuffer),
        // Obtain various necessary pieces of information about the audio file.
        { numberOfChannels, sampleRate, length, duration } = audioBuffer,
        // Get the correct format of the `audioBuffer`.
        parsed = format.detect(audioBuffer),
        // Convert the parsed `audioBuffer` into the proper format.
        convertedAudioBuffer = convert(audioBuffer, parsed, 'int16'),
        // Define the number of bits per sample encoded into the original audio file. `16` is a commonly-used number. The Audio Bot may malfunction
        // if the audio file specified is encoded using a different number of bits per sample.
        BITS_PER_SAMPLE = 16,
        // Define the interval at which we want to fill the sample data being streamed into the `MediaStream` sent up to the Server.
        // `wrtc` expects this to be 10ms.
        TICK_INTERVAL_MS = 10,
        // There are 1000 milliseconds per second :)
        MS_PER_SEC = 1000,
        // The number of times we fill up the audio buffer per second.
        TICKS_PER_SECOND = MS_PER_SEC / TICK_INTERVAL_MS,
        // The number of audio samples present in the `MediaStream` audio buffer per tick.
        SAMPLES_PER_TICK = sampleRate / TICKS_PER_SECOND,
        // Contains the audio sample data present in the `MediaStream` audio buffer sent to the Server.
        currentSamples = new Int16Array(numberOfChannels * SAMPLES_PER_TICK),
        // Contains all of the data necessary to pass to our `RTCAudioSource()`, which is sent to the Server.
        currentAudioData = { samples: currentSamples, sampleRate, bitsPerSample: BITS_PER_SAMPLE, channelCount: numberOfChannels, numberOfFrames: SAMPLES_PER_TICK },
        // The `MediaStream` sent to the server consists of an "Audio Source" and, within that Source, a single "Audio Track".
        source = new RTCAudioSource(),
        track = source.createTrack(),
        // This is the final `MediaStream` sent to the server. The data within that `MediaStream` will be updated on an interval.
        inputAudioMediaStream = new MediaStream([track]),
        // Define the initial HiFi Audio API Data used when connecting to the Spatial Audio API.
        initialHiFiAudioAPIData = new HiFiAudioAPIData({
            position: position,
            hiFiGain: hiFiGain
        }),
        // Set up the HiFiCommunicator used to communicate with the Spatial Audio API.
        hifiCommunicator = new HiFiCommunicator({ initialHiFiAudioAPIData });

    // Set the Input Audio Media Stream to the `MediaStream` we created above. We'll fill it up with data below.
    await hifiCommunicator.setInputAudioMediaStream(inputAudioMediaStream);

    // `sampleNumber` defines where we are in the decoded audio stream from above. `0` means "we're at the beginning of the audio file".
    let sampleNumber = 0;
    // Called once every `TICK_INTERVAL_MS` milliseconds.
    let tick = () => {
        // This `for()` loop fills up `currentSamples` with the right amount of raw audio data grabbed from the correct position
        // in the decoded audio file.
        for (let frameNumber = 0; frameNumber < SAMPLES_PER_TICK; frameNumber++, sampleNumber++) {
            for (let channelNumber = 0; channelNumber < numberOfChannels; channelNumber++) {
                currentSamples[frameNumber * numberOfChannels + channelNumber] = convertedAudioBuffer[sampleNumber * numberOfChannels + channelNumber] || 0;
            }
        }

        // This is the function that actually modifies the `MediaStream` we're sending to the Server.
        source.onData(currentAudioData);

        // Check if we're at the end of our audio file. If so, reset the `sampleNumber` so that we loop.
        if (sampleNumber > length) {
            sampleNumber = 0;
        }
    }

    // Generate the JWT used to connect to our High Fidelity Space.
    let hiFiJWT = await generateHiFiJWT(providedUserID, auth.HIFI_DEFAULT_SPACE_NAME, false);
    if (!hiFiJWT) {
        return;
    }

    // Connect to our High Fidelity Space.
    let connectResponse;
    try {
        connectResponse = await hifiCommunicator.connectToHiFiAudioAPIServer(hiFiJWT, auth.HIFI_ENDPOINT_URL);
    } catch (e) {
        console.error(`Call to \`connectToHiFiAudioAPIServer()\` failed! Error:\n${JSON.stringify(e)}`);
        return;
    }

    // Set up the `preciseInterval` used to regularly update the `MediaStream` we're sending to the Server.
    preciseInterval(tick, TICK_INTERVAL_MS);

    console.log(`Audio bot started! Audio URL: ${audioURL}`);
}

startAudioBot("Tree Sounds", "https://hifi-content.s3.amazonaws.com/Audio/EnvSounds/WindandWater/ELWW%20Wind%20through%20large%20bamboo%20bush%2C%20movement%20leaves%20branches%20creak%2C%20very%20faint%20birds.mp3", new Point3D({x: -1.1937015896635599, z: 0.5384111441848216}), 0.6);
startAudioBot("Tree Sounds", "https://hifi-content.s3.amazonaws.com/Audio/EnvSounds/WindandWater/ELWW%20Wind%20through%20bamboo%20bush%2C%20leaf%20and%20branch%20movement.mp3", new Point3D({x: 1.4091348594515265, z: 0.24351004935432052}), 0.6);

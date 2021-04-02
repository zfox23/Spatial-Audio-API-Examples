const yargs = require('yargs');
const { MediaStream, nonstandard: { RTCAudioSource } } = require('wrtc');
const fs = require('fs');
const path = require('path');
const decode = require('audio-decode');
const format = require('audio-format');
const convert = require('pcm-convert');
import { Point3D, HiFiLogger, HiFiLogLevel, HiFiAudioAPIData, HiFiCommunicator, preciseInterval } from 'hifi-spatial-audio';

let MAP={};
let AUDIO_BUFFERS = {}
let AUDIO_DATA = [];
let WORK_QUEUE = [];
let JWT='';
let STACK='';

const BITS_PER_SAMPLE = 16,
      TICK_INTERVAL_MS = 10,
      POSITION_INTERVAL_MS = 50,
      MS_PER_SEC = 1000,
      TICKS_PER_SECOND = MS_PER_SEC / TICK_INTERVAL_MS;

const status = {
    STOPPED: 'stopped',
    CONNECTING: 'connecting',
    IDLE: 'idle',
    PLAYING: 'playing'
}


// Workers take sound jobs off the WORK_QUEUE and play them.
class AudioWorker {
    
    constructor() {
        this.status = status.STOPPED;
        this.hifiCommunicator = null;
        this.audioSource = null;
        this.audioTrack = null;
        this.inputAudioMediaStream = null;
        this.sampleNumber = 0;
        this.currentJob = null;
    };
    
    // Connect to the hifi spatial audio server.
    async connect() {
        const initialHiFiAudioAPIData = new HiFiAudioAPIData({
            position: new Point3D({x:0, y:0, z:0}),
            hiFiGain: 1.0
        });
        
        this.audioSource = new RTCAudioSource();
        this.audioTrack = this.audioSource.createTrack();
        this.inputAudioMediaStream = new MediaStream([this.audioTrack ]);
        
        this.hifiCommunicator = new HiFiCommunicator({ initialHiFiAudioAPIData });        
        await this.hifiCommunicator.setInputAudioMediaStream(this.inputAudioMediaStream);

        let connectResponse;
        try {
            connectResponse = await this.hifiCommunicator.connectToHiFiAudioAPIServer(JWT, STACK);
        } catch (e) {
            console.error(`Call to \`connectToHiFiAudioAPIServer()\` failed! Error:\n${JSON.stringify(e)}`);
            return;
        }        
        this.status = status.IDLE;
        this.interval = null;
        this.popJob();
    };
    
    // Pop a job, position it, and begin playing.
    popJob() {
        if (this.status === status.STOPPED) {
            this.connect();
        }       
        if ((this.status !== status.IDLE) || (WORK_QUEUE.length === 0)) {
            setTimeout(() => { this.popJob(); }, MS_PER_SEC);  // wait for a job
            return;            
        }
        
        this.currentJob = WORK_QUEUE.shift();   

        this.status = status.PLAYING;
        
        // find the audio buffer containing audio for this particular sound.
        this.currentAudio = AUDIO_BUFFERS[this.currentJob.filename];
        
        // position the hifi spatial audio connection in 3d space for the start of the job.
        this.position = new Point3D({x: this.currentJob.x_start, y: this.currentJob.y_start, z: this.currentJob.z_start});

        // calculate the per-tick change in position for the audio source
        if (this.currentJob.x_end !== undefined && this.currentJob.y_end !== undefined && this.currentJob.z_end !== undefined) {
            this.posDelta = new Point3D();
            let dt = (POSITION_INTERVAL_MS / MS_PER_SEC) / this.currentAudio.duration;
            this.posDelta.x = dt*(this.currentJob.x_end - this.currentJob.x_start);
            this.posDelta.y = dt*(this.currentJob.y_end - this.currentJob.y_start);
            this.posDelta.z = dt*(this.currentJob.z_end - this.currentJob.z_start);
            
            // if this is a moving source, resent the position and move every 50ms
            this.positionInterval = preciseInterval(() => { this.sendPositionAndMove(); }, POSITION_INTERVAL_MS);
        }
        this.sendPositionAndMove();

        // prep the frame buffer and start ticking
        this.sampleNumber = 0;
        this.samplesPerTick = this.currentAudio.sampleRate / TICKS_PER_SECOND;         
        this.currentSamples = new Int16Array(this.currentAudio.numChannels * this.samplesPerTick); 
        this.interval = preciseInterval(() => { this.tick(); }, TICK_INTERVAL_MS);

    }
    
    sendPositionAndMove() {
        let response = this.hifiCommunicator.updateUserDataAndTransmit({
            position: this.position,
            orientationEuler: { 'yawDegrees': this.currentJob.orientation}
        });
        if (this.posDelta) {
            this.position.x += this.posDelta.x;
            this.position.y += this.posDelta.y;        
            this.position.z += this.posDelta.z;
        }
    }
    
    
    // for each tick, copy data from the appropriate location in the sounds audio buffer and
    // inject it into the audio source, which will then be sent to the hifi spatial audio server
    tick() {
        for (let frameNumber = 0; frameNumber < this.samplesPerTick; frameNumber++, this.sampleNumber++) {
            for (let channelNumber = 0; channelNumber < this.currentAudio.numChannels; channelNumber++) {
                this.currentSamples[frameNumber * this.currentAudio.numChannels + channelNumber] = this.currentAudio.audioBuffer[this.sampleNumber * this.currentAudio.numChannels + channelNumber] || 0;
            }
        }       
        this.currentAudioData = { samples: this.currentSamples, 
                                  sampleRate: this.currentAudio.sampleRate, 
                                  bitsPerSample: BITS_PER_SAMPLE, 
                                  channelCount: this.currentAudio.numChannels, 
                                  numberOfFrames: this.samplesPerTick };

        this.audioSource.onData(this.currentAudioData);

        if (this.sampleNumber > this.currentAudio.length) {
            this.status = status.IDLE;
            if (this.positionInterval) {
                this.positionInterval.clear();
                this.positionInterval = null;
            }
            this.posDelta = null;
            if (this.interval) {
                this.interval.clear();
                this.interval = null;
                // Requeue the job.
                pushJob(this.currentJob);
                this.currentJob = null;
            
                // look for more work.
                this.popJob();
            }
        }
    }
};

// put the job onto the queue after the appropriate amount of time
function pushJob(job) {
    setTimeout(() => {
        console.log("Push Job", job);
        WORK_QUEUE.push(job);
    }, MS_PER_SEC * Math.floor(Math.random() * (job.max_time - job.min_time + 1) + job.min_time));
}


// Read the map file from our local filesystem into a file buffer.
function loadMap(mapPath) {
    if (!fs.statSync(mapPath).isFile()) {
        console.error(`Specified path "${mapPath}" is not a file!`);
        return;
    }
    const fileBuffer = fs.readFileSync(mapPath);
    MAP = JSON.parse(fileBuffer);
}

// load an audio file, decode it, and store it in the buffer associated with that file
async function loadAudioFile(audioPath) {
    console.log("Loading audio file:" + audioPath);
    if (!fs.statSync(audioPath).isFile()) {
        console.error(`Specified path "${audioPath}" is not a file!`);
        return;
    }

    // Make sure that the file at `audioPath` is a `.mp3` or a `.wav` file.
    let audioFileExtension = path.extname(audioPath).toLowerCase();
    if (!(audioFileExtension === ".mp3" || audioFileExtension === ".wav")) {
        console.error(`Specified audio file must be a \`.mp3\` or a \`.wav\`!\nInstead, it's a \`${audioFileExtension}\``);
        return;
    }    
    const fileBuffer = fs.readFileSync(audioPath),
        // Decode the audio file buffer into an AudioBuffer object.
        audioBuffer = await decode(fileBuffer),
        { numberOfChannels, sampleRate, length, duration } = audioBuffer,
        parsed = format.detect(audioBuffer),
        convertedAudioBuffer = convert(audioBuffer, parsed, 'int16');
    return {
          audioBuffer: convertedAudioBuffer, 
          numChannels: numberOfChannels,
          sampleRate: sampleRate,
          length: length,
          duration: duration 
    };
};

// For each audio job in the config file, load the audio buffer
// if it's not already been loaded, and push the job onto the queue.
async function loadAudioJobs() {
    let loadFile = async function (source) {
        if (!AUDIO_BUFFERS[source.filename]) {
            AUDIO_BUFFERS[source.filename] = await loadAudioFile(`./audio/${source.filename}`);
        }
        pushJob(source);
    }

    MAP.audio_sources.forEach(loadFile);  
};


async function startWorkers(numWorkers) {
    for(let i=0; i < numWorkers; i++) {
        let worker = new AudioWorker();
        await worker.connect();
        worker.popJob();
    }
}

const argv = yargs
    .option('map', {
        describe: 'path to the map file',
        type: 'string',
        default: '../data/map.json'
    })
    .options('n', {
        describe: 'Number of workers',
        type: 'number',
        default: 10
    })
    .options('j', {
        describe: 'JWT',
        type: 'string'
    })
    .options('s', {
        describe: 'Stack',
        type: 'string'
    })
    .help()
    .alias('help', 'h')
    .argv;

JWT = argv.j;
STACK = argv.s;

loadMap(argv.map);
loadAudioJobs();

startWorkers(argv.n);


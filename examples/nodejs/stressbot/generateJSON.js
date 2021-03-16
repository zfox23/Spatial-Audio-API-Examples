'use strict';

const fs = require('fs');
const {randomNumberBetween} = require('./vectors');

const nMaleAudio = 31;
const nFemaleAudio = 31;
// But one of each is a bad recording, so totals will be one less for each.
const excludeMale = [11];
const excludeFemale = [];
const audioFileURLPrefix = "https://hifi-content.s3.amazonaws.com/Bot_Demo_Content/audio/2020-07-08_no_pops/";

const xBounds = [-20, 20];
const zBounds = [-20, 20];

const filename = 'load.json'
const bots = [];

async function generateBots(n, audioPrefix, excluding) {
    let [lowX, highX] = xBounds,
        [lowZ, highZ] = zBounds;
    for (let i = 1; i <= n; i++) { // Audio filenames run 1 through n.
        if (excluding.includes(i)) continue;
        let name = `${audioPrefix}${i}`;
        bots.push({
            audio: `${audioFileURLPrefix}${audioPrefix}${i.toString().padStart(2, '0')}.mp3`,
            name,
            x: randomNumberBetween(lowX, highX, true),
            z: randomNumberBetween(lowZ, highZ, true),
            motor: null
        });
    }
}
async function generate() {
    await generateBots(nMaleAudio, 'M', excludeMale);
    await generateBots(nFemaleAudio, 'F', excludeFemale);
    bots.sort(() => Math.random() - 0.5);

    console.log('writing', bots.length, 'bots to', filename);
    console.log();
    console.log(`run with:`);
    console.log(`  npm run bots -- --configuration ${filename} --jwt YOUR_JWT --numBots anyIntegerUpTo${bots.length}`);
    console.log(`or in multiple parts with:`);
    console.log(`  pm2 start integration-test.js --name part1 -- --configuration ${filename} --jwt YOUR_JWT --numBots 24`);
    console.log(`  pm2 start integration-test.js --name part2 -- --configuration ${filename} --jwt YOUR_JWT --numBots 25 --offset 25`);
    console.log();    
    console.log(`Note: you can edit integration-test.js to supply your own app_id, space_id, and stackName, so that you don't have to supply --jwt each time.`);
    console.log(`See also: npm run bots -- --help`);

    fs.writeFile(filename, JSON.stringify(bots, null, 4), console.log);
}
generate();

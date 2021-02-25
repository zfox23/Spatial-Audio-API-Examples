
const yargs = require('yargs');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

let MAP={};

function loadMap(mapPath) {
    if (!fs.statSync(mapPath).isFile()) {
        console.error(`Specified path "${mapPath}" is not a file!`);
        return;
    }
    // Read the audio file from our local filesystem into a file buffer.
    const fileBuffer = fs.readFileSync(mapPath);
    MAP = JSON.parse(fileBuffer);
}


function generateClientFile(outputFile) {
    let output = { 'rooms': {}};
    for (const [room, roomData] of Object.entries(MAP.rooms)) {
        output.rooms[room] = { 
            'x_min': roomData.x_min,
            'x_max': roomData.x_max,
            'y_min': roomData.y_min,
            'y_max': roomData.y_max,
            'z_min': roomData.z_min,
            'z_max': roomData.z_max,
            'doors': {}            
        };
        
        for (const [door, doorData] of Object.entries(roomData.doors)) {
            output.rooms[room].doors[door] = {
                'x': doorData.x,
                'z': doorData.z,
                'r': doorData.r
            };
        }
    }
    
    if(!outputFile) {
        process.stdout.write(JSON.stringify(output));
    } else {
        fs.writeFile(outputFile, JSON.stringify(output), (err) => { console.log(err); });
    }
}

async function generateZones(stack, jwt, space) {
    
    let space_url = function(path) {
        return `https://loadbalancer-${stack}.highfidelity.io/api/v1/spaces/${space}/settings${path}?token=${jwt}`
    }
    console.log("Uploading audio and zone settings");
 
    // delete existing zones by retrieving all zones
    // and deleting them one by one.  This will also
    // delete all zone_attenuation objects
    nodes = fetch(space_url('/zones'))
        .then(response => response.json())
        .then(response => {
            response.forEach(zone => {
                let zone_id = zone['id'];
                fetch(space_url(`/zones/${zone_id}`), {
                    method: 'DELETE'
                });
            });
        });
        
    // set the global attenuation_coefficients
    fetch(space_url(''), {
        method: 'POST',
        headers: {
            'Content-type': 'application/json; charset=UTF-8' // Indicates the content 
        },        
        body: JSON.stringify({
            'global-attenuation': 0.5
        })
    });
    
    let mansion = { x_min: 0, x_max: 0, y_min: 0, y_max: 0, z_min:0, z_max:0 }
    
    let zone_to_id = {};
    // create new zones
    for (const [room, roomData] of Object.entries(MAP.rooms)) {
        await fetch(space_url('/zones/create'), {
            method: 'POST',
            headers: {
                'Content-type': 'application/json; charset=UTF-8' // Indicates the content 
            },        
            body: JSON.stringify({
                'name': room,
                'x-min': roomData.x_min,
                'x-max': roomData.x_max,
                'y-min': roomData.y_min,
                'y-max': roomData.y_max,
                'z-min': roomData.z_min,
                'z-max': roomData.z_max,
                'reverb-time': roomData.reverb_time,
                'wet-level': roomData.wet_level
        })})
        .then(response => response.json())
        .then(response => {
            zone_to_id[room] = response['id'];
        });
    }

    // create all of the zone attenuation objects
    let za_offset = 1;
    let set_zone = async function (source, listener, coefficient) {
        await fetch(space_url('/zone_attenuations/create'), {
            method: 'POST',
            headers: {
                'Content-type': 'application/json; charset=UTF-8' // Indicates the content 
            },        
            body: JSON.stringify({
                'source-zone-id': zone_to_id[source],
                'listener-zone-id': zone_to_id[listener],
                'za-offset': za_offset++,
                'attenuation': coefficient
        })});
    }
    for (const [room, roomData] of Object.entries(MAP.rooms)) {
        zones = new Set();
        for (const [room, roomData] of Object.entries(MAP.rooms)) {
            zones.add(room);
        }
        for (const [zone, coefficient] of Object.entries(roomData.attenuation_coefficients)) {
            await set_zone(room, zone, coefficient);
            zones.delete(zone);            
        }
            
        // all 'self' zones and zones not specified.
        for (const zone of zones) {
            if (room !== zone) {
                await set_zone(room, zone, 0.95);
            } else {
                await set_zone(room, zone, 0.5);               
            }
        }
    }
}


// Define all of the valid arguments that we can supply to this script on the command line.
const argv = yargs
    .option('map', {
        describe: 'path to the map file',
        type: 'string',
        default: '../data/map.json'
    })
    .options('c', {
        describe: 'Generate the client file',
        type: 'boolean'
    })
    .options('z', {
        describe: 'Update zones',
        type: 'boolean'
    })
    .options('j', {
        describe: 'JWT',
        type: 'string'
    })
    .options('stack', {
        describe: 'Stack',
        type: 'string'
    })
    .options('s', {
        describe: 'Space ID',
        type: 'string'
    })
    .options('o', {
        describe: 'Output file',
        type: 'string'
    })
    .help()
    .alias('help', 'h')
    .argv;

loadMap(argv.map);

if (argv.c) {
    generateClientFile(argv.o);
} else if (argv.z) {
    if (!argv.j && ~argv.s) {
        console.log('Must pass in jwt (j) and space id (s)');
    }
    generateZones(argv.stack, argv.j, argv.s);
} else {
    console.log('Must pass c or z');
}    


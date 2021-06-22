import { Point3D } from "hifi-spatial-audio";
import { SpatialAudioRoom } from "../ui/RoomController";
import { UITheme } from "../ui/UIThemeController";
import Room1 from "../../../server/static/rooms/Room1.jpg";
import Room2 from "../../../server/static/rooms/Room2.jpg";
import SeatingRadius1Image2 from "../../../server/static/rooms/room-with-seating-radius-1-bg-2.jpg";
import { Landmark } from "../ui/LandmarksController";
declare var HIFI_SPACE_NAME: string;
declare var APP_MODE: string;
declare var APP_CONFIG_URL: string;

const CONFIG_JSON_VERSIONS = {
    "v1.0.0": {
        "dateAdded": "2021-04-26_09-19-00",
    },
};
enum CONFIG_ERRORS {
    "INCOMPATIBLE_VERSION" = "Incompatible version.",
    "UNSPECIFIED_ERROR" = "Unspecified error.",
    "NO_ROOMS" = "No rooms specified in Config JSON.",
    "ROOM_NO_NAME" = "A room inside the config JSON doesn't have a `name`.",
    "ROOM_NO_SEATING_CENTER" = "A room inside the config JSON doesn't have a `seatingCenter`.",
    "THEME_INVALID" = "Invalid theme name.",
};
enum CONFIG_SUCCESSES {
    "OK" = "OK.",
};
interface ConfigJSONValidity {
    valid: boolean;
    errors: Array<CONFIG_ERRORS>;
    successes: Array<CONFIG_SUCCESSES>;
};
interface ConfigJSON {
    author: string;
    configJSONVersion: string;
    comments: string;
    theme?: string;
    backgroundColorHex?: string;
    spaceName?: string;
    rooms: Array<SpatialAudioRoom>;
    landmarks: Array<Landmark>;
}

export class AppConfigController {
    configComplete: boolean = false;
    theme: UITheme = UITheme.LIGHT;
    rooms: Array<SpatialAudioRoom>;
    landmarks: Array<Landmark>;
    onConfigComplete: Array<Function>;

    constructor() {
        console.log(`HiFi Space Name is: \`${HIFI_SPACE_NAME}\``);
        this.rooms = [];
        this.landmarks = [];
        this.onConfigComplete = [];
        this.downloadConfigJSON();
    }

    async downloadConfigJSON() {
        console.log(`Downloading application configuration JSON file...`);
        let configURL = APP_MODE === "electron" ? "watchParty.json" : APP_CONFIG_URL;
        let configResponse, configJSON;
        try {
            configResponse = await fetch(configURL);
        } catch (e) {
            console.error(`Couldn't fetch config from \`${configURL}\`! Error:\n${e}\n\nInitializing default rooms...`);
            this.initializeDefaultRooms();
            return;
        }

        try {
            configJSON = await configResponse.json();
        } catch (e) {
            console.error(`Couldn't get JSON config from \`${configURL}\`! Error:\n${e}\n\nInitializing default rooms...`);
            this.initializeDefaultRooms();
            return;
        }

        this.parseConfigJSON(configJSON);

        console.log(`Application configuration complete!`);

        this.configComplete = true;
        this.onConfigComplete.forEach((func) => { func(); });
    }

    initializeDefaultRooms() {
        this.rooms.push(new SpatialAudioRoom({
            "name": "Small Room",
            "roomCenter": { "x": -4.3, "y": 0, "z": -1.055 },
            "seatingCenter": {"x": -4.397745090149535, "y": 0, "z": -1.0481428664107273},
            "dimensions": {"x": 6.59, "y": 0, "z": 7.19 },
            "numSeatsInRoom": 12,
            "seatingRadiusM": 1.2,
            "roomImageSRC": Room1
        }));
        this.rooms.push(new SpatialAudioRoom({
            "name": "Large Room",
            "roomCenter": { "x": 3.30, "y": 0, "z": 0 },
            "seatingCenter": {"x": 3.51459649122807, "y": 0, "z": 0.10519298245614023},
            "dimensions": {"x": 8.64, "y": 0, "z": 9.304 },
            "numSeatsInRoom": 20,
            "seatingRadiusM": 2.0,
            "roomImageSRC": Room2
        }));
    }
    
    parseConfigJSON(configJSON: ConfigJSON) {
        let configJSONValidity = this.validateConfigJSON(configJSON);
        if (configJSONValidity.valid) {
            if (configJSON.theme === "light") {
                this.theme = UITheme.LIGHT;
            } else if (configJSON.theme === "dark") {
                this.theme = UITheme.DARK;
            }

            if (configJSON.backgroundColorHex) {
                document.body.style.backgroundColor = configJSON.backgroundColorHex;
            }

            for (const room of configJSON.rooms) {
                this.rooms.push(new SpatialAudioRoom(room));
            }

            if (configJSON.landmarks && Array.isArray(configJSON.landmarks)) {
                for (const landmark of configJSON.landmarks) {
                    this.landmarks.push(new Landmark(landmark));
                }
            }
        } else {
            console.error(`Couldn't validate remote JSON config. Errors:\n${JSON.stringify(configJSONValidity.errors)}\n\nInitializing default rooms...`);
            this.initializeDefaultRooms();
        }
    }

    validateConfigJSON(configJSON: ConfigJSON) {
        let retval: ConfigJSONValidity = {
            "valid": true,
            "errors": [],
            "successes": [],
        };

        switch (configJSON.configJSONVersion) {
            case ("v1.0.0"):
                if (configJSON.theme && !(configJSON.theme === "light" || configJSON.theme === "dark")) {
                    retval.errors.push(CONFIG_ERRORS.THEME_INVALID);
                }

                if (!(configJSON.rooms && configJSON.rooms.length > 0)) {
                    retval.errors.push(CONFIG_ERRORS.NO_ROOMS);
                } else {
                    for (const room of configJSON.rooms) {
                        if (!room.name) {
                            retval.errors.push(CONFIG_ERRORS.ROOM_NO_NAME);
                        }
                        if (!room.seatingCenter) {
                            retval.errors.push(CONFIG_ERRORS.ROOM_NO_SEATING_CENTER);
                        }
                    }
                }
                break;
            default:
                retval.errors.push(CONFIG_ERRORS.INCOMPATIBLE_VERSION);
                break;
        }

        if (retval.errors.length > 0) {
            retval.valid = false;
        }

        if (retval.valid) {
            retval.successes.push(CONFIG_SUCCESSES.OK);
        }

        return retval;
    }
}

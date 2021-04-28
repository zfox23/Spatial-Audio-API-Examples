import { Point3D } from "hifi-spatial-audio";
import { SpatialAudioRoom } from "../ui/RoomController";
import { UITheme } from "../ui/UIThemeController";
import Room1 from "../../../server/static/rooms/Room1.jpg";
import Room2 from "../../../server/static/rooms/Room2.jpg";
import Room3 from "../../../server/static/rooms/Room3.jpg";
import Room4 from "../../../server/static/rooms/Room4.jpg";
import Room5 from "../../../server/static/rooms/Room5.jpg";
import SeatingRadius1Image2 from "../../../server/static/rooms/room-with-seating-radius-1-bg-2.jpg";
import { Landmark } from "../ui/LandmarksController";
declare var HIFI_SPACE_NAME: string;
declare var APP_MODE: string;

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
        let searchParams = new URLSearchParams(location.search);
        if (searchParams.has("config") || APP_MODE === "electron") {
            console.log(`Downloading application configuration JSON file...`);
            let configURL = APP_MODE === "electron" ? "watchParty.json" : searchParams.get("config");
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
        } else {
            console.log(`Using default application configuration...`);
            this.initializeDefaultRooms();
        }

        console.log(`Application configuration complete!`);

        this.configComplete = true;
        this.onConfigComplete.forEach((func) => { func(); });
    }

    initializeDefaultRooms() {
        this.rooms.push(new SpatialAudioRoom({
            name: "Room 1",
            roomCenter: new Point3D({ x: 0, y: 0, z: 0 }),
            seatingCenter: new Point3D({ x: 0.125, y: 0, z: 1.015 }),
            seatingRadiusM: 0.9,
            dimensions: new Point3D({x: 5.0, y: 0, z: 5.0 }),
            numSeatsInRoom: 8,
            roomImageSRC: Room1
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Room 2",
            roomCenter: new Point3D({ x: 0, y: 0, z: 4.59228515625 }),
            seatingCenter: new Point3D({ x: 0.05, y: 0, z: 4.68 }),
            dimensions: new Point3D({x: 5.0, y: 0, z: 4.1845703125 }),
            seatingRadiusM: 1.15,
            roomImageSRC: Room2
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Room 3",
            roomCenter: new Point3D({ x: -5, y: 0, z: 4.59228515625 }),
            seatingCenter: new Point3D({ x: -4.32, y: 0, z: 4.825 }),
            dimensions: new Point3D({x: 5.0, y: 0, z: 4.1845703125 }),
            numSeatsInRoom: 4,
            seatingRadiusM: 0.7,
            roomImageSRC: Room3
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Room 4",
            roomCenter: new Point3D({ x: -5, y: 0, z: 8.75828515625 }),
            seatingCenter: new Point3D({ x: -4.32, y: 0, z: 8.73 }),
            dimensions: new Point3D({x: 5.0, y: 0, z: 4.1845703125 }),
            numSeatsInRoom: 4,
            seatingRadiusM: 0.7,
            roomImageSRC: Room4
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Room 5",
            roomCenter: new Point3D({ x: 0, y: 0, z: 9.182 }),
            seatingCenter: new Point3D({x: 0.09221915190033814, z: 9.2}),
            dimensions: new Point3D({x: 5.0, y: 0, z: 5.0 }),
            seatingRadiusM: 1.7,
            roomImageSRC: Room5
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Private Room",
            seatingCenter: new Point3D({ x: 100, y: 0, z: 100 }),
            dimensions: new Point3D({x: 3.6, y: 0, z: 3.6 }),
            seatingRadiusM: 1.0,
            roomImageSRC: SeatingRadius1Image2
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

            for (const landmark of configJSON.landmarks) {
                this.landmarks.push(new Landmark(landmark));
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

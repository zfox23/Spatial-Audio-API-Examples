import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { connectionController, roomController, uiController, uiThemeController, userDataController, webSocketConnectionController } from "..";
import { AVATAR, ROOM, MISC } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";

export class SpatialAudioSeat {
    room: SpatialAudioRoom;
    position: Point3D;
    orientation: OrientationEuler3D;
    occupiedUserData?: UserData;
    seatID: string;

    constructor({ room, position, orientationEuler, seatID }: { room: SpatialAudioRoom, position: Point3D, orientationEuler: OrientationEuler3D, seatID: string }) {
        this.room = room;
        this.position = position;
        this.orientation = orientationEuler;
        this.occupiedUserData = undefined;
        this.seatID = seatID;
    }
}

class SpatialAudioRoomImage {
    image: HTMLImageElement;
    loaded: boolean;
}

export enum SpatialAudioRoomType {
    Normal,
    WatchParty
};

export class SpatialAudioRoom {
    name: string;
    seatingCenter: Point3D;
    dimensions: Point3D;
    tableRadiusM: number;
    seatingRadiusM: number;
    roomCenter: Point3D;
    initialNumSeats: number;
    seats: Array<SpatialAudioSeat>;
    tableColorHex: string;
    roomImage: SpatialAudioRoomImage;
    roomType: SpatialAudioRoomType;

    constructor({
        name,
        seatingCenter,
        seatingRadiusM,
        roomCenter,
        initialNumSeats,
        dimensions,
        roomImageSRC,
        roomType = SpatialAudioRoomType.Normal,
        }: {
            name: string,
            seatingCenter: Point3D,
            seatingRadiusM?: number,
            roomCenter?: Point3D,
            initialNumSeats?: number,
            dimensions?: Point3D,
            roomImageSRC?: string,
            roomType?: SpatialAudioRoomType
        }) {
        this.name = name;
        this.seatingCenter = seatingCenter;
        this.roomCenter = roomCenter || this.seatingCenter;

        this.roomType = roomType;

        let maxAvatarRadiusM = AVATAR.RADIUS_M * AVATAR.MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER;

        if (seatingRadiusM) {
            this.seatingRadiusM = Utilities.clamp(seatingRadiusM, 2 * maxAvatarRadiusM, 9999);
        } else {
            this.seatingRadiusM = 2 * maxAvatarRadiusM;
        }

        this.dimensions = dimensions ? dimensions : new Point3D({x: 2 * this.seatingRadiusM * 2 + maxAvatarRadiusM, y: 0, z: 2 * this.seatingRadiusM * 2 + maxAvatarRadiusM });

        let clampedX = Utilities.clamp(this.dimensions.x, 2 * this.seatingRadiusM + 2 * maxAvatarRadiusM, 9999);
        if (clampedX !== this.dimensions.x) {
            console.warn(`Clamped X dimension of room \`${this.name}\` from ${this.dimensions.x} to ${clampedX}m.`);
            this.dimensions.x = clampedX;
        }
        let clampedZ = Utilities.clamp(this.dimensions.z, 2 * this.seatingRadiusM + 2 * maxAvatarRadiusM, 9999);
        if (clampedZ !== this.dimensions.z) {
            console.warn(`Clamped Z dimension of room \`${this.name}\` from ${this.dimensions.z} to ${clampedZ}m.`);
            this.dimensions.z = clampedZ;
        }

        this.tableRadiusM = this.seatingRadiusM - maxAvatarRadiusM;
        
        if (initialNumSeats) {
            this.initialNumSeats = initialNumSeats;
        } else if (!initialNumSeats && roomType === SpatialAudioRoomType.Normal) {
            this.initialNumSeats = Math.ceil(((Math.PI * this.seatingRadiusM * this.seatingRadiusM) / (2.5 * AVATAR.RADIUS_M)));
        } else if (!initialNumSeats && roomType === SpatialAudioRoomType.WatchParty) {
            this.initialNumSeats = Math.ceil(((Math.PI * this.seatingRadiusM * this.seatingRadiusM) / (2.5 * AVATAR.RADIUS_M))) / 2;
        }
        
        this.seats = [];
        this.generateInitialSeats();

        this.tableColorHex = Utilities.hexColorFromString(this.name);

        if (roomImageSRC) {
            this.roomImage = new SpatialAudioRoomImage();
            this.roomImage.loaded = false;
            this.roomImage.image = new Image();
            this.roomImage.image.onload = () => {
                console.log(`Room image for room ${this.name} has loaded.`);
                this.roomImage.loaded = true;
            }
            this.roomImage.image.src = roomImageSRC;
        }
    }
    
    generateInitialSeats() {
        let thetaMax;
        if (this.roomType === SpatialAudioRoomType.Normal) {
            thetaMax = 2 * Math.PI;
        } else if (this.roomType === SpatialAudioRoomType.WatchParty) {
            thetaMax = Math.PI;
        }

        for (let theta = 0; theta <= thetaMax; theta += (thetaMax / (this.initialNumSeats - 1))) {
            let currentPotentialPosition = new Point3D({
                "x": this.seatingRadiusM * Math.cos(theta) + this.seatingCenter.x,
                "z": this.seatingRadiusM * Math.sin(theta) + this.seatingCenter.z
            });

            currentPotentialPosition.x = Math.round((currentPotentialPosition.x + Number.EPSILON) * 100) / 100;
            currentPotentialPosition.z = Math.round((currentPotentialPosition.z + Number.EPSILON) * 100) / 100;

            let orientationYawRadians = Math.atan2(currentPotentialPosition.x - this.seatingCenter.x, currentPotentialPosition.z - this.seatingCenter.z);
            let orientationYawDegrees = orientationYawRadians * 180 / Math.PI;
            orientationYawDegrees %= 360;
            orientationYawDegrees = Math.round((orientationYawDegrees + Number.EPSILON) * 100) / 100;

            let newSeat = new SpatialAudioSeat({
                room: this,
                position: currentPotentialPosition,
                orientationEuler: new OrientationEuler3D({yawDegrees: orientationYawDegrees}),
                seatID: `${this.name}${theta.toFixed(2)}`
            });

            this.seats.push(newSeat);
        }
    }

    getFirstOpenSeat() {
        for (let i = 0; i < this.seats.length; i++) {
            if (!this.seats[i].occupiedUserData) {
                return this.seats[i];
            }
        }

        console.warn(`Couldn't get first open seat in room named \`${this.name}\`!`);
        return;
    }
}

interface ConfigJSON {
    author: string;
    configJSONVersion: string;
    comments: string;
    rooms: Array<SpatialAudioRoom>;
}
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
};
enum CONFIG_SUCCESSES {
    "OK" = "OK.",
};
interface ConfigJSONValidity {
    valid: boolean;
    errors: Array<CONFIG_ERRORS>;
    successes: Array<CONFIG_SUCCESSES>;
};
class ConfigJSONParser {
    static parseConfigJSON(configJSON: ConfigJSON) {
        let configJSONValidity = ConfigJSONParser.validateConfigJSON(configJSON);
        if (configJSONValidity.valid) {
            for (const room of configJSON.rooms) {
                roomController.rooms.push(new SpatialAudioRoom(room));
            }
        } else {
            console.error(`Couldn't validate remote JSON config. Errors:\n${JSON.stringify(configJSONValidity.errors)}\n\nInitializing default rooms...`);
            roomController.initializeDefaultRooms();
        }
    }

    static validateConfigJSON(configJSON: ConfigJSON) {
        let retval: ConfigJSONValidity = {
            "valid": true,
            "errors": [],
            "successes": [],
        };

        switch (configJSON.configJSONVersion) {
            case ("v1.0.0"):
                if (!(configJSON.rooms && configJSON.rooms.length > 0)) {
                    retval.errors.push(CONFIG_ERRORS.NO_ROOMS);
                    retval.valid = false;
                } else {
                    for (const room of configJSON.rooms) {
                        if (!room.name) {
                            retval.errors.push(CONFIG_ERRORS.ROOM_NO_NAME);
                            retval.valid = false;
                        }
                        if (!room.seatingCenter) {
                            retval.valid = false;
                            retval.errors.push(CONFIG_ERRORS.ROOM_NO_SEATING_CENTER);
                        }
                    }
                }
                break;
            default:
                retval.errors.push(CONFIG_ERRORS.INCOMPATIBLE_VERSION);
                retval.valid = false;
                break;
        }

        if (retval.valid) {
            retval.successes.push(CONFIG_SUCCESSES.OK);
        }

        return retval;
    }
}

import Room1 from "../../images/rooms/Room1.jpg";
import Room2 from "../../images/rooms/Room2.jpg";
import Room3 from "../../images/rooms/Room3.jpg";
import Room4 from "../../images/rooms/Room4.jpg";
import Room5 from "../../images/rooms/Room5.jpg";
import SeatingRadius1Image2 from "../../images/rooms/room-with-seating-radius-1-bg-2.jpg";
import WatchPartyImage from "../../images/rooms/watchparty.png";
export class RoomController {
    roomsInitialized: boolean = false;
    rooms: Array<SpatialAudioRoom>;
    showRoomListButton: HTMLButtonElement;
    roomListOuterContainer: HTMLDivElement;
    roomListInnerContainer: HTMLDivElement;
    currentlyHoveringOverVisitIDHash: string;

    constructor() {
        this.rooms = [];

        this.showRoomListButton = document.createElement("button");
        this.showRoomListButton.classList.add("showRoomListButton");
        document.body.appendChild(this.showRoomListButton);
        this.showRoomListButton.addEventListener("click", this.toggleRoomList.bind(this));

        this.roomListOuterContainer = document.createElement("div");
        this.roomListOuterContainer.classList.add("roomListOuterContainer", "displayNone");
        document.body.appendChild(this.roomListOuterContainer);

        this.roomListInnerContainer = document.createElement("div");
        this.roomListInnerContainer.classList.add("roomListInnerContainer");
        this.roomListOuterContainer.appendChild(this.roomListInnerContainer);
    }

    initializeDefaultRooms() {
        this.rooms.push(new SpatialAudioRoom({
            name: "Room 1",
            roomCenter: new Point3D({ x: 0, y: 0, z: 0 }),
            seatingCenter: new Point3D({ x: 0.125, y: 0, z: 1.015 }),
            seatingRadiusM: 0.9,
            dimensions: new Point3D({x: 5.0, y: 0, z: 5.0 }),
            initialNumSeats: 8,
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
            initialNumSeats: 4,
            seatingRadiusM: 0.7,
            roomImageSRC: Room3
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Room 4",
            roomCenter: new Point3D({ x: -5, y: 0, z: 8.75828515625 }),
            seatingCenter: new Point3D({ x: -4.32, y: 0, z: 8.73 }),
            dimensions: new Point3D({x: 5.0, y: 0, z: 4.1845703125 }),
            initialNumSeats: 4,
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
        this.rooms.push(new SpatialAudioRoom({
            name: "Watch Party",
            roomCenter: new Point3D({ x: 0, y: 0, z: 13.482 }),
            seatingCenter: new Point3D({ x: 0.15, y: 0, z: 12.2 }),
            dimensions: new Point3D({x: 8.098, y: 0, z: 3.6 }),
            seatingRadiusM: 1.85,
            roomImageSRC: WatchPartyImage,
            roomType: SpatialAudioRoomType.WatchParty,
            initialNumSeats: 7,
        }));
    }

    async initializeRooms() {
        let searchParams = new URLSearchParams(location.search);
        if (searchParams.has("config")) {
            let configURL = searchParams.get("config");
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

            ConfigJSONParser.parseConfigJSON(configJSON);
        } else {
            this.initializeDefaultRooms();
        }

        this.roomsInitialized = true;

        if (connectionController.receivedInitialOtherUserDataFromHiFi && webSocketConnectionController.retrievedInitialWebSocketServerData) {
            userDataController.myAvatar.positionSelfInRoom(this.getStartingRoomName());
        }
    }

    getStartingRoomName() {
        let startingRoomName = this.rooms[0].name;

        let searchParams = new URLSearchParams(location.search);
        if (searchParams.has("room")) {
            let searchParamsRoomName = searchParams.get("room");
            let searchParamsRoom = this.rooms.find((room) => { return room.name.toLowerCase() === searchParamsRoomName.toLowerCase(); });
            if (searchParamsRoom) {
                startingRoomName = searchParamsRoom.name;
            } else {
                console.warn(`Couldn't position self in room named \`${searchParamsRoomName}\`! Positioning self in \`${startingRoomName}\`...`);
            }
        }

        return startingRoomName;
    }

    hideRoomList() {
        this.roomListOuterContainer.classList.add("displayNone");
    }

    toggleRoomList() {
        this.roomListOuterContainer.classList.toggle("displayNone");
    }

    getRoomFromPoint3DOnCircle(point3D: Point3D): SpatialAudioRoom {
        if (!point3D) {
            return undefined;
        }

        return this.rooms.find((room) => {
            return Math.abs(Utilities.getDistanceBetween2DPoints(point3D.x, point3D.z, room.seatingCenter.x, room.seatingCenter.z) - room.seatingRadiusM) <= MISC.CLOSE_ENOUGH_M;
        });
    }

    getRoomFromPoint3DInsideBoundaries(point3D: Point3D): SpatialAudioRoom {
        if (!point3D) {
            return undefined;
        }

        let minDistance = 99999;
        let targetRoom;
        for (let i = 0; i < this.rooms.length; i++) {
            let room = this.rooms[i];
            let distanceFromCenterOfRoom = Utilities.pointIsWithinRectangle({
                point: point3D,
                rectCenter: room.roomCenter,
                rectDimensions: room.dimensions
            });

            if (distanceFromCenterOfRoom && distanceFromCenterOfRoom < minDistance) {
                minDistance = distanceFromCenterOfRoom;
                targetRoom = room;
            }
        }

        return targetRoom;
    }

    getRoomFromName(roomName: string) {
        if (!roomName) {
            return undefined;
        }

        return this.rooms.find((room) => {
            return room.name === roomName;
        });
    }

    getSeatFromSeatID(seatID: string) {
        if (!seatID || seatID.length === 0) {
            return undefined;
        }

        let allSeats: Array<SpatialAudioSeat> = [];
        
        this.rooms.forEach((room) => { allSeats = allSeats.concat(room.seats); });

        let seat = allSeats.find((seat) => {
            return seat.seatID === seatID;
        });

        if (!seat) {
            console.warn(`Couldn't get \`SpatialAudioSeat\` from Seat ID \`${seatID}\`!`);
        }

        return seat;
    }

    updateRoomList() {
        this.roomListInnerContainer.innerHTML = ``;

        let roomListInnerContainer__header = document.createElement("h1");
        roomListInnerContainer__header.classList.add("roomListInnerContainer__header");
        uiThemeController.refreshThemedElements();
        roomListInnerContainer__header.innerHTML = `Rooms`;
        this.roomListInnerContainer.appendChild(roomListInnerContainer__header);

        this.rooms.forEach((room) => {
            let roomInfoContainer = document.createElement("div");
            roomInfoContainer.classList.add("roomInfoContainer");
            if (userDataController.myAvatar.myUserData.currentRoom === room) {
                roomInfoContainer.classList.add("roomInfoContainer--mine");
            }
            this.roomListInnerContainer.appendChild(roomInfoContainer);

            let roomInfoContainer__header = document.createElement("h2");
            roomInfoContainer__header.classList.add("roomInfoContainer__header");
            let occupiedSeats = room.seats.filter((seat) => { return !!seat.occupiedUserData; });
            roomInfoContainer__header.innerHTML = `${room.name} (${occupiedSeats.length}/${room.initialNumSeats})`;
            roomInfoContainer__header.addEventListener("click", (e) => {
                if (userDataController.myAvatar.myUserData.currentRoom === room) {
                    console.log(`User is already in room \`${room.name}\`!`);
                    return;
                }
                userDataController.myAvatar.positionSelfInRoom(room.name);
            });
            roomInfoContainer.appendChild(roomInfoContainer__header);

            let roomInfoContainer__occupantsList = document.createElement("div");
            roomInfoContainer__occupantsList.classList.add("roomInfoContainer__occupantsList");
            roomInfoContainer__occupantsList.setAttribute("data-room-name", room.name);
            roomInfoContainer.appendChild(roomInfoContainer__occupantsList);
        });

        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        allUserData.forEach((userData) => {
            if (userData.currentRoom) {
                let roomInfoContainer__occupant = document.createElement("p");
                roomInfoContainer__occupant.classList.add("roomInfoContainer__occupant");
                roomInfoContainer__occupant.setAttribute('data-visit-id-hash', userData.visitIDHash);
                let occupantInnerHTML;
                if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                    occupantInnerHTML = `<span class="roomInfoContainer__occupantColorChip" style="background-color:${userDataController.myAvatar.myUserData.colorHex}"></span>`;
                    occupantInnerHTML += `(you) ${userData.displayName}`;
                    document.querySelector(`[data-room-name="${userData.currentRoom.name}"]`).prepend(roomInfoContainer__occupant);
                } else {
                    occupantInnerHTML = ``;
                    if (userData.colorHex) {
                        occupantInnerHTML += `<span class="roomInfoContainer__occupantColorChip" style="background-color:${userData.colorHex}"></span>`;
                    }
                    occupantInnerHTML += userData.displayName && userData.displayName.length > 0 ? userData.displayName : userData.providedUserID;
                    document.querySelector(`[data-room-name="${userData.currentRoom.name}"]`).appendChild(roomInfoContainer__occupant);
                }
                roomInfoContainer__occupant.innerHTML = occupantInnerHTML;

                roomInfoContainer__occupant.addEventListener("click", (e) => {
                    uiController.showAvatarContextMenu(userData);
                });
                roomInfoContainer__occupant.addEventListener("mouseenter", (e) => {
                    this.currentlyHoveringOverVisitIDHash = userData.visitIDHash;
                });
                roomInfoContainer__occupant.addEventListener("mouseleave", (e) => {
                    this.currentlyHoveringOverVisitIDHash = undefined;
                });
            }
        });
        
        uiThemeController.refreshThemedElements();
    }
}
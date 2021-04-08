import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { uiController, userDataController } from "..";
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

export class SpatialAudioRoom {
    name: string;
    center: Point3D;
    dimensions: Point3D;
    tableRadiusM: number;
    seatingRadiusM: number;
    initialNumSeats: number;
    seats: Array<SpatialAudioSeat>;
    tableColorHex: string;
    roomImage: SpatialAudioRoomImage;

    constructor({
        name,
        center,
        seatingRadiusM,
        initialNumSeats,
        dimensions,
        roomImageSRC
        }: {
            name: string,
            center: Point3D,
            seatingRadiusM?: number,
            initialNumSeats?: number,
            dimensions?: Point3D,
            roomImageSRC?: string
        }) {
        this.name = name;
        this.center = center;

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
        
        this.initialNumSeats = initialNumSeats || Math.ceil(((Math.PI * this.seatingRadiusM * this.seatingRadiusM) / (3 * AVATAR.RADIUS_M)));
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
        for (let theta = 0; theta < 2 * Math.PI; theta += ((2 * Math.PI) / this.initialNumSeats)) {
            let currentPotentialPosition = new Point3D({
                "x": this.seatingRadiusM * Math.cos(theta) + this.center.x,
                "z": this.seatingRadiusM * Math.sin(theta) + this.center.z
            });

            currentPotentialPosition.x = Math.round((currentPotentialPosition.x + Number.EPSILON) * 100) / 100;
            currentPotentialPosition.z = Math.round((currentPotentialPosition.z + Number.EPSILON) * 100) / 100;

            let orientationYawRadians = Math.atan2(currentPotentialPosition.x - this.center.x, currentPotentialPosition.z - this.center.z);
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

        console.warn(`Couldn't get first open seat!`);
        return;
    }
}

import SeatingRadius1Image1 from "../../images/rooms/room-with-seating-radius-1-bg-1.jpg";
import SeatingRadius1Image2 from "../../images/rooms/room-with-seating-radius-1-bg-2.jpg";
import SeatingRadius1Image3 from "../../images/rooms/room-with-seating-radius-1-bg-3.jpg";
// import SeatingRadius1Image4 from "../../images/rooms/room-with-seating-radius-1-bg-4.jpg";
import SeatingRadius1Image5 from "../../images/rooms/room-with-seating-radius-1-bg-5.jpg";
import SeatingRadius3Image1 from "../../images/rooms/room-with-seating-radius-3-bg-1.jpg";
import SeatingRadius10cmImage1 from "../../images/rooms/room-with-seating-radius-10cm-bg-1.jpg"
export class RoomController {
    lobby: SpatialAudioRoom;
    rooms: Array<SpatialAudioRoom>;
    showRoomListButton: HTMLButtonElement;
    roomListOuterContainer: HTMLDivElement;
    roomListInnerContainer: HTMLDivElement;
    currentlyHoveringOverVisitIDHash: string;

    constructor() {
        this.rooms = [];
        
        this.lobby = new SpatialAudioRoom({
            name: "Room 1",
            center: new Point3D({ x: 1, y: 0, z: 0 }),
            seatingRadiusM: 0.9,
            dimensions: new Point3D({x: 5.15, y: 0, z: 5.15 }),
            initialNumSeats: 8,
            roomImageSRC: SeatingRadius1Image1
        });
        this.rooms.push(this.lobby);
        this.rooms.push(new SpatialAudioRoom({
            name: "Room 2",
            center: new Point3D({ x: 5.0, y: 0, z: 5.0 }),
            dimensions: new Point3D({x: 5.15, y: 0, z: 5.15 }),
            seatingRadiusM: 0.9,
            roomImageSRC: SeatingRadius1Image5
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Room 3",
            center: new Point3D({ x: -5, y: 0, z: 5 }),
            seatingRadiusM: 1.0,
            roomImageSRC: SeatingRadius1Image3
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Small Room",
            center: new Point3D({ x: 0, y: 0, z: 3.5 }),
            seatingRadiusM: 0.1,
            roomImageSRC: SeatingRadius10cmImage1
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Large Room",
            center: new Point3D({ x: 0, y: 0, z: -8 }),
            dimensions: new Point3D({x: 5.72, y: 0, z: 5.72 }),
            seatingRadiusM: 2.5,
            roomImageSRC: SeatingRadius3Image1
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Private Room",
            center: new Point3D({ x: 100, y: 0, z: 100 }),
            dimensions: new Point3D({x: 3.6, y: 0, z: 3.6 }),
            seatingRadiusM: 1.0,
            roomImageSRC: SeatingRadius1Image2
        }));

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

    getStartingRoomName() {
        let startingRoomName = this.lobby.name;

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
            return Math.abs(Utilities.getDistanceBetween2DPoints(point3D.x, point3D.z, room.center.x, room.center.z) - room.seatingRadiusM) <= MISC.CLOSE_ENOUGH_M;
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
                rectCenter: room.center,
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
                    occupantInnerHTML += userData.displayName && userData.displayName.length > 0 ? userData.displayName : "❓ Anonymous";
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
    }
}
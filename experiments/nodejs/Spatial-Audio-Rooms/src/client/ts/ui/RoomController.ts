import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { uiController, userDataController } from "..";
import { AVATAR_RADIUS_M, CLOSE_ENOUGH_M, MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER, NUM_SEATS_IN_EMPTY_ROOM } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";

export class Seat {
    position: Point3D;
    orientation: OrientationEuler3D;
    occupiedUserData?: UserData;

    constructor({ position, orientationEuler, occupiedUserData }: { position: Point3D, orientationEuler: OrientationEuler3D, occupiedUserData?: UserData }) {
        this.position = position;
        this.orientation = orientationEuler;
        this.occupiedUserData = occupiedUserData;
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
    seats: Array<Seat>;
    tableColorHex: string;
    roomImage: SpatialAudioRoomImage;

    constructor({
        name,
        center,
        seatingRadiusM,
        dimensions,
        roomImageSRC
        }: {
            name: string,
            center: Point3D,
            seatingRadiusM?: number,
            dimensions?: Point3D,
            roomImageSRC?: string
        }) {
        this.name = name;
        this.center = center;

        let maxAvatarRadiusM = AVATAR_RADIUS_M * MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER;

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

        this.seats = [];
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

    findOpenSpotForSelf() {
        let foundOpenSpot = false;
        let numSeatsInRoom = 1;
        let positionsChecked = Array<Point3D>();
        while (!foundOpenSpot) {
            for (let theta = 0; theta < 2 * Math.PI; theta += ((2 * Math.PI) / numSeatsInRoom)) {
                let currentPotentialPosition = {
                    "x": this.seatingRadiusM * Math.cos(theta) + this.center.x,
                    "y": 0,
                    "z": this.seatingRadiusM * Math.sin(theta) + this.center.z
                };

                currentPotentialPosition.x = Math.round((currentPotentialPosition.x + Number.EPSILON) * 100) / 100;
                currentPotentialPosition.z = Math.round((currentPotentialPosition.z + Number.EPSILON) * 100) / 100;

                if (positionsChecked.find((position) => { return currentPotentialPosition.x === position.x && currentPotentialPosition.z === position.z; })) {
                    continue;
                }

                let roomUserData = this.seats.map((seat) => {
                    if (seat.occupiedUserData) {
                        return seat.occupiedUserData;
                    }
                });

                let occupied = !!roomUserData.find((element) => { return element && element.position && Math.abs(element.position.x - currentPotentialPosition.x) < CLOSE_ENOUGH_M && Math.abs(element.position.z - currentPotentialPosition.z) < CLOSE_ENOUGH_M; });

                if (!occupied) {
                    let orientationYawRadians = Math.atan2(currentPotentialPosition.x - this.center.x, currentPotentialPosition.z - this.center.z);
                    let orientationYawDegrees = orientationYawRadians * 180 / Math.PI;
                    orientationYawDegrees %= 360;
                    let computedYawOrientationDegrees = Math.round((orientationYawDegrees + Number.EPSILON) * 100) / 100;
                    foundOpenSpot = true;
                    return new Seat({
                        position: currentPotentialPosition,
                        orientationEuler: new OrientationEuler3D({ yawDegrees: computedYawOrientationDegrees }),
                        occupiedUserData: userDataController.myAvatar.myUserData
                    });
                } else {
                    positionsChecked.push(currentPotentialPosition);
                }
            }

            numSeatsInRoom *= 2;
        }
    }
}

import SeatingRadius1Image1 from "../../images/rooms/room-with-seating-radius-1-bg-1.jpg";
import SeatingRadius1Image2 from "../../images/rooms/room-with-seating-radius-1-bg-2.jpg";
import SeatingRadius1Image3 from "../../images/rooms/room-with-seating-radius-1-bg-3.jpg";
import SeatingRadius1Image4 from "../../images/rooms/room-with-seating-radius-1-bg-4.jpg";
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
            name: "Lobby",
            center: new Point3D({ x: 1, y: 0, z: 0 }),
            seatingRadiusM: 1.0,
            dimensions: new Point3D({x: 5.15, y: 0, z: 5.15 }),
            roomImageSRC: SeatingRadius1Image1
        });
        this.rooms.push(this.lobby);
        this.rooms.push(new SpatialAudioRoom({
            name: "Battery",
            center: new Point3D({ x: 4.5, y: 0, z: 4.5 }),
            seatingRadiusM: 1.0,
            roomImageSRC: SeatingRadius1Image2
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Folsom",
            center: new Point3D({ x: -5, y: 0, z: 5 }),
            seatingRadiusM: 1.0,
            roomImageSRC: SeatingRadius1Image3
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "Tiny",
            center: new Point3D({ x: 0, y: 0, z: 3.5 }),
            seatingRadiusM: 0.1,
            roomImageSRC: SeatingRadius10cmImage1
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "HUGE",
            center: new Point3D({ x: 0, y: 0, z: -8 }),
            dimensions: new Point3D({x: 6.72, y: 0, z: 6.72 }),
            seatingRadiusM: 3.0,
            roomImageSRC: SeatingRadius3Image1
        }));
        this.rooms.push(new SpatialAudioRoom({
            name: "very far",
            center: new Point3D({ x: 100, y: 0, z: 100 }),
            dimensions: new Point3D({x: 3.6, y: 0, z: 3.6 }),
            seatingRadiusM: 1.0,
            roomImageSRC: SeatingRadius1Image4
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
            return Math.abs(Utilities.getDistanceBetween2DPoints(point3D.x, point3D.z, room.center.x, room.center.z) - room.seatingRadiusM) <= CLOSE_ENOUGH_M;
        });
    }

    getRoomFromPoint3DInsideBoundaries(point3D: Point3D): SpatialAudioRoom {
        if (!point3D) {
            return undefined;
        }

        let minDistance = 99999;
        let currentRoom;
        for (let i = 0; i < this.rooms.length; i++) {
            let room = this.rooms[i];
            let distanceFromCenterOfRoom = Utilities.pointIsWithinRectangle({
                point: point3D,
                rectCenter: room.center,
                rectDimensions: room.dimensions
            });

            if (distanceFromCenterOfRoom && distanceFromCenterOfRoom < minDistance) {
                minDistance = distanceFromCenterOfRoom;
                currentRoom = room;
            }
        }

        return currentRoom;
    }

    getRoomFromName(roomName: string) {
        if (!roomName) {
            return undefined;
        }

        return this.rooms.find((room) => {
            return room.name === roomName;
        });
    }

    generateOccupiedSeats(allUserData: Array<UserData>) {
        allUserData.forEach((userData) => {
            if (!userData.position) {
                return;
            }

            let userIsSittingInSeatInRoom = this.getRoomFromPoint3DOnCircle(userData.position);
            let userIsInRoomBoundaries = this.getRoomFromPoint3DInsideBoundaries(userData.position);

            // If the current user isn't sitting inside any room, return early.
            if (!userIsInRoomBoundaries) {
                return;
            }
            
            // Set the current user's current room name.
            userData.currentRoomName = userIsInRoomBoundaries.name;

            // If the current user isn't sitting inside a seat around the table
            // in the current room, return early.
            if (!userIsSittingInSeatInRoom) {
                return;
            }

            // If we get here, we know the user is sitting on a seat in the room,
            // and we want to update the `seats` array inside that room locally.
            userIsSittingInSeatInRoom.seats.push(new Seat({
                position: userData.position,
                orientationEuler: userData.orientationEuler,
                occupiedUserData: userData
            }));
        });
    }

    generateInBetweenSeats() {
        this.rooms.forEach((room) => {
            let roomSeatAnglesOnSeatingCircle: Array<number> = [];

            for (let i = 0; i < room.seats.length; i++) {
                let seat = room.seats[i];

                // Shouldn't be necessary, since we haven't added any unoccupied seats yet, but just in case...
                if (!seat.occupiedUserData) {
                    continue;
                }

                let seatAngleOnSeatingCircle = Math.atan2(seat.position.z - room.center.z, seat.position.x - room.center.x);
                while (seatAngleOnSeatingCircle < 0) {
                    seatAngleOnSeatingCircle += 2 * Math.PI;
                }
                seatAngleOnSeatingCircle %= 2 * Math.PI;
                roomSeatAnglesOnSeatingCircle.push(seatAngleOnSeatingCircle);
            }

            roomSeatAnglesOnSeatingCircle.sort((a, b) => {
                return a - b;
            });

            for (let i = 0; i < roomSeatAnglesOnSeatingCircle.length; i++) {
                let newSeatTheta;
                let angle1, angle2;
                if (i === roomSeatAnglesOnSeatingCircle.length - 1) {
                    angle1 = roomSeatAnglesOnSeatingCircle[i];
                    angle2 = roomSeatAnglesOnSeatingCircle.length > 1 ? roomSeatAnglesOnSeatingCircle[0] : roomSeatAnglesOnSeatingCircle[0] + 2 * Math.PI;
                } else {
                    angle1 = roomSeatAnglesOnSeatingCircle[i];
                    angle2 = roomSeatAnglesOnSeatingCircle[i + 1];
                }

                while (angle2 < angle1) {
                    angle2 += 2 * Math.PI;
                }

                newSeatTheta = (angle1 + angle2) / 2;
                while (newSeatTheta < 0) {
                    newSeatTheta += 2 * Math.PI;
                }
                newSeatTheta %= 2 * Math.PI;

                let newSeatPosition = new Point3D({
                    "x": room.seatingRadiusM * Math.cos(newSeatTheta) + room.center.x,
                    "y": 0,
                    "z": room.seatingRadiusM * Math.sin(newSeatTheta) + room.center.z
                });

                newSeatPosition.x = Math.round((newSeatPosition.x + Number.EPSILON) * 100) / 100;
                newSeatPosition.z = Math.round((newSeatPosition.z + Number.EPSILON) * 100) / 100;

                let newSeatOrientationYawRadians = Math.atan2(newSeatPosition.x - room.center.x, newSeatPosition.z - room.center.z);
                let newSeatOrientationYawDegrees = newSeatOrientationYawRadians * 180 / Math.PI;
                newSeatOrientationYawDegrees %= 360;
                newSeatOrientationYawDegrees = Math.round((newSeatOrientationYawDegrees + Number.EPSILON) * 100) / 100;

                let newSeat = new Seat({
                    position: newSeatPosition,
                    orientationEuler: new OrientationEuler3D({ yawDegrees: newSeatOrientationYawDegrees })
                })
                room.seats.push(newSeat);
            }
        });
    }

    maybeGenerateVacantSeats() {
        this.rooms.forEach((room) => {
            if (room.seats.length === 0) {
                for (let theta = 0; theta < 2 * Math.PI; theta += ((2 * Math.PI) / NUM_SEATS_IN_EMPTY_ROOM)) {
                    let currentPotentialPosition = {
                        "x": room.seatingRadiusM * Math.cos(theta) + room.center.x,
                        "y": 0,
                        "z": room.seatingRadiusM * Math.sin(theta) + room.center.z
                    };

                    currentPotentialPosition.x = Math.round((currentPotentialPosition.x + Number.EPSILON) * 100) / 100;
                    currentPotentialPosition.z = Math.round((currentPotentialPosition.z + Number.EPSILON) * 100) / 100;

                    let orientationYawRadians = Math.atan2(currentPotentialPosition.x - room.center.x, currentPotentialPosition.z - room.center.z);
                    let orientationYawDegrees = orientationYawRadians * 180 / Math.PI;
                    orientationYawDegrees %= 360;
                    let computedYawOrientationDegrees = Math.round((orientationYawDegrees + Number.EPSILON) * 100) / 100;

                    let newSeat = new Seat({
                        position: currentPotentialPosition,
                        orientationEuler: new OrientationEuler3D({yawDegrees: computedYawOrientationDegrees})
                    });

                    room.seats.push(newSeat);
                }
            }
        });
    }

    updateAllRoomSeats() {
        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);

        this.rooms.forEach((room) => {
            room.seats = [];
        });

        this.generateOccupiedSeats(allUserData);
        this.generateInBetweenSeats();
        this.maybeGenerateVacantSeats();
        this.updateRoomList();
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
            if (userDataController.myAvatar.myUserData.currentRoomName === room.name) {
                roomInfoContainer.classList.add("roomInfoContainer--mine");
            }
            this.roomListInnerContainer.appendChild(roomInfoContainer);

            let roomInfoContainer__header = document.createElement("h2");
            roomInfoContainer__header.classList.add("roomInfoContainer__header");
            let occupiedSeats = room.seats.filter((seat) => { return !!seat.occupiedUserData; });
            roomInfoContainer__header.innerHTML = `${room.name} (${occupiedSeats.length})`;
            roomInfoContainer__header.addEventListener("click", (e) => {
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
            if (userData.currentRoomName) {
                let roomInfoContainer__occupant = document.createElement("p");
                roomInfoContainer__occupant.classList.add("roomInfoContainer__occupant");
                roomInfoContainer__occupant.setAttribute('data-visit-id-hash', userData.visitIDHash);
                if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                    roomInfoContainer__occupant.innerHTML = `(you) ${userData.displayName}`;
                    document.querySelector(`[data-room-name="${userData.currentRoomName}"]`).prepend(roomInfoContainer__occupant);
                } else {
                    roomInfoContainer__occupant.innerHTML = userData.displayName && userData.displayName.length > 0 ? userData.displayName : "❓ Anonymous";
                    document.querySelector(`[data-room-name="${userData.currentRoomName}"]`).appendChild(roomInfoContainer__occupant);
                }

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
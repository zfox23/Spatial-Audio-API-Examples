import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { userDataController } from "..";
import { CLOSE_ENOUGH_M, ROOM_SEATING_RADIUS_M, VIRTUAL_ROOM_DIMENSIONS_PER_SIDE_M } from "../constants/constants";
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

class Room {
    name: string;
    center: Point3D;
    dimensions: Point3D;
    seatingRadius: number;
    seats: Array<Seat>;

    constructor({ name, center }: { name: string, center: Point3D }) {
        this.name = name;
        this.center = center;
        this.dimensions = new Point3D({ x: VIRTUAL_ROOM_DIMENSIONS_PER_SIDE_M, y: 0, z: VIRTUAL_ROOM_DIMENSIONS_PER_SIDE_M });
        this.seatingRadius = ROOM_SEATING_RADIUS_M;
        this.seats = [];
    }

    findOpenSpotForSelf() {
        let foundOpenSpot = false;
        let numSeatsInRoom = 1;
        let positionsChecked = Array<Point3D>();
        while (!foundOpenSpot) {
            for (let theta = 0; theta < 2 * Math.PI; theta += ((2 * Math.PI) / numSeatsInRoom)) {
                let currentPotentialPosition = {
                    "x": this.seatingRadius * Math.cos(theta) + this.center.x,
                    "y": 0,
                    "z": this.seatingRadius * Math.sin(theta) + this.center.z
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

export class RoomController {
    lobby: Room;
    rooms: Array<Room>;
    showRoomListButton: HTMLButtonElement;
    roomListOuterContainer: HTMLDivElement;
    roomListInnerContainer: HTMLDivElement;

    constructor() {
        this.lobby = new Room({ name: "Lobby", center: new Point3D({ x: 0, y: 0, z: 0 }) });

        this.rooms = [];
        this.rooms.push(this.lobby);

        this.rooms.push(new Room({ name: "Battery", center: new Point3D({ x: 15, y: 0, z: 15 }) }));
        this.rooms.push(new Room({ name: "Folsom", center: new Point3D({ x: -15, y: 0, z: 15 }) }));

        this.showRoomListButton = document.createElement("button");
        this.showRoomListButton.classList.add("showRoomListButton");
        document.body.appendChild(this.showRoomListButton);
        this.showRoomListButton.addEventListener("click", this.toggleRoomList.bind(this));

        this.roomListOuterContainer = document.createElement("div");
        this.roomListOuterContainer.classList.add("roomListOuterContainer", "displayNone");
        document.body.appendChild(this.roomListOuterContainer);
        this.roomListOuterContainer.addEventListener("click", this.toggleRoomList.bind(this));

        this.roomListInnerContainer = document.createElement("div");
        this.roomListInnerContainer.classList.add("roomListInnerContainer");
        this.roomListInnerContainer.addEventListener("click", (e) => { e.stopPropagation(); });
        this.roomListOuterContainer.appendChild(this.roomListInnerContainer);
    }

    toggleRoomList() {
        this.roomListOuterContainer.classList.toggle("displayNone");
    }

    getRoomFromPoint3D(point3D: Point3D): Room {
        if (!point3D) {
            return undefined;
        }

        return this.rooms.find((room) => {
            return Utilities.pointIsWithinRectangle({
                point: point3D,
                rectCenter: room.center,
                rectDimensions: room.dimensions
            });
        });
    }

    getRoomFromName(roomName: string) {
        if (!roomName) {
            return undefined;
        }

        return this.rooms.find((room) => {
            return room.name === roomName;
        });
    }

    updateAllRoomSeats() {
        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);

        this.rooms.forEach((room) => {
            room.seats = [];
        });

        allUserData.forEach((userData) => {
            if (!userData.position) {
                return;
            }

            let userRoom = this.getRoomFromPoint3D(userData.position);

            if (!userRoom) {
                return;
            }

            // If the user is coming in from, say, Space Inspector, don't add a seat for that user.
            if (Math.abs(Utilities.getDistanceBetween2DPoints(userData.position.x, userData.position.z, userRoom.center.x, userRoom.center.z) - userRoom.seatingRadius) > CLOSE_ENOUGH_M) {
                return;
            }

            userRoom.seats.push(new Seat({
                position: userData.position,
                orientationEuler: userData.orientationEuler,
                occupiedUserData: userData
            }));
        });

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
                    "x": room.seatingRadius * Math.cos(newSeatTheta) + room.center.x,
                    "y": 0,
                    "z": room.seatingRadius * Math.sin(newSeatTheta) + room.center.z
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

        this.updateRoomList();
    }

    updateRoomList() {
        this.roomListInnerContainer.innerHTML = ``;

        this.rooms.forEach((room) => {
            let roomInfoContainer = document.createElement("div");
            roomInfoContainer.classList.add("roomInfoContainer");
            this.roomListInnerContainer.appendChild(roomInfoContainer);

            let roomInfoContainer__header = document.createElement("h2");
            roomInfoContainer__header.classList.add("roomInfoContainer__header");
            roomInfoContainer__header.setAttribute("data-room-name", room.name);
            roomInfoContainer__header.innerHTML = room.name;
            roomInfoContainer__header.addEventListener("click", (e) => {
                userDataController.myAvatar.positionSelfInRoom((<HTMLElement>e.target).getAttribute('data-room-name'));
            });
            roomInfoContainer.appendChild(roomInfoContainer__header);

            room.seats.forEach((seat) => {
                if (seat.occupiedUserData) {
                    let roomInfoContainer__occupant = document.createElement("p");
                    roomInfoContainer__occupant.classList.add("roomInfoContainer__occupant");
                    roomInfoContainer__occupant.innerHTML = seat.occupiedUserData.displayName;
                    roomInfoContainer.appendChild(roomInfoContainer__occupant);
                }
            });
        });
    }
}
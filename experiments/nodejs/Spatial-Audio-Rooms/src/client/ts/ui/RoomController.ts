import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { userDataController } from "..";
import { CLOSE_ENOUGH_M, ROOM_SEATING_RADIUS_M, VIRTUAL_ROOM_DIMENSIONS_PER_SIDE_M } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";

export class Seat {
    position: Point3D;
    orientation: OrientationEuler3D;
    occupiedUserData: UserData;

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

                let occupied = !!roomUserData.find((element) => { return element.position && Math.abs(element.position.x - currentPotentialPosition.x) < CLOSE_ENOUGH_M && Math.abs(element.position.z - currentPotentialPosition.z) < CLOSE_ENOUGH_M; });

                if (!occupied) {
                    let orientationYawRadians = Math.atan2(currentPotentialPosition.x - this.center.x, currentPotentialPosition.z - this.center.z);
                    let orientationYawDegrees = orientationYawRadians * 180 / Math.PI;
                    orientationYawDegrees %= 360;
                    let computedYawOrientationDegrees = Math.round((orientationYawDegrees + Number.EPSILON) * 100) / 100;
                    foundOpenSpot = true;
                    return new Seat({
                        position: currentPotentialPosition,
                        orientationEuler: new OrientationEuler3D({ yawDegrees: computedYawOrientationDegrees}),
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

    constructor() {
        this.lobby = new Room({ name: "Lobby", center: new Point3D({ x: 0, y: 0, z: 0 }) });

        this.rooms = [];
        this.rooms.push(this.lobby);
    }

    getRoomFromPoint3D(point3D: Point3D): Room {
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

            userRoom.seats.push(new Seat({
                position: userData.position,
                orientationEuler: userData.orientationEuler,
                occupiedUserData: userData
            }));
        });

        this.rooms.forEach((room) => {

        });
    }
}
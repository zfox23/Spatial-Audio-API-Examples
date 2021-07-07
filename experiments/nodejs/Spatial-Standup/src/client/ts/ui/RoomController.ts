import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";
import { appConfigController, connectionController, roomController, uiController, uiThemeController, userDataController, webSocketConnectionController } from "..";
import { AVATAR, ROOM, MISC } from "../constants/constants";
import { UserData } from "../userData/UserDataController";
import { Utilities } from "../utilities/Utilities";

export class SpatialAudioSeat {
    room: SpatialStandupRoom;
    position: Point3D;
    orientation: OrientationEuler3D;
    occupiedUserData?: UserData;
    seatID: string;
    seatingCircleTheta?: number;

    constructor({ room, position, orientationEuler, seatID, seatingCircleTheta }: { room: SpatialStandupRoom, position: Point3D, orientationEuler: OrientationEuler3D, seatID: string, seatingCircleTheta?: number }) {
        this.room = room;
        this.position = position;
        this.orientation = orientationEuler;
        this.occupiedUserData = undefined;
        this.seatID = seatID;
        this.seatingCircleTheta = seatingCircleTheta;
    }
}

class SpatialStandupRoomImage {
    image: HTMLImageElement;
    loaded: boolean;
}

export enum SpatialStandupRoomType {
    Normal = "normal",
    WatchParty = "watchParty"
};

export class SpatialStandupRoom {
    name: string;
    seatingCenter: Point3D;
    dimensions: Point3D;
    seatingRadiusM: number;
    roomCenter: Point3D;
    roomYawOrientationDegrees: number;
    numSeatsInRoom: number;
    seats: Array<SpatialAudioSeat>;
    tableColorHex: string;
    roomImage: SpatialStandupRoomImage;
    roomType: SpatialStandupRoomType;

    constructor({
        name,
        seatingCenter,
        seatingRadiusM,
        roomCenter,
        roomYawOrientationDegrees = 0,
        numSeatsInRoom,
        dimensions,
        roomImageSRC,
        roomType = SpatialStandupRoomType.Normal,
    }: {
        name: string,
        seatingCenter: Point3D,
        seatingRadiusM?: number,
        roomCenter?: Point3D,
        roomYawOrientationDegrees?: number,
        numSeatsInRoom?: number,
        dimensions?: Point3D,
        roomImageSRC?: string,
        roomType?: SpatialStandupRoomType
    }) {
        this.name = name;
        this.seatingCenter = seatingCenter;
        this.roomCenter = roomCenter || this.seatingCenter;
        this.roomYawOrientationDegrees = roomYawOrientationDegrees;

        this.roomType = roomType;

        let maxAvatarRadiusM = AVATAR.RADIUS_M * AVATAR.MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER;

        if (seatingRadiusM) {
            this.seatingRadiusM = Utilities.clamp(seatingRadiusM, 2 * maxAvatarRadiusM, 9999);
        } else {
            this.seatingRadiusM = 2 * maxAvatarRadiusM;
        }

        this.dimensions = dimensions ? dimensions : new Point3D({ x: 2 * this.seatingRadiusM * 2 + maxAvatarRadiusM, y: 0, z: 2 * this.seatingRadiusM * 2 + maxAvatarRadiusM });

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

        if (numSeatsInRoom) {
            this.numSeatsInRoom = numSeatsInRoom;
        } else if (!numSeatsInRoom && roomType === SpatialStandupRoomType.Normal) {
            this.numSeatsInRoom = Math.ceil(((Math.PI * this.seatingRadiusM * this.seatingRadiusM) / (2.5 * AVATAR.RADIUS_M)));
        } else if (!numSeatsInRoom && roomType === SpatialStandupRoomType.WatchParty) {
            this.numSeatsInRoom = Math.ceil(((Math.PI * this.seatingRadiusM * this.seatingRadiusM) / (2.5 * AVATAR.RADIUS_M))) / 2;
        }

        this.seats = [];
        this.generateInitialSeats();

        this.tableColorHex = Utilities.hexColorFromString(this.name);

        if (roomImageSRC) {
            this.roomImage = new SpatialStandupRoomImage();
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
        let thetaMax, incrementor;
        if (this.roomType === SpatialStandupRoomType.Normal) {
            thetaMax = 2 * Math.PI;
            incrementor = (thetaMax / (this.numSeatsInRoom));
        } else if (this.roomType === SpatialStandupRoomType.WatchParty) {
            thetaMax = Math.PI;
            incrementor = (thetaMax / (this.numSeatsInRoom - 1));
        }

        for (let theta = 0; theta <= thetaMax; theta += incrementor) {
            let currentPotentialPosition = new Point3D({
                "x": this.seatingRadiusM * Math.cos(theta) + this.seatingCenter.x,
                "z": this.seatingRadiusM * Math.sin(theta) + this.seatingCenter.z
            });

            currentPotentialPosition.x = Math.round((currentPotentialPosition.x + Number.EPSILON) * 100) / 100;
            currentPotentialPosition.z = Math.round((currentPotentialPosition.z + Number.EPSILON) * 100) / 100;

            let orientationYawRadians = Math.atan2(currentPotentialPosition.x - this.seatingCenter.x, currentPotentialPosition.z - this.seatingCenter.z);
            let orientationYawDegrees = orientationYawRadians * 180 / Math.PI - this.roomYawOrientationDegrees;
            orientationYawDegrees %= 360;
            orientationYawDegrees = Math.round((orientationYawDegrees + Number.EPSILON) * 100) / 100;

            let rotatedPosition = Utilities.rotateAroundPoint(this.roomCenter.x, this.roomCenter.z, currentPotentialPosition.x, currentPotentialPosition.z, -this.roomYawOrientationDegrees);
            currentPotentialPosition.x = rotatedPosition[0];
            currentPotentialPosition.z = rotatedPosition[1];

            let newSeat = new SpatialAudioSeat({
                room: this,
                position: currentPotentialPosition,
                orientationEuler: new OrientationEuler3D({ yawDegrees: orientationYawDegrees }),
                seatID: `${this.name}${theta.toFixed(2)}`,
                seatingCircleTheta: theta
            });

            this.seats.push(newSeat);
        }

        this.seats.sort((a, b) => {
            if (!(a.seatingCircleTheta && b.seatingCircleTheta)) {
                return 0;
            }

            if (a.seatingCircleTheta < b.seatingCircleTheta) {
                return -1;
            }
            if (a.seatingCircleTheta > b.seatingCircleTheta) {
                return 1;
            }
            return 0;
        });
    }

    getOptimalOpenSeat() {
        if (this.roomType === SpatialStandupRoomType.Normal) {
            // The algorithm below attempts to seat new people in a room in the seat that's
            // the furthest away from everyone else.
            let occupiedSeats = [];
            let unoccupiedSeats = [];
            for (let i = 0; i < this.seats.length; i++) {
                if (this.seats[i].occupiedUserData) {
                    occupiedSeats.push(this.seats[i]);
                } else {
                    unoccupiedSeats.push(this.seats[i]);
                }
            }

            if (occupiedSeats.length === 0) {
                return this.seats[0];
            }

            if (unoccupiedSeats.length === 0) {
                return;
            }

            let targetTheta, adjacentSeatThetaDifference;
            for (let i = 0; i < occupiedSeats.length; i++) {
                let thisSeatThetaDifference, currentTargetTheta;
                let seat1, seat2;
                if (i === occupiedSeats.length - 1) {
                    seat1 = occupiedSeats[i];
                    seat2 = occupiedSeats[0];
                    thisSeatThetaDifference = (occupiedSeats[0].seatingCircleTheta + 2 * Math.PI) - occupiedSeats[i].seatingCircleTheta;
                    currentTargetTheta = ((occupiedSeats[0].seatingCircleTheta + 2 * Math.PI) + occupiedSeats[i].seatingCircleTheta) / 2;
                } else {
                    seat1 = occupiedSeats[i];
                    seat2 = occupiedSeats[i + 1];
                    thisSeatThetaDifference = occupiedSeats[i + 1].seatingCircleTheta - occupiedSeats[i].seatingCircleTheta;
                    currentTargetTheta = (occupiedSeats[i + 1].seatingCircleTheta + occupiedSeats[i].seatingCircleTheta) / 2;
                }
                if (adjacentSeatThetaDifference === undefined || thisSeatThetaDifference > adjacentSeatThetaDifference) {
                    adjacentSeatThetaDifference = thisSeatThetaDifference;
                    targetTheta = currentTargetTheta;
                }
            }

            let actualSeat, minThetaDifference;
            for (let i = 0; i < unoccupiedSeats.length; i++) {
                let thetaDifference = Math.abs(unoccupiedSeats[i].seatingCircleTheta - targetTheta);

                if (minThetaDifference === undefined || thetaDifference < minThetaDifference) {
                    minThetaDifference = thetaDifference;
                    actualSeat = unoccupiedSeats[i];
                }
            }

            return actualSeat;
        } else if (this.roomType === SpatialStandupRoomType.WatchParty) {
            let visitedAllSeats = false;
            let initialIndex = Math.round(this.seats.length / 2);
            let currentIndex = initialIndex;
            while (!visitedAllSeats) {
                if (!this.seats[currentIndex].occupiedUserData) {
                    return this.seats[currentIndex];
                }

                if (currentIndex === 0) {
                    currentIndex = this.seats.length - 1;
                } else {
                    currentIndex--;
                }

                if (currentIndex === initialIndex) {
                    visitedAllSeats = true;
                }
            }
        }

        console.warn(`There are no open seats in the room named \`${this.name}\`!`);
        return;
    }
}

export class RoomController {
    topBar: HTMLDivElement;
    roomsInitialized: boolean = false;
    rooms: Array<SpatialStandupRoom>;
    showRoomListButton: HTMLButtonElement;
    roomListOuterContainer: HTMLDivElement;
    roomListInnerContainer: HTMLDivElement;
    topBar__allRoomsPeopleCount: HTMLDivElement;
    currentlyHoveringOverVisitIDHash: string;

    constructor() {
        this.rooms = [];

        this.topBar = document.querySelector(".topBar");
        this.topBar.addEventListener("click", this.hideRoomList.bind(this));

        this.showRoomListButton = document.createElement("button");
        this.showRoomListButton.classList.add("showRoomListButton");
        this.showRoomListButton.setAttribute("aria-label", "Show Rooms List");
        this.topBar.appendChild(this.showRoomListButton);
        this.showRoomListButton.addEventListener("click", (e) => {
            this.toggleRoomList();
            e.stopPropagation();
        });

        let topBar__roomsHeader = document.createElement("h1");
        topBar__roomsHeader.classList.add("topBar__roomsHeader");
        topBar__roomsHeader.innerHTML = "Rooms";
        topBar__roomsHeader.addEventListener("click", (e) => {
            this.toggleRoomList();
            e.stopPropagation();
        });
        this.topBar.appendChild(topBar__roomsHeader);

        let topBar__peopleIcon = document.createElement("div");
        topBar__peopleIcon.classList.add("topBar__peopleIcon");
        topBar__peopleIcon.addEventListener("click", (e) => {
            this.toggleRoomList();
            e.stopPropagation();
        });
        this.topBar.appendChild(topBar__peopleIcon);

        this.topBar__allRoomsPeopleCount = document.createElement("p");
        this.topBar__allRoomsPeopleCount.classList.add("topBar__allRoomsPeopleCount");
        this.topBar__allRoomsPeopleCount.innerHTML = "0";
        this.topBar__allRoomsPeopleCount.addEventListener("click", (e) => {
            this.toggleRoomList();
            e.stopPropagation();
        });
        this.topBar.appendChild(this.topBar__allRoomsPeopleCount);

        this.roomListOuterContainer = document.querySelector(".roomListOuterContainer");
        this.roomListInnerContainer = document.querySelector(".roomListInnerContainer");

        if (appConfigController.configComplete) {
            this.initializeRooms();
        } else {
            appConfigController.onConfigComplete.push(this.initializeRooms.bind(this));
        }
    }

    async initializeRooms() {
        this.rooms = appConfigController.rooms;
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

        if (this.roomListOuterContainer.classList.contains("displayNone")) {
            this.showRoomListButton.setAttribute("aria-label", "Show Rooms List");
        } else {
            this.showRoomListButton.setAttribute("aria-label", "Hide Rooms List");
        }
    }

    getRoomFromPoint3DOnCircle(point3D: Point3D): SpatialStandupRoom {
        if (!point3D) {
            return undefined;
        }

        return this.rooms.find((room) => {
            return Math.abs(Utilities.getDistanceBetween2DPoints(point3D.x, point3D.z, room.seatingCenter.x, room.seatingCenter.z) - room.seatingRadiusM) <= MISC.CLOSE_ENOUGH_M;
        });
    }

    getRoomFromPoint3DInsideBoundaries(point3D: Point3D): SpatialStandupRoom {
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
        let totalNumOccupiedSeats = 0;

        this.roomListInnerContainer.innerHTML = ``;

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
            roomInfoContainer__header.innerHTML = `${room.name} <span class="roomInfoContainer__peopleIcon"></span> ${occupiedSeats.length}/${room.numSeatsInRoom}`;
            totalNumOccupiedSeats += occupiedSeats.length;
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

        let roomInfoContainer = document.createElement("div");
        roomInfoContainer.classList.add("roomInfoContainer");
        if (userDataController.myAvatar.myUserData.currentRoom === undefined) {
            roomInfoContainer.classList.add("roomInfoContainer--mine");
        }
        this.roomListInnerContainer.appendChild(roomInfoContainer);

        let allUserData = userDataController.allOtherUserData.concat(userDataController.myAvatar.myUserData);
        allUserData.forEach((userData) => {
            let roomInfoContainer__occupant = document.createElement("p");
            roomInfoContainer__occupant.classList.add("roomInfoContainer__occupant");
            roomInfoContainer__occupant.setAttribute('data-visit-id-hash', userData.visitIDHash);
            let occupantInnerHTML;
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                occupantInnerHTML = `<span class="roomInfoContainer__occupantAvatar" style="background-color:${userDataController.myAvatar.myUserData.colorHex};border-color:${userDataController.myAvatar.myUserData.colorHex};background-image:url(${userDataController.myAvatar.myUserData.profileImageURL ? userDataController.myAvatar.myUserData.profileImageURL : "none"});"></span>`;
                occupantInnerHTML += `<div class="roomInfoContainer__occupantTextContainer"><p class="roomInfoContainer__occupantTextTop">${userData.displayName}</p><p class="roomInfoContainer__occupantTextBottom">(YOU)</p></div>`;
                if (userData.currentRoom) {
                    document.querySelector(`[data-room-name="${userData.currentRoom.name}"]`).prepend(roomInfoContainer__occupant);
                }
            } else {
                occupantInnerHTML = ``;
                if (userData.colorHex) {
                    occupantInnerHTML += `<span class="roomInfoContainer__occupantAvatar" style="background-color:${userData.colorHex};border-color:${userData.colorHex};background-image:url(${userData.profileImageURL ? userData.profileImageURL : "none"});"></span>`;
                }
                occupantInnerHTML += `<span class="roomInfoContainer__occupantDisplayName">${userData.displayName && userData.displayName.length > 0 ? userData.displayName : userData.providedUserID}</span>`;
                if (userData.currentRoom) {
                    document.querySelector(`[data-room-name="${userData.currentRoom.name}"]`).appendChild(roomInfoContainer__occupant);
                }
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
            
            // This code works around a Safari rendering bug - see HIFI-727.
            roomInfoContainer__occupant.classList.add("displayNone");
            setTimeout(() => {
                roomInfoContainer__occupant.classList.remove("displayNone");
            }, 10);
        });

        this.topBar__allRoomsPeopleCount.innerHTML = totalNumOccupiedSeats.toString();

        uiThemeController.refreshThemedElements();
    }
}
import { OrientationEuler3D, Point3D } from "hifi-spatial-audio";

export interface UserData {
    visitIDHash?: string,
    displayName?: string,
    colorHex?: string,
    position?: Point3D,
    orientationEuler?: OrientationEuler3D,
    volumeDecibels?: number,
    hiFiGain?: number,
    volumeThreshold?: number,
}

class MyAvatar {
    myUserData: UserData;

    constructor() {
        this.myUserData = {
            visitIDHash: undefined,
            displayName: undefined,
            colorHex: undefined,
            position: undefined,
            orientationEuler: undefined,
            volumeDecibels: undefined,
            hiFiGain: undefined,
            volumeThreshold: undefined
        };
    }
}

export class UserDataController {
    allUserData: Array<UserData>;
    myAvatar: MyAvatar;

    constructor() {
        this.allUserData = [];
        this.myAvatar = new MyAvatar();
    }
}

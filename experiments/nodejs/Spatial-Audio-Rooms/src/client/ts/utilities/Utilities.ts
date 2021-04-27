import { Point3D, OrientationEuler3D } from "hifi-spatial-audio";
import { physicsController, twoDimensionalRenderer, uiController } from "..";

export interface DataToTransmitToHiFi {
    position?: Point3D;
    orientationEuler?: OrientationEuler3D;
}

export interface CanvasPX {
    x: number;
    y: number;
}

// Adapted from https://gist.github.com/gre/1650294 and http://gizma.com/easing/
export class EasingFunctions {
    // no easing, no acceleration
    static easeLinear = (t: number) => t;
    // accelerating from zero velocity
    static easeInQuad = (t: number) => t * t;
    // decelerating to zero velocity
    static easeOutQuad = (t: number) => t * (2 - t);
    // acceleration until halfway; then deceleration
    static easeInOutQuad = (t: number) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    // accelerating from zero velocity 
    static easeInCubic = (t: number) => t * t * t;
    // decelerating to zero velocity 
    static easeOutCubic = (t: number) => (--t) * t * t + 1;
    // acceleration until halfway; then deceleration 
    static easeInOutCubic = (t: number) => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    // accelerating from zero velocity 
    static easeInQuart = (t: number) => t * t * t * t;
    // decelerating to zero velocity 
    static easeOutQuart = (t: number) => 1 - (--t) * t * t * t;
    // acceleration until halfway; then deceleration
    static easeInOutQuart = (t: number) => t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
    // accelerating from zero velocity
    static easeInQuint = (t: number) => t * t * t * t * t;
    // decelerating to zero velocity
    static easeOutQuint = (t: number) => 1 + (--t) * t * t * t * t;
    // acceleration until halfway; then deceleration 
    static easeInOutQuint = (t: number) => t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t;
    // decelerating to zero velocity
    static easeOutExponential = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export class Utilities {
    constructor() {

    }

    static clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }

    static linearScale(factor: number, minInput: number, maxInput: number, minOutput: number, maxOutput: number, clampInput: boolean = false) {
        if (clampInput) {
            factor = Utilities.clamp(factor, minInput, maxInput);
        }

        return minOutput + (maxOutput - minOutput) *
            (factor - minInput) / (maxInput - minInput);
    }

    static logarithmicScale(factor: number, minInput: number, maxInput: number, minOutput: number, maxOutput: number) {
        minOutput = Math.log(minOutput);
        maxOutput = Math.log(maxOutput);

        let scale = (maxOutput - minOutput) / (maxInput - minInput);

        return Math.exp(minOutput + scale * (factor - minInput));
    }

    static getRandomFloat(min: number, max: number) {
        return Math.random() * (max - min) + min;
    }

    static hexColorFromString(string: string) {
        if (!string) {
            return;
        }

        let hash = 0;
        for (let i = 0; i < string.length; i++) {
            hash = string.charCodeAt(i) + ((hash << 5) - hash); // eslint-disable-line
        }

        let color = (hash & 0x00FFFFFF)
            .toString(16)
            .toUpperCase();

        return "#" + "000000".substring(0, 6 - color.length) + color;
    }

    static hexToRGB(colorHex: string) {
        if (!colorHex) {
            colorHex = "#FFFFFF";
        }

        colorHex = colorHex.slice(1);
        const hexBaseValue = 16;
        let splitHexValues = colorHex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
        let red = parseInt(splitHexValues[1], hexBaseValue);
        let green = parseInt(splitHexValues[2], hexBaseValue);
        let blue = parseInt(splitHexValues[3], hexBaseValue);

        return {
            red: red,
            green: green,
            blue: blue
        }
    }

    static getConstrastingTextColor(rgb: any) {
        // HSP Color Model equation from http://alienryderflex.com/hsp.html
        // The three constants (.299, .587, and .114) represent the different degrees to which each of the primary (RGB) colors 
        // affects human perception of the overall brightness of a color.  Notice that they sum to 1.
        let perceivedBrightnessDegreeRed = 0.299;
        let perceivedBrightnessDegreeGreen = 0.587;
        let perceivedBrightnessDegreeBlue = 0.114;

        let brightness = Math.sqrt(
            perceivedBrightnessDegreeRed * (rgb.red * rgb.red) +
            perceivedBrightnessDegreeGreen * (rgb.green * rgb.green) +
            perceivedBrightnessDegreeBlue * (rgb.blue * rgb.blue)
        );

        // Using the HSP value, determine whether the color is light or dark
        let medianBrightnessValue = 127.5;
        if (brightness > medianBrightnessValue) {
            return "#000000";
        }
        else {
            return "#FFFFFF";
        }
    }

    static getInitials(name: string) {
        if (!name) {
            return "";
        }

        name = name.toString();

        let textWords = name.split(" ");
        textWords = textWords.splice(0, 2);
        textWords.forEach((word, idx) => { const symbols = [...word]; textWords[idx] = symbols[0]; });
        return textWords.join("").toUpperCase();
    }

    static getDistanceBetween2DPoints(x1: number, y1: number, x2: number, y2: number) {
        let xMovement = x2 - x1;
        let yMovement = y2 - y1;

        return Math.sqrt((xMovement *= xMovement) + (yMovement *= yMovement));
    }

    static randomIntBetween(min: number, max: number) {
        return Math.floor(Utilities.randomFloatBetween(min, max));
    }

    static randomFloatBetween(min: number, max: number) {
        return (Math.random() * (max - min)) + min;
    }

    static generateUUID(trimBrackets?: boolean) {
        let i = 0;
        let generatedUUID = "";
        let baseString;
        if (trimBrackets) {
            baseString = '{xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx}';
        } else {
            baseString = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
        }
        while (i++ < 38) {
            let c = baseString[i - 1], r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            generatedUUID += (c == '-' || c == '4') ? c : v.toString(16)
        }

        return generatedUUID;
    }

    static rotateAroundPoint(cx: number, cy: number, x: number, y: number, angleDegrees: number) {
        let radians = (Math.PI / 180) * angleDegrees,
            cos = Math.cos(radians),
            sin = Math.sin(radians),
            nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
            ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
        return [nx, ny];
    }

    static normalModeCanvasPXToM(canvasPX: CanvasPX) {
        let pxPerM = physicsController.pxPerMCurrent;
        let canvasOffsetPX = twoDimensionalRenderer.canvasOffsetPX;
        let cameraPositionNoOffsetM = twoDimensionalRenderer.cameraPositionNoOffsetM;
        let yawOrientationRadians = twoDimensionalRenderer.canvasRotationDegrees * Math.PI / 180;

        if (pxPerM === undefined || canvasOffsetPX === undefined || cameraPositionNoOffsetM === undefined || yawOrientationRadians === undefined) {
            return;
        }

        let translatedCanvasPX = {
            x: canvasPX.x - canvasOffsetPX.x - cameraPositionNoOffsetM.x * pxPerM,
            y: canvasPX.y - canvasOffsetPX.y - cameraPositionNoOffsetM.z * pxPerM
        };

        // console.log(translatedCanvasPX)

        let rotatedCanvasPX = {
            x: translatedCanvasPX.x * Math.cos(yawOrientationRadians) - translatedCanvasPX.y * Math.sin(yawOrientationRadians),
            y: translatedCanvasPX.x * Math.sin(yawOrientationRadians) + translatedCanvasPX.y * Math.cos(yawOrientationRadians)
        };

        // console.log(rotatedCanvasPX)

        let pointM = {
            x: rotatedCanvasPX.x / pxPerM + cameraPositionNoOffsetM.x,
            z: rotatedCanvasPX.y / pxPerM + cameraPositionNoOffsetM.z
        };
        // console.log(pointM)
        // console.log('')

        return pointM;
    }

    /**
     * @returns If the point is within the rectangle, returns the distance from the center of the rectangle. Else, returns `undefined`. 
     */
    static pointIsWithinRectangle({ point, rectCenter, rectDimensions }: { point: Point3D, rectCenter: Point3D, rectDimensions: Point3D }) {
        if (!(point && rectCenter && rectDimensions)) {
            return false;
        }

        if (point.x <= rectCenter.x + rectDimensions.x / 2 &&
            point.x >= rectCenter.x - rectDimensions.x / 2 &&
            point.z <= rectCenter.z + rectDimensions.z / 2 &&
            point.z >= rectCenter.z - rectDimensions.z / 2) {
            return Utilities.getDistanceBetween2DPoints(point.x, point.z, rectCenter.x, rectCenter.z);
        } else {
            return undefined;
        }
    }

    static getGesturePointFromEvent(evt: MouseEvent | TouchEvent) {
        let point = {
            x: 0,
            y: 0
        };

        if (typeof (TouchEvent) !== "undefined" && evt instanceof TouchEvent) {
            // Prefer Touch Events
            point.x = evt.targetTouches[0].clientX;
            point.y = evt.targetTouches[0].clientY;
        } else {
            // Either Mouse event or Pointer Event
            point.x = (<MouseEvent>evt).clientX;
            point.y = (<MouseEvent>evt).clientY;
        }

        return point;
    }

    static enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
        return Object.keys(obj).filter(k => Number.isNaN(+k)) as K[];
    }
}
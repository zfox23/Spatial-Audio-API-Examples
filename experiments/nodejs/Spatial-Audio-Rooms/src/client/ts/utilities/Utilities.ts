import { Point3D } from "hifi-spatial-audio";
import { uiController } from "..";

export interface CanvasPX {
    x: number;
    y: number;
}

export class Utilities {
    constructor() {

    }

    static clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }

    static linearScale(factor: number, minInput: number, maxInput: number, minOutput: number, maxOutput: number) {
        return minOutput + (maxOutput - minOutput) *
            (factor - minInput) / (maxInput - minInput);
    }

    static logarithmicScale(factor: number, minInput: number, maxInput: number, minOutput: number, maxOutput: number) {
        factor = Utilities.clamp(factor, minInput, maxInput);

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

    static easeInOutQuart(progressFraction: number) {
        return progressFraction < 0.5 ? 8 * progressFraction * progressFraction * progressFraction * progressFraction : 1 - Math.pow(-2 * progressFraction + 2, 4) / 2;
    }

    static easeOutQuad(progressFraction: number) {
        return 1 - (1 - progressFraction) * (1 - progressFraction);
    }

    static getDistanceBetween2DPoints(x1: number, y1: number, x2: number, y2: number) {
        let xMovement = x2 - x1;
        let yMovement = y2 - y1;

        return Math.sqrt((xMovement *= xMovement) + (yMovement *= yMovement));
    }

    static randomFloatBetween(min: number, max: number) {
        return (Math.random() * (max - min)) + min;
    }

    static generateUUID(trimBrackets: boolean) {
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

    static rotateAroundPoint(cx: number, cy: number, x: number, y: number, angle: number) {
        let radians = (Math.PI / 180) * angle,
            cos = Math.cos(radians),
            sin = Math.sin(radians),
            nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
            ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
        return [nx, ny];
    }

    static canvasPXToM(canvasPX: CanvasPX) {
        if (!uiController.canvasRenderer.myCurrentRoom) {
            return undefined;
        }

        let pxPerM = uiController.canvasRenderer.pxPerM;
        let canvasOffsetPX = uiController.canvasRenderer.canvasOffsetPX;
        let cameraPositionM = uiController.canvasRenderer.myCurrentRoom.center;
        let yawOrientationRadians = uiController.canvasRenderer.canvasRotationDegrees * Math.PI / 180;

        let translatedCanvasPX = {
            x: canvasPX.x - canvasOffsetPX.x - cameraPositionM.x * pxPerM,
            y: canvasPX.y - canvasOffsetPX.y - cameraPositionM.z * pxPerM
        };

        let rotatedCanvasPX = {
            x: translatedCanvasPX.x * Math.cos(yawOrientationRadians) - translatedCanvasPX.y * Math.sin(yawOrientationRadians),
            y: translatedCanvasPX.x * Math.sin(yawOrientationRadians) + translatedCanvasPX.y * Math.cos(yawOrientationRadians)
        };

        let pointM = {
            x: rotatedCanvasPX.x / pxPerM + cameraPositionM.x,
            z: rotatedCanvasPX.y / pxPerM - cameraPositionM.z
        };

        return pointM;
    }
}
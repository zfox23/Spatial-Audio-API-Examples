function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function linearScale(factor, minInput, maxInput, minOutput, maxOutput) {
    factor = clamp(factor, minInput, maxInput);

    return minOutput + (maxOutput - minOutput) *
        (factor - minInput) / (maxInput - minInput);
}

function logarithmicScale(factor, minInput, maxInput, minOutput, maxOutput) {
    factor = clamp(factor, minInput, maxInput);

    minOutput = Math.log(minOutput);
    maxOutput = Math.log(maxOutput);

    let scale = (maxOutput - minOutput) / (maxInput - minInput);

    return Math.exp(minOutput + scale * (factor - minInput));
}

function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function hexColorFromString(string) {
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

function hexToRGB(colorHex) {
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

function getConstrastingTextColor(rgb) {
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

function getInitials(name) {
    if (!name) {
        return "";
    }

    name = name.toString();
    
    let textWords = name.split(" ");
    textWords = textWords.splice(0, 2);
    textWords.forEach((word, idx) => { const symbols = [...word]; textWords[idx] = symbols[0]; });
    return textWords.join("").toUpperCase();
}

function getYawOrientationDegreesFromQuat(hiFiQuat) {
    let threeEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(hiFiQuat.x, hiFiQuat.y, hiFiQuat.z, hiFiQuat.w), THREE_EULER_ORDER);
    let yawOrientationDegrees = threeEuler.y * 180 / Math.PI;
    return yawOrientationDegrees;
}

function easeInOutQuart(progressFraction) {
    return progressFraction < 0.5 ? 8 * progressFraction * progressFraction * progressFraction * progressFraction : 1 - Math.pow(-2 * progressFraction + 2, 4) / 2;
}

function easeOutQuad(progressFraction) {
    return 1 - (1 - progressFraction) * (1 - progressFraction);
}

function getDistanceBetween2DPoints(x1, y1, x2, y2) {
    let xMovement = x2 - x1;
    let yMovement = y2 - y1;

    return Math.sqrt((xMovement *= xMovement) + (yMovement *= yMovement));
}

function randomFloatBetween(min, max) {
    return (Math.random() * (max - min)) + min;
}

function generateUUID(trimBrackets) {
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

function rotateAroundPoint(cx, cy, x, y, angle) {
    let radians = (Math.PI / 180) * angle,
        cos = Math.cos(radians),
        sin = Math.sin(radians),
        nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
        ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
    return [nx, ny];
}

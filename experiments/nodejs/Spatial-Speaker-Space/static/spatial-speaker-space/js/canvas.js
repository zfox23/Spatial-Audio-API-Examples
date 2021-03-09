let mainCanvas = document.querySelector(".mainCanvas");
let ctx = mainCanvas.getContext("2d");

let pxPerM;
function updatePixelsPerMeter() {
    pxPerM = Math.round(Math.min(mainCanvas.width, mainCanvas.height) / VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M);
}

function maybeDrawScaleArcs() {
    if (DRAW_SCALE_ARCS) {
        ctx.font = SCALE_ARC_LABEL_FONT;
        ctx.fillStyle = SCALE_ARC_LABEL_COLOR_HEX;
        ctx.lineWidth = SCALE_ARC_STROKE_WIDTH_PX;
        for (const circleInfo of SCALE_ARC_INFO) {
            ctx.strokeStyle = circleInfo.color;
            let circleRadiusM = circleInfo.radius;
            if (circleRadiusM === 0) {
                continue;
            }
            let circleRadiusPX = pxPerM * circleRadiusM;
            ctx.beginPath();
            ctx.arc(mainCanvas.width / 2, mainCanvas.height / 2, circleRadiusPX, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillText(`${circleRadiusM}m`, mainCanvas.width / 2, mainCanvas.height / 2 - circleRadiusPX - SCALE_ARC_LABEL_PADDING_PX);
            ctx.fillText(`${circleRadiusM}m`, mainCanvas.width / 2, mainCanvas.height / 2 + circleRadiusPX + SCALE_ARC_LABEL_PADDING_PX);
            ctx.textAlign = "end";
            ctx.fillText(`${circleRadiusM}m`, mainCanvas.width / 2 - circleRadiusPX - SCALE_ARC_LABEL_PADDING_PX, mainCanvas.height / 2);
            ctx.textAlign = "start";
            ctx.fillText(`${circleRadiusM}m`, mainCanvas.width / 2 + circleRadiusPX + SCALE_ARC_LABEL_PADDING_PX, mainCanvas.height / 2);
            ctx.closePath();
        }
    }
}

function drawAvatarBase({ isMine, userData, avatarRadiusM, positionInCanvasSpace }) {
    if (typeof (userData.participantType) !== "string") {
        return;
    }

    ctx.translate(positionInCanvasSpace.x, positionInCanvasSpace.y);
    let amtToRotate = (userData.yawOrientationDegrees || 0) * Math.PI / 180;
    ctx.rotate(amtToRotate);

    // Don't show orientation visualization if user is an audience member.
    if (userData.participantType === "speaker") {
        ctx.beginPath();
        ctx.arc(0, -avatarRadiusM * DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, avatarRadiusM * DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM, 0, Math.PI, false);
        let grad = ctx.createLinearGradient(0, 0, 0, -avatarRadiusM * DIRECTION_CLOUD_RADIUS_MULTIPLIER * pxPerM);
        grad.addColorStop(0.0, userData.colorHex);
        grad.addColorStop(1.0, userData.colorHex + "00");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.closePath();
    }

    ctx.lineWidth = AVATAR_STROKE_WIDTH_PX;
    if (userData.isRecording) {
        ctx.fillStyle = RECORDING_AVATAR_HEX;
    } else {
        ctx.fillStyle = userData.colorHex;
    }
    ctx.beginPath();
    ctx.arc(0, 0, avatarRadiusM * pxPerM, 0, 2 * Math.PI);
    if (isMine) {
        if (isMuted) {
            ctx.strokeStyle = MY_AVATAR_STROKE_HEX_MUTED;
        } else {
            ctx.strokeStyle = MY_AVATAR_STROKE_HEX_UNMUTED;
        }
    } else {
        ctx.strokeStyle = OTHER_AVATAR_STROKE_HEX;
    }
    ctx.stroke();
    ctx.fill();
    ctx.closePath();
    ctx.rotate(-amtToRotate);
    ctx.translate(-positionInCanvasSpace.x, -positionInCanvasSpace.y);
}

function drawAvatarLabel({ isMine, userData, avatarRadiusM, positionInCanvasSpace }) {
    ctx.translate(positionInCanvasSpace.x, positionInCanvasSpace.y + MY_AVATAR_LABEL_Y_OFFSET_PX);
    let amtToRotateLabel = -canvasRotationDegrees * Math.PI / 180;
    ctx.rotate(amtToRotateLabel);

    ctx.font = MY_AVATAR_LABEL_FONT;
    ctx.fillStyle = getConstrastingTextColor(hexToRGB(userData.colorHex));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";


    let textToDraw = userData.displayName;
    let textMetrics = ctx.measureText(textToDraw);
    let avatarRadiusPX = avatarRadiusM * pxPerM;
    if (textMetrics.width > avatarRadiusPX + 5) {
        textToDraw = getInitials(userData.displayName);
    }

    ctx.fillText(textToDraw, 0, 0);
    ctx.rotate(-amtToRotateLabel);
    ctx.translate(-positionInCanvasSpace.x, -(positionInCanvasSpace.y + MY_AVATAR_LABEL_Y_OFFSET_PX));
}

function drawVolumeBubble({ userData, avatarRadiusM, positionInCanvasSpace }) {
    ctx.beginPath();
    ctx.arc(positionInCanvasSpace.x, positionInCanvasSpace.y, linearScale(userData.volumeDecibels, MIN_VOLUME_DB, MAX_VOLUME_DB, avatarRadiusM, avatarRadiusM * MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER) * pxPerM, 0, 2 * Math.PI);
    ctx.fillStyle = userData.colorHex;
    ctx.fill();
    ctx.closePath();
}

function drawAvatar({ userData }) {
    if (!userData || !userData.position || typeof (userData.position.x) !== "number" || typeof (userData.position.z) !== "number" || typeof (userData.participantType) !== "string") {
        return;
    }

    ctx.translate(-mainCanvas.width / 2, -mainCanvas.height / 2);

    let positionInCanvasSpace = {
        "x": Math.round(linearScale(userData.position.x, -VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, 0, mainCanvas.width)),
        // We "reverse" the last two terms here because "-thisAxis" in canvas space is "+thisAxis" in mixer space.
        "y": Math.round(linearScale(userData.position.z, -VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, mainCanvas.height, 0))
    };

    let isMine = userData.visitIDHash === myVisitIDHash;

    let avatarRadiusM;
    if (userData.participantType === "speaker") {
        avatarRadiusM = SPEAKER_AVATAR_RADIUS_M;
    } else {
        avatarRadiusM = AUDIENCE_AVATAR_RADIUS_M;
    }

    drawVolumeBubble({ userData, avatarRadiusM, positionInCanvasSpace });
    drawAvatarBase({ isMine, userData, avatarRadiusM, positionInCanvasSpace });
    drawAvatarLabel({ isMine, userData, avatarRadiusM, positionInCanvasSpace });

    ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
}

function drawParticles() {
    if (particleController.activeParticles.length === 0) {
        return;
    }

    ctx.translate(-mainCanvas.width / 2, -mainCanvas.height / 2);

    particleController.activeParticles.forEach((particle) => {
        if (!particle.currentWorldPositionM.x || !particle.currentWorldPositionM.z ||
            !particle.dimensionsM.width || !particle.dimensionsM.height ||
            !particle.image.complete) {
            return;
        }

        let positionInCanvasSpace = {
            "x": Math.round(linearScale(particle.currentWorldPositionM.x, -VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, 0, mainCanvas.width)),
            "y": Math.round(linearScale(particle.currentWorldPositionM.z, -VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, 0, mainCanvas.height))
        };

        ctx.translate(positionInCanvasSpace.x, positionInCanvasSpace.y);
        let amtToRotateParticle = -canvasRotationDegrees * Math.PI / 180;
        ctx.rotate(amtToRotateParticle);

        let oldAlpha = ctx.globalAlpha;
        ctx.globalAlpha = particle.opacity;

        ctx.drawImage(
            particle.image,
            -particle.dimensionsM.width * pxPerM / 2,
            -particle.dimensionsM.height * pxPerM / 2,
            particle.dimensionsM.width * pxPerM,
            particle.dimensionsM.height * pxPerM);

        ctx.globalAlpha = oldAlpha;
        ctx.rotate(-amtToRotateParticle);
        ctx.translate(-positionInCanvasSpace.x, -positionInCanvasSpace.y);
    });

    ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
}

let canvasRotationDegrees = 0;
function updateCanvas() {
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    if (allLocalUserData.length === 0) {
        return;
    }

    updateMyUserData();
    let allOtherUserData = allLocalUserData.filter((element) => { return element.visitIDHash !== myVisitIDHash && element.participantType !== "spatialMicrophone"; });
    let spatialMics = allLocalUserData.filter((element) => { return element.visitIDHash !== myVisitIDHash && element.participantType === "spatialMicrophone"; })

    updatePixelsPerMeter();

    ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
    ctx.rotate(canvasRotationDegrees * Math.PI / 180);

    for (const userData of allOtherUserData) {
        drawAvatar({ userData });
    }

    for (const userData of spatialMics) {
        drawAvatar({ userData });
    }

    drawAvatar({ userData: myUserData });

    drawParticles();

    ctx.rotate(-canvasRotationDegrees * Math.PI / 180);
    ctx.translate(-mainCanvas.width / 2, -mainCanvas.height / 2);
}

function updateCanvasDimensions() {
    mainCanvas.width = window.innerWidth;
    mainCanvas.height = window.innerHeight - 60;

    mainCanvas.style.width = `${mainCanvas.width}px`;
    mainCanvas.style.height = `${mainCanvas.height}px`;
}
updateCanvasDimensions();

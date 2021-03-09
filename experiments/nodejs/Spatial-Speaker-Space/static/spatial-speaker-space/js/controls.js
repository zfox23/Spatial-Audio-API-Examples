const M_KEY_CODE = "KeyM";
const SPACE_KEY_CODE = "Space";
const ONE_KEY_CODE = "Digit1";
const TWO_KEY_CODE = "Digit2";
const ESC_KEY_CODE = "Escape";
let keyboardEventCache = [];
let wasMutedBeforePTT = false;

function onUserKeyDown(event) {
    let shouldAddKeyEvent = true;
    for (let i = 0; i < keyboardEventCache.length; i++) {
        if (keyboardEventCache[i].code === event.code) {
            shouldAddKeyEvent = false;
            break;
        }
    }
    if (shouldAddKeyEvent) {
        keyboardEventCache.unshift(event);
    }

    switch (keyboardEventCache[0].code) {
        case M_KEY_CODE:
            toggleInputMute();
            break;
        case SPACE_KEY_CODE:
            if (isMuted) {
                wasMutedBeforePTT = true;
                setInputMute(false);
            }
            break;
        case ONE_KEY_CODE:
            signalsController.toggleActiveSignal(signalsController.SUPPORTED_SIGNALS.POSITIVE.name);          
            break;
        case TWO_KEY_CODE:
            signalsController.toggleActiveSignal(signalsController.SUPPORTED_SIGNALS.NEGATIVE.name);
            break;
        case ESC_KEY_CODE:
            signalsController.setActiveSignalByName(undefined);
            break;
    }
}
document.addEventListener('keydown', onUserKeyDown, false);

function onUserKeyUp(event) {
    for (let i = keyboardEventCache.length - 1; i >= 0; i--) {
        if (keyboardEventCache[i].code === event.code) {
            keyboardEventCache.splice(i, 1);
        }
    }

    switch (event.code) {
        case SPACE_KEY_CODE:
            if (wasMutedBeforePTT) {
                setInputMute(true);
                wasMutedBeforePTT = false;
            }
            break;
    }

    if (keyboardEventCache.length > 0) {
        onUserKeyDown(keyboardEventCache[0]);
    }
}
document.addEventListener('keyup', onUserKeyUp, false);

function onUserClick(e) {
    if (!myUserData) {
        return;
    }

    let rotatedPoint = rotateAroundPoint(mainCanvas.width / 2, mainCanvas.height / 2, e.offsetX, e.offsetY, canvasRotationDegrees);

    let clickM = {
        "x": linearScale(rotatedPoint[0], 0, mainCanvas.width, -VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2),
        "z": linearScale(rotatedPoint[1], 0, mainCanvas.height, -VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2, VIRTUAL_SPACE_DIMENSIONS_PER_SIDE_M / 2)
    };

    let isCloseEnough = false;
    if (myUserData && myUserData.position) {
        isCloseEnough = getDistanceBetween2DPoints(myUserData.position.x, myUserData.position.z, clickM.x, clickM.z) < PARTICLES.CLOSE_ENOUGH_ADD_M;
    }

    if (signalsController && signalsController.activeSignalName && isCloseEnough) {
        signalsController.addActiveSignal(clickM);
        return;
    }
}
mainCanvas.addEventListener('click', onUserClick);

/**
 * Gets the (x, y) point associated with an touch event, mouse event, or pointer event.
 * From: https://developers.google.com/web/fundamentals/design-and-ux/input/touch#implement-custom-gestures
 * @param {Event} evt 
 */
function getGesturePointFromEvent(evt) {
    let point = {};

    if (evt.targetTouches) {
        // Prefer Touch Events
        point.x = evt.targetTouches[0].clientX;
        point.y = evt.targetTouches[0].clientY;
    } else {
        // Either Mouse event or Pointer Event
        point.x = evt.clientX;
        point.y = evt.clientY;
    }

    return point;
}

let rightClickStartPositionPX;
function handleGestureOnCanvasStart(event) {
    event.preventDefault();
    event.target.focus();

    if (window.PointerEvent) {
        event.target.setPointerCapture(event.pointerId);
    } else {
        mainCanvas.addEventListener('mousemove', handleGestureOnCanvasMove, true);
        mainCanvas.addEventListener('mouseup', handleGestureOnCanvasEnd, true);
    }

    let gesturePointPX = getGesturePointFromEvent(event);

    if (event.button === 2) {
        rightClickStartPositionPX = gesturePointPX;
    }
}

let lastDistanceBetweenRightClickEvents = 0;
const RIGHT_CLICK_ROTATION_SENSITIVITY = 0.5;
function handleGestureOnCanvasMove(event) {
    event.preventDefault();

    let gesturePointPX = getGesturePointFromEvent(event);
    
    if (event.buttons === 2 && rightClickStartPositionPX) {
        let newDistance = gesturePointPX.x - rightClickStartPositionPX.x;
        let deltaDistance = newDistance - lastDistanceBetweenRightClickEvents;
        lastDistanceBetweenRightClickEvents = newDistance;

        if (myUserData) {
            updateMyPositionAndOrientation(undefined, myUserData.orientationEuler.yawDegrees + deltaDistance * RIGHT_CLICK_ROTATION_SENSITIVITY);
        }
    }
}

function handleGestureOnCanvasEnd(event) {
    event.preventDefault();

    // Remove Event Listeners
    if (window.PointerEvent) {
        if (event.pointerId) {
            event.target.releasePointerCapture(event.pointerId);
        }
    } else {
        // Remove Mouse Listeners
        mainCanvas.removeEventListener('mousemove', handleGestureOnCanvasMove, true);
        mainCanvas.removeEventListener('mouseup', handleGestureOnCanvasEnd, true);
    }
    
    if (event.button === 2 && rightClickStartPositionPX) {
        rightClickStartPositionPX = null;
        lastDistanceBetweenRightClickEvents = 0;
    }
}

function handleGestureOnCanvasCancel(event) {
    handleGestureOnCanvasEnd(event);
}
if (window.PointerEvent) {
    mainCanvas.addEventListener('pointerdown', handleGestureOnCanvasStart, true);
    mainCanvas.addEventListener('pointermove', handleGestureOnCanvasMove, true);
    mainCanvas.addEventListener('pointerup', handleGestureOnCanvasEnd, true);
    mainCanvas.addEventListener("pointerout", handleGestureOnCanvasCancel, true);
} else {
    mainCanvas.addEventListener('touchstart', handleGestureOnCanvasStart, true);
    mainCanvas.addEventListener('touchmove', handleGestureOnCanvasMove, true);
    mainCanvas.addEventListener('touchend', handleGestureOnCanvasEnd, true);
    mainCanvas.addEventListener("touchcancel", handleGestureOnCanvasCancel, true);

    mainCanvas.addEventListener("mousedown", handleGestureOnCanvasStart, true);
}
mainCanvas.addEventListener("gesturestart", (e) => { e.preventDefault(); }, false);
mainCanvas.addEventListener("gesturechange", (e) => { e.preventDefault(); }, false);
mainCanvas.addEventListener("gestureend", (e) => { e.preventDefault(); }, false);
mainCanvas.addEventListener("contextmenu", (e) => { e.preventDefault(); }, false);



let isMuted = false;
async function setInputMute(newMuteStatus) {
    if (!hifiCommunicator) {
        return;
    }
    
    if (isMuted === newMuteStatus) {
        return;
    }

    if (await hifiCommunicator.setInputAudioMuted(newMuteStatus)) {
        isMuted = newMuteStatus;

        if (isMuted) {
            toggleInputMuteButton.classList.add("toggleInputMuteButton--muted");
        } else {
            toggleInputMuteButton.classList.remove("toggleInputMuteButton--muted");
        }
    }
}

async function toggleInputMute() {
    await setInputMute(!isMuted);
}

function setOutputMute(newMuteStatus) {        
    outputAudioEl.muted = !!newMuteStatus;
    console.log(`Set output mute status to \`${outputAudioEl.muted}\``);

    if (outputAudioEl.muted) {
        toggleOutputMuteButton.classList.add("toggleOutputMuteButton--muted");
    } else {
        toggleOutputMuteButton.classList.remove("toggleOutputMuteButton--muted");
        // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
        outputAudioEl.play();
    }
}

function toggleOutputMute() {
    setOutputMute(!outputAudioEl.muted);
}
let toggleOutputMuteButton = document.querySelector('.toggleOutputMuteButton');
toggleOutputMuteButton.addEventListener("click", toggleOutputMute);

function closeParticipantsContainer() {
    participantsContainer.classList.add("displayNone");
}
mainCanvas.addEventListener('click', closeParticipantsContainer);

function toggleParticipantsContainerVisibility(e) {
    updateParticipantsContainerInnerHTML();
    participantsContainer.classList.toggle("displayNone");
}
let participantsFAB = document.querySelector('.participantsFAB');
participantsFAB.addEventListener('click', toggleParticipantsContainerVisibility);

const currentHiFiGainValue = document.querySelector('.currentHiFiGainValue');
function onHiFiGainChanged() {
    if (!hifiCommunicator || !myUserData) {
        return;
    }

    let sliderValue = parseInt(hiFiGainSlider.value);
    // Make the UI look nice with a default gain slider value of 1.0 instead of 1.05...
    if (sliderValue === 11) {
        myUserData.hiFiGain = 1.0;
    } else {
        myUserData.hiFiGain = logarithmicScale(sliderValue, 1, 21, 1, 110) / 10;
    }

    currentHiFiGainValue.innerHTML = `Input Gain: ${myUserData.hiFiGain.toFixed(2)}`;
    console.log(`User changed their HiFiGain to ${myUserData.hiFiGain}`);

    console.log(hifiCommunicator.updateUserDataAndTransmit({
        hiFiGain: myUserData.hiFiGain,
    }));
}
const hiFiGainSlider = document.querySelector('.hiFiGainSlider');
hiFiGainSlider.disabled = true;
hiFiGainSlider.addEventListener('input', onHiFiGainChanged);

const participantsContainer = document.querySelector('.participantsContainer');
participantsContainer.addEventListener('click', (e) => { e.stopPropagation(); });

function onMyDisplayNameChanged(newDisplayName) {
    newDisplayName = typeof (newDisplayName) === "string" ? newDisplayName : displayNameInput.value;
    localStorage.setItem('myDisplayName', newDisplayName);
    displayNameInput.value = newDisplayName;
    if (!myUserData) {
        return;
    }
    myUserData.displayName = newDisplayName;
    updateRemoteParticipant();
    updateParticipantsContainerInnerHTML();
}
const displayNameInput = document.querySelector('.displayNameInput');
displayNameInput.addEventListener('input', (e) => {
    onMyDisplayNameChanged(e.target.value);
});
if (localStorage.getItem('myDisplayName')) {
    onMyDisplayNameChanged(localStorage.getItem('myDisplayName'));
} else {
    onMyDisplayNameChanged(displayNameInput.value);
}

function onMyColorHexChanged(newColorHex) {
    newColorHex = typeof (newColorHex) === "string" ? newColorHex : colorHexInput.value;
    localStorage.setItem('myColorHex', newColorHex);
    colorHexInput.value = newColorHex;
    if (!myUserData) {
        return;
    }
    myUserData.colorHex = newColorHex;
    updateRemoteParticipant();
    updateParticipantsContainerInnerHTML();
}
const colorHexInput = document.querySelector('.colorHexInput');
colorHexInput.addEventListener('input', (e) => {
    onMyColorHexChanged(e.target.value);
});
if (localStorage.getItem('myColorHex')) {
    onMyColorHexChanged(localStorage.getItem('myColorHex'));
} else {
    onMyColorHexChanged(colorHexInput.value);
}

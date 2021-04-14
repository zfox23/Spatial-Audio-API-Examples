import { EasingFunctions } from "../utilities/Utilities";

export const MISC: any = {};
MISC.CLOSE_ENOUGH_M = 0.005;

export const AVATAR: any = {};
AVATAR.MIN_VOLUME_DB = -96;
AVATAR.MAX_VOLUME_DB = 0;
AVATAR.MAX_VOLUME_DB_AVATAR_RADIUS_MULTIPLIER = 1.4;
AVATAR.RADIUS_M = 0.20;
AVATAR.DIRECTION_CLOUD_RADIUS_MULTIPLIER = 2;
AVATAR.STROKE_WIDTH_PX = 5.0;
AVATAR.TUTORIAL_RADIUS_M = AVATAR.RADIUS_M + 0.8;
AVATAR.AVATAR_STROKE_HEX_MUTED = "#FF0000";
AVATAR.AVATAR_STROKE_HEX_UNMUTED = "#FFFFFF";
AVATAR.AVATAR_TUTORIAL_GLOW_HEX = "#007AFF";
AVATAR.AVATAR_LABEL_FONT = '14px Graphik';

export const CONTROLS: any = {};
CONTROLS.ESC_KEY_CODE = "Escape";
CONTROLS.DIGIT1_KEY_CODE = "Digit1";
CONTROLS.DIGIT2_KEY_CODE = "Digit2";
CONTROLS.M_KEY_CODE = "KeyM";
CONTROLS.P_KEY_CODE = "KeyP";
CONTROLS.U_KEY_CODE = "KeyU";
CONTROLS.SPACE_KEY_CODE = "Space";
CONTROLS.MINUS_KEY_CODE = "Minus";
CONTROLS.NUMPAD_SUBTRACT_KEY_CODE = "NumpadSubtract";
CONTROLS.EQUAL_KEY_CODE = "Equal";
CONTROLS.NUMPAD_ADD_KEY_CODE = "NumpadAdd";
CONTROLS.RIGHT_CLICK_ROTATION_SENSITIVITY = 0.5;
CONTROLS.MOUSE_WHEEL_ZOOM_FACTOR = 0.25;

export const ROOM: any = {};
ROOM.TABLE_STROKE_WIDTH_PX = 2.0;
ROOM.TABLE_STROKE_HEX = "#FFFFFF";
ROOM.SEAT_STROKE_WIDTH_PX = 3.0;
ROOM.SEAT_RADIUS_M = AVATAR.RADIUS_M - 0.05;
ROOM.SEAT_COLOR_HEX = "#111111";
ROOM.SEAT_STROKE_HEX = "#FFFFFF";
ROOM.ROOM_LABEL_FONT = '16px Graphik-Semibold';
ROOM.ROOM_WITH_IMAGE_LABEL_COLOR = '#FFFFFF';

export const UI: any = {};
UI.TUTORIAL_TEXT_FONT = '18px Graphik-Semibold';
UI.TUTORIAL_TEXT_COLOR = '#FFFFFF';
UI.TUTORIAL_TEXT_STROKE_COLOR = '#00000022';
UI.TUTORIAL_TEXT_STROKE_WIDTH_PX = 1;
UI.MY_AVATAR_Y_SCREEN_CENTER_OFFSET_RATIO = 0.35;
UI.HOVER_HIGHLIGHT_RADIUS_ADDITION_M = AVATAR.RADIUS_M;
UI.HOVER_GLOW_HEX = "#FFFFFF";
UI.CANVAS_SCRIM_OPACITY_DURING_MOTION = 0.8;
UI.AVATAR_PADDING_FOR_CAMERA = 3 * AVATAR.RADIUS_M / 2;
UI.MIN_SEAT_RADIUS_FOR_SEAT_VISIBILITY_PX = 22;

export const PHYSICS: any = {};
PHYSICS.PHYSICS_TICKRATE_MS = 16;
PHYSICS.MIN_PX_PER_M = 35;
PHYSICS.MAX_PX_PER_M = 1000;
PHYSICS.PX_PER_M_STEP = 25;
PHYSICS.SMOOTH_ZOOM_DURATION_NORMAL_MS = 500;
PHYSICS.SMOOTH_ZOOM_DURATION_SWITCH_ROOMS_MS = 1000;
PHYSICS.POSITION_TWEENING_DURATION_MS = 1500;

export const SIGNALS: any = {};
SIGNALS.RANDOM_START_DISTANCE_M = AVATAR.RADIUS_M * 2;
SIGNALS.RECEIVE_DISTANCE_M = AVATAR.RADIUS_M;

export const PARTICLES: any = {};
PARTICLES.DEFAULT_LINEAR_VELOCITY_M_PER_SEC = 3.6;
PARTICLES.MAX_LINEAR_VELOCITY_M_PER_SEC = 100;
PARTICLES.CLOSE_ENOUGH_ADD_M = 25;
PARTICLES.EASING = {
    "LINEAR": EasingFunctions.easeLinear,
    "EASE_OUT_QUAD": EasingFunctions.easeOutQuad,
    "EASE_OUT_QUART": EasingFunctions.easeOutQuart,
};

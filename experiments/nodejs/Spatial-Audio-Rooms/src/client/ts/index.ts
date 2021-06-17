import '../css/main.scss';
import { PathsController } from './ai/PathsController';
import { AVDevicesController } from './avDevices/AVDevicesController';
import { AppConfigController } from './config/AppConfigController';
import { ConnectionController } from './connection/ConnectionController';
import { WebSocketConnectionController } from './connection/WebSocketConnectionController';
import { PhysicsController } from './physics/PhysicsController';
import { TwoDimensionalRenderer } from './render/TwoDimensionalRenderer';
import { LocalSoundsController } from './sounds/LocalSoundsController';
import { EditorModeController } from './ui/EditorModeController';
import { LandmarksController as LandmarksController } from './ui/LandmarksController';
import { ParticleController } from './ui/ParticleController';
import { RoomController } from './ui/RoomController';
import { SignalsController } from './ui/SignalsController';
import { UIController } from "./ui/UIController";
import { UIThemeController } from './ui/UIThemeController';
import { UserInputController } from './ui/UserInputController';
import { WatchPartyController } from './ui/WatchPartyController';
import { UserDataController } from './userData/UserDataController';
import { VideoController } from './video/VideoController';

export const appConfigController = new AppConfigController();
export const connectionController = new ConnectionController();
export const webSocketConnectionController = new WebSocketConnectionController();
export const avDevicesController = new AVDevicesController();
export const uiController = new UIController();
export const localSoundsController = new LocalSoundsController();
export const userDataController = new UserDataController();
export const roomController = new RoomController();
export const landmarksController = new LandmarksController();
export const twoDimensionalRenderer = new TwoDimensionalRenderer();
export const watchPartyController = new WatchPartyController();
export const particleController = new ParticleController();
export const signalsController = new SignalsController();
export const videoController = new VideoController();
export const pathsController = new PathsController();
export const physicsController = new PhysicsController();
export const userInputController = new UserInputController();
export const editorModeController = new EditorModeController();

export const uiThemeController = new UIThemeController();

userDataController.init();
videoController.init();
roomController.initializeRooms();

twoDimensionalRenderer.updateCanvasDimensions();

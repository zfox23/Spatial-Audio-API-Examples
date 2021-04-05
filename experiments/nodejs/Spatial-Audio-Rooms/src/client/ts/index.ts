import '../css/main.scss';
import { ConnectionController } from './connection/ConnectionController';
import { PhysicsController } from './physics/PhysicsController';
import { RoomController } from './ui/RoomController';
import { UIController } from "./ui/UIController";
import { UserInputController } from './ui/UserInputController';
import { UserDataController } from './userData/UserDataController';
import { VideoController } from './video/VideoController';

export const connectionController = new ConnectionController();
export const userDataController = new UserDataController();
export const roomController = new RoomController();
export const uiController = new UIController();
export const videoController = new VideoController();
export const physicsController = new PhysicsController();
export const userInputController = new UserInputController();
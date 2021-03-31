import '../css/main.scss';
import { ConnectionController } from './connection/ConnectionController';
import { RoomController } from './ui/RoomController';
import { UIController } from "./ui/UIController";
import { UserInputController } from './ui/UserInputController';
import { UserDataController } from './userData/UserDataController';
import { VideoController } from './video/VideoController';

export const roomController = new RoomController();
export const userDataController = new UserDataController();
export const connectionController = new ConnectionController();
export const uiController = new UIController({ connectionController });
export const videoController = new VideoController();
export const userInputController = new UserInputController();
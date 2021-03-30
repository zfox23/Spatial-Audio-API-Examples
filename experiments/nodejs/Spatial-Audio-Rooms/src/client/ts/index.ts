import '../css/main.scss';
import { ConnectionController } from './connection/ConnectionController';
import { RoomController } from './ui/RoomController';
import { UIController } from "./ui/UIController";
import { UserInputController } from './ui/UserInputController';
import { UserDataController } from './userData/UserDataController';

export const roomController = new RoomController();
export const userDataController = new UserDataController();
export const connectionController = new ConnectionController();
export const uiController = new UIController({ connectionController });
export const userInputController = new UserInputController();
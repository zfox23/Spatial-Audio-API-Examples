import '../css/main.scss';
import { ConnectionController } from './connection/ConnectionController';
import { UIController } from "./ui/UIController";
import { UserDataController } from './userData/UserDataController';

export const userDataController = new UserDataController();
export const connectionController = new ConnectionController();
export const uiController = new UIController({ connectionController });
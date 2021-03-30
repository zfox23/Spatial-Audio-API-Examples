import '../css/main.scss';
import { ConnectionController } from './connection/ConnectionController';
import { UIController } from "./ui/UIController";
import { UserDataController } from './userData/UserDataController';

export const userDataController = new UserDataController();
const connectionController = new ConnectionController();
const uiController = new UIController({ connectionController });
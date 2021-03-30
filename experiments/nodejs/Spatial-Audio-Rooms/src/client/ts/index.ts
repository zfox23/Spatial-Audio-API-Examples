import '../css/main.scss';
import { ConnectionController } from './connection/ConnectionController';
import { UIController } from "./ui/UIController";

const connectionController = new ConnectionController();
const uiController = new UIController({ onPlayButtonClicked: connectionController.startConnectionProcess });
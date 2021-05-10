import { Point3D } from "hifi-spatial-audio";
import { Utilities } from "../utilities/Utilities";

export class EditorModeController {
    isInEditorMode: boolean = false;

    constructor() {

    }

    updateEditorModeUI() {
        let bottomBar = document.querySelector(".bottomBar");

        if (bottomBar) {
            if (this.isInEditorMode) {
                bottomBar.classList.add("bottomBar--editorMode");
            } else {
                bottomBar.classList.remove("bottomBar--editorMode");
            }
        }
    }

    exitEditorMode() {
        if (!this.isInEditorMode) {
            return;
        }

        console.warn(`Exiting editor mode...`);

        this.isInEditorMode = false;
        this.updateEditorModeUI();
    }

    enterEditorMode() {
        if (this.isInEditorMode) {
            return;
        }

        console.warn(`Entering editor mode...`);

        this.isInEditorMode = true;
        this.updateEditorModeUI();
    }

    toggleEditorMode() {
        if (this.isInEditorMode) {
            this.exitEditorMode();
        } else {
            this.enterEditorMode();
        }
    }

    handleCanvasClick(event: TouchEvent | MouseEvent | PointerEvent) {
        if (!this.isInEditorMode) {
            return;
        }

        if (event instanceof MouseEvent || event instanceof PointerEvent) {
            let clickM = new Point3D(Utilities.normalModeCanvasPXToM({x: event.offsetX, y: event.offsetY}));
            console.log(clickM)
        }
    }
}

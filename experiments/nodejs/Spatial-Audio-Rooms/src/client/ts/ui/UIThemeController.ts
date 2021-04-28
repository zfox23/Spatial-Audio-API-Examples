import { appConfigController } from "..";
import { Utilities } from "../utilities/Utilities";

export enum UITheme {
    LIGHT = "--light-theme",
    DARK = "--dark-theme"
};

export class UIThemeController {
    currentTheme: UITheme = UITheme.LIGHT;
    themedElements: Map<string, Array<HTMLElement>> = new Map();

    constructor() {
        document.body.classList.add("body");
        
        if (appConfigController.configComplete) {
            this.setTheme(appConfigController.theme);
        } else {
            this.setTheme(UITheme.DARK);
            appConfigController.onConfigComplete.push(() => { this.setTheme(appConfigController.theme); });
        }
    }

    cycleThemes() {
        let UIThemeKeys = Utilities.enumKeys(UITheme);
        for (let i = 0; i < UIThemeKeys.length; i++) {
            if (this.currentTheme === UITheme[UIThemeKeys[i]]) {
                if (i === UIThemeKeys.length - 1) {
                    this.setTheme(UITheme[UIThemeKeys[0]]);
                    return;
                } else {
                    this.setTheme(UITheme[UIThemeKeys[i + 1]]);
                    return;
                }
            }
        }
    }
    
    addThemedElementFromClassName(newElementBaseClassName: string) {
        let newElements = document.querySelectorAll(`.${newElementBaseClassName}`);
        if (newElements && newElements.length > 0) {
            newElements.forEach((element) => {
                let currentArray;
                if (this.themedElements.has(newElementBaseClassName)) {
                    currentArray = this.themedElements.get(newElementBaseClassName);
                    currentArray.push(<HTMLElement>element);
                } else {
                    currentArray = [<HTMLElement>element];
                }

                this.themedElements.set(newElementBaseClassName, currentArray);
            });
        }
    }

    refreshThemedElements() {
        this.themedElements = new Map();
        this.addThemedElementFromClassName("playOverlay");
        this.addThemedElementFromClassName("playOverlay__playText");
        this.addThemedElementFromClassName("playOverlay__thenPress");
        this.addThemedElementFromClassName("playOverlay__playAnimation");
        this.addThemedElementFromClassName("learnMoreContainer");
        this.addThemedElementFromClassName("learnMoreContainer__link");
        this.addThemedElementFromClassName("bottomBar");
        this.addThemedElementFromClassName("settingsMenu");
        this.addThemedElementFromClassName("settingsMenu__closeButton");
        this.addThemedElementFromClassName("settingsMenu__select");
        this.addThemedElementFromClassName("settingsMenu__h1");
        this.addThemedElementFromClassName("settingsMenu__h2");
        this.addThemedElementFromClassName("roomListOuterContainer");
        this.addThemedElementFromClassName("roomListInnerContainer");
        this.addThemedElementFromClassName("roomListInnerContainer__header");
        this.addThemedElementFromClassName("roomInfoContainer");
        this.addThemedElementFromClassName("roomInfoContainer--mine");
        this.addThemedElementFromClassName("modalBackground");
        this.addThemedElementFromClassName("avatarContextMenu");
        this.addThemedElementFromClassName("avatarContextMenu__closeButton");
        this.addThemedElementFromClassName("body");
        this.addThemedElementFromClassName("loadingScreen--text");
        this.addThemedElementFromClassName("loadingScreen--icon");
        this.addThemedElementFromClassName("signalButton--active");
        this.addThemedElementFromClassName("watchPartyModeCanvas");
        this.addThemedElementFromClassName("toggleInputMuteButton--unmuted");
        this.addThemedElementFromClassName("toggleInputMuteButton--muted");
        this.addThemedElementFromClassName("toggleInputMuteButton--disabled");
        this.addThemedElementFromClassName("toggleOutputMuteButton--unmuted");
        this.addThemedElementFromClassName("toggleOutputMuteButton--muted");
        this.addThemedElementFromClassName("toggleVideoButton--unmuted");
        this.addThemedElementFromClassName("toggleVideoButton--muted");
        this.addThemedElementFromClassName("toggleVideoButton--disabled");
        this.addThemedElementFromClassName("toggleSettingsButton");
        this.addThemedElementFromClassName("watchTogetherButton");
        this.addThemedElementFromClassName("leaveWatchPartyButton");
        this.addThemedElementFromClassName("watchTogetherURLInput");
        this.addThemedElementFromClassName("watchPartyInstructions");
        this.addThemedElementFromClassName("showRoomListButton");
        this.addThemedElementFromClassName("avatarContextMenu__displayName--mine");
        this.addThemedElementFromClassName("editMyProfileLink");
        this.addThemedElementFromClassName("zoomInButton");
        this.addThemedElementFromClassName("zoomOutButton");

        this.themedElements.forEach((themedElementArray, baseClassName) => {
            themedElementArray.forEach((themedElement) => {
                if (themedElement.classList.contains(`${baseClassName}${this.currentTheme}`)) {
                    return;
                }

                this.clearThemesFromElement(themedElement, baseClassName, true);    
                themedElement.classList.add(`${baseClassName}${this.currentTheme}`);
            });
        });
    }

    clearThemesFromElement(themedElement: HTMLElement, baseClassName: string, keepCurrentTheme: boolean = false) {
        for (const themeEnumValue of Utilities.enumKeys(UITheme)) {
            if (!keepCurrentTheme || (keepCurrentTheme && UITheme[themeEnumValue] !== this.currentTheme)) {
                themedElement.classList.remove(`${baseClassName}${UITheme[themeEnumValue]}`);
            }
        }
    }

    setTheme(newTheme: UITheme) {
        if (newTheme === this.currentTheme) {
            return;
        }

        this.currentTheme = newTheme;

        for (const themeEnumValue of Utilities.enumKeys(UITheme)) {
            if (UITheme[themeEnumValue] === this.currentTheme) {
                console.log(`Setting UI theme to: \`${themeEnumValue}\``);
                break;
            }
        }

        this.refreshThemedElements();
    }
}
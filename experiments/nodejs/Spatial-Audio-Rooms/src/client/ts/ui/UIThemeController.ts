import { Utilities } from "../utilities/Utilities";

export enum UITheme {
    LIGHT = "--light-theme",
    DARK = "--dark-theme"
};

export class UIThemeController {
    currentTheme: UITheme;
    themedElements: Map<string, Array<HTMLElement>> = new Map();

    constructor() {
        document.body.classList.add("body");
        this.setTheme(UITheme.LIGHT);
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
        this.addThemedElementFromClassName("bottomControlsContainer");
        this.addThemedElementFromClassName("bottomChangeButton");
        this.addThemedElementFromClassName("changeDeviceMenu");
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
        this.addThemedElementFromClassName("signalButton--active");
        this.addThemedElementFromClassName("watchPartyModeCanvas");
        this.addThemedElementFromClassName("toggleInputMuteButton");
        this.addThemedElementFromClassName("toggleInputMuteButton--muted");
        this.addThemedElementFromClassName("toggleInputMuteButton--disabled");
        this.addThemedElementFromClassName("toggleOutputMuteButton");
        this.addThemedElementFromClassName("toggleOutputMuteButton--muted");
        this.addThemedElementFromClassName("toggleVideoButton");
        this.addThemedElementFromClassName("toggleVideoButton--muted");
        this.addThemedElementFromClassName("toggleVideoButton--disabled");
        this.addThemedElementFromClassName("toggleRoomsDrawerButton");
        this.addThemedElementFromClassName("toggleJoinWatchPartyButton");

        this.themedElements.forEach((themedElementArray, baseClassName) => {
            themedElementArray.forEach((themedElement) => {
                for (const themeEnumValue of Utilities.enumKeys(UITheme)) {
                    if (UITheme[themeEnumValue] !== this.currentTheme) {
                        themedElement.classList.remove(`${baseClassName}${UITheme[themeEnumValue]}`);
                    }
                }
    
                themedElement.classList.add(`${baseClassName}${this.currentTheme}`);
            });
        });
    }

    setTheme(newTheme: UITheme) {
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
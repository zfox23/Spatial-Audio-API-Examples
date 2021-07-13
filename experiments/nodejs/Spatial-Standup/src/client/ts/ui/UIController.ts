import { accessibilityController, connectionController, physicsController, roomController, s3Controller, twoDimensionalRenderer, uiThemeController, userDataController, userInputController, videoController, webSocketConnectionController } from '..';
import '../../css/controls.scss';
import { AudionetInitResponse } from '../connection/ConnectionController';
import { UserData } from '../userData/UserDataController';
import { Utilities } from '../utilities/Utilities';
import { AVATAR, PHYSICS, UI } from '../constants/constants';
import ChooseColorButtonImage from '../../images/chooseColorButtonImage.png';
import AddPhotoButtonImage from '../../images/photo-select-icon.png';
import MuteForEveryoneButtonIcon from '../../images/mute-for-everyone-button-icon.svg';
import ColorPicker from 'simple-color-picker';

export class UIController {
    playOverlay: HTMLElement;
    modalBackground: HTMLDivElement;
    avatarContextMenu: HTMLDivElement;
    hasCompletedTutorial: boolean;
    bottomRightControlsContainer: HTMLDivElement;
    screenShareContainer: HTMLDivElement;
    showScreenShareHeaderTimeout: NodeJS.Timer;

    constructor() {
        this.initPlayOverlay();
        this.initMainUI();
        this.initBottomRightControls();
        this.initContextMenu();
        this.hideLoadingOverlay();
        this.initScreenShareUI();

        this.hasCompletedTutorial = localStorage.getItem("hasCompletedTutorial") === "true";
    }

    initPlayOverlay() {
        this.playOverlay = document.createElement("div");
        this.playOverlay.classList.add("playOverlay");
        document.body.appendChild(this.playOverlay);

        let playHeader = document.createElement("div");
        playHeader.classList.add("playOverlay__header");
        let playOverlay__headerImage = document.createElement("div");
        playOverlay__headerImage.classList.add("playOverlay__headerImage");
        playHeader.appendChild(playOverlay__headerImage);
        let playOverlay__headerTextContainer = document.createElement("div");
        playOverlay__headerTextContainer.classList.add("playOverlay__headerTextContainer");
        let playOverlay__headerTextTop = document.createElement("h1");
        playOverlay__headerTextTop.setAttribute("aria-label", "Spatial Standup: Powered by High Fidelity");
        playOverlay__headerTextTop.classList.add("playOverlay__headerTextTop");
        playOverlay__headerTextTop.innerHTML = `Spatial Standup`;
        playOverlay__headerTextContainer.appendChild(playOverlay__headerTextTop);
        let playOverlay__headerTextBottom = document.createElement("p");
        playOverlay__headerTextBottom.classList.add("playOverlay__headerTextBottom");
        playOverlay__headerTextBottom.innerHTML = `Powered by High Fidelity`;
        playOverlay__headerTextContainer.appendChild(playOverlay__headerTextBottom);
        playHeader.appendChild(playOverlay__headerTextContainer);
        this.playOverlay.appendChild(playHeader);

        let playOverlay__playContainer = document.createElement("div");
        playOverlay__playContainer.classList.add("playOverlay__playContainer");
        this.playOverlay.appendChild(playOverlay__playContainer);

        let playText = document.createElement("h2");
        playText.classList.add("playOverlay__playText");
        playText.innerHTML = `Put on your <span class="playOverlay__headphones">headphones</span> <span class="playOverlay__thenPress">then press play:</span>`;
        playOverlay__playContainer.appendChild(playText);
        let playButton = document.createElement("button");
        playButton.setAttribute('aria-label', "Enter Spatial Standup");
        playButton.classList.add("playOverlay__button");
        let playAnimation = document.createElement("div");
        playAnimation.classList.add("playOverlay__playAnimation");
        playButton.appendChild(playAnimation);
        playOverlay__playContainer.appendChild(playButton);

        let playOverlay__footer = document.createElement("div");
        playOverlay__footer.classList.add("playOverlay__footer");

        let playOverlay__byContinuing = document.createElement("p");
        playOverlay__byContinuing.classList.add("playOverlay__byContinuing");
        playOverlay__byContinuing.innerHTML = `By continuing, you agree to High Fidelity's <a href="https://www.highfidelity.com/terms-of-service" target="_blank">Terms of Service</a> and <a href="https://www.highfidelity.com/privacy" target="_blank">Privacy Policy</a>.`
        playOverlay__footer.appendChild(playOverlay__byContinuing);

        this.playOverlay.appendChild(playOverlay__footer);

        playButton.focus();
        playButton.addEventListener("click", (e) => {
            this.startConnectionProcess();
        });
    }

    initMainUI() {
        let bottomBar = document.createElement("div");
        bottomBar.setAttribute("role", "navigation");
        bottomBar.classList.add("bottomBar", "displayNone");
        bottomBar.addEventListener("click", (e) => { userInputController.hideSettingsMenu(); });
        bottomBar.addEventListener("click", this.hideAvatarContextMenu.bind(this));
        document.body.appendChild(bottomBar);

        let topBar = document.createElement("div");
        topBar.setAttribute("role", "navigation");
        topBar.classList.add("topBar", "displayNone");
        document.body.appendChild(topBar);
        
        let roomListOuterContainer = document.createElement("div");
        roomListOuterContainer.classList.add("roomListOuterContainer", "displayNone");
        document.body.appendChild(roomListOuterContainer);

        let roomListInnerContainer = document.createElement("div");
        roomListInnerContainer.setAttribute("role", "navigation");
        roomListInnerContainer.classList.add("roomListInnerContainer");
        roomListOuterContainer.appendChild(roomListInnerContainer);

        let bottomControlsContainer = document.createElement("div");
        bottomControlsContainer.classList.add("bottomControlsContainer");

        let myProfileContainer = document.createElement("div");
        myProfileContainer.classList.add("myProfileContainer");

        let myProfileImageContainer = document.createElement("div");
        myProfileImageContainer.classList.add("myProfileImageContainer");
        let myProfileImage = document.createElement("button");
        myProfileImage.classList.add("myProfileImage");
        myProfileImage.addEventListener("click", (e) => {
            this.showAvatarContextMenu(userDataController.myAvatar.myUserData);
            e.stopPropagation();
        });
        myProfileImageContainer.appendChild(myProfileImage);
        myProfileContainer.appendChild(myProfileImageContainer);

        let myDisplayName = document.createElement("p");
        myDisplayName.classList.add("myDisplayName");
        myProfileContainer.appendChild(myDisplayName);

        let editMyProfileButton = document.createElement("button");
        editMyProfileButton.innerHTML = "Edit My Profile";
        editMyProfileButton.classList.add("editMyProfileButton");
        editMyProfileButton.addEventListener("click", (e) => {
            this.showAvatarContextMenu(userDataController.myAvatar.myUserData);
            e.stopPropagation();
        });
        myProfileContainer.appendChild(editMyProfileButton);

        bottomControlsContainer.appendChild(myProfileContainer);

        let toggleInputMuteButton = document.createElement("button");
        toggleInputMuteButton.setAttribute("aria-label", "Microphone is unmuted. Click to mute your microphone.");
        toggleInputMuteButton.setAttribute("aria-keyshortcuts", "m");
        toggleInputMuteButton.classList.add("bottomControlButton", "toggleInputMuteButton", "toggleInputMuteButton--unmuted");
        bottomControlsContainer.appendChild(toggleInputMuteButton);

        let toggleOutputMuteButton = document.createElement("button");
        toggleOutputMuteButton.setAttribute("aria-label", "Headphones are unmuted. Click to mute your headphones.");
        toggleOutputMuteButton.classList.add("bottomControlButton", "toggleOutputMuteButton", "toggleOutputMuteButton--unmuted");
        bottomControlsContainer.appendChild(toggleOutputMuteButton);

        let toggleVideoButton = document.createElement("button");
        toggleVideoButton.setAttribute("aria-label", "Camera is disabled. Click to enable your camera.");
        toggleVideoButton.classList.add("bottomControlButton", "toggleVideoButton", "toggleVideoButton--muted");
        bottomControlsContainer.appendChild(toggleVideoButton);

        let toggleScreenShareButton = document.createElement("button");
        toggleScreenShareButton.setAttribute("aria-label", "Screen share is disabled. Click to share your screen.");
        toggleScreenShareButton.classList.add("bottomControlButton", "toggleScreenShareButton", "toggleScreenShareButton--muted");
        bottomControlsContainer.appendChild(toggleScreenShareButton);

        let toggleSettingsButton = document.createElement("button");
        toggleSettingsButton.setAttribute("aria-label", "Open Device Settings");
        toggleSettingsButton.classList.add("bottomControlButton", "toggleSettingsButton");
        bottomControlsContainer.appendChild(toggleSettingsButton);
        
        bottomBar.appendChild(bottomControlsContainer);

        let watchPartyControlsContainer = document.createElement("div");
        watchPartyControlsContainer.classList.add("watchPartyControlsContainer", "displayNone");

        let watchTogetherURLInput = document.createElement("input");
        watchTogetherURLInput.classList.add("watchTogetherURLInput");
        watchTogetherURLInput.type = "text";
        watchTogetherURLInput.placeholder = "Paste a YouTube URL";
        watchPartyControlsContainer.appendChild(watchTogetherURLInput);

        let watchTogetherButton = document.createElement("button");
        watchTogetherButton.classList.add("watchTogetherButton");
        watchTogetherButton.innerHTML = `Watch Together`;
        watchPartyControlsContainer.appendChild(watchTogetherButton);

        let leaveWatchPartyButton = document.createElement("button");
        leaveWatchPartyButton.classList.add("leaveWatchPartyButton", "displayNone");
        leaveWatchPartyButton.innerHTML = `Leave Watch Party`;
        watchPartyControlsContainer.appendChild(leaveWatchPartyButton);

        bottomBar.appendChild(watchPartyControlsContainer);

        this.modalBackground = document.createElement("div");
        this.modalBackground.classList.add("modalBackground", "displayNone");
        this.modalBackground.addEventListener("click", this.hideAvatarContextMenu.bind(this));
        document.body.appendChild(this.modalBackground);
    }

    initScreenShareUI() {
        this.screenShareContainer = document.createElement("div");
        this.screenShareContainer.classList.add("screenShareContainer", "displayNone");
        this.screenShareContainer.addEventListener("mousemove", () => {
            this.showScreenShareHeader();
        });
        document.body.appendChild(this.screenShareContainer);
    }

    showMainUI() {
        document.querySelector(".bottomBar").classList.remove("displayNone");
        document.querySelector(".topBar").classList.remove("displayNone");
        document.querySelector(".bottomRightControlsContainer").classList.remove("displayNone");
        document.querySelector(".normalModeCanvas").setAttribute("tabIndex", "0");
        (<HTMLCanvasElement>document.querySelector(".normalModeCanvas")).focus();
        twoDimensionalRenderer.updateCanvasDimensions();
    }

    showFTUE() {
        document.querySelector(".normalModeCanvas").setAttribute("tabIndex", "-1");

        let ftueOuterContainer = document.createElement("div");
        ftueOuterContainer.classList.add("ftueOuterContainer");

        let ftueInnerContainer = document.createElement("div");
        ftueInnerContainer.setAttribute("role", "dialog");
        ftueInnerContainer.classList.add("ftueInnerContainer");
        ftueOuterContainer.appendChild(ftueInnerContainer);

        let ftueInnerContainer__text = document.createElement("div");
        ftueInnerContainer__text.classList.add("ftueInnerContainer__text");
        ftueInnerContainer__text.id = "ftueInnerContainer__text";
        ftueInnerContainer__text.innerHTML = `<div class="ftueInnerContainer__emoji">🥳</div>
<h1>You made it!</h1>
<p>This is a live space where you can see and talk with other people.</p>
<p>Your display name is "<strong>${userDataController.myAvatar.myUserData.displayName}</strong>". You can change this in your <a class="ftueInnerContainer__profileLink">PROFILE</a>.</p>`
ftueInnerContainer.appendChild(ftueInnerContainer__text);

        let ftueInnerContainer__okButton = document.createElement("button");
        ftueInnerContainer__okButton.classList.add("ftueInnerContainer__okButton");
        ftueInnerContainer__okButton.setAttribute("aria-label", "OK"); 
        ftueInnerContainer__okButton.setAttribute("aria-labelledby", "ftueInnerContainer__text"); 
        ftueInnerContainer__okButton.innerHTML = `OK, thanks!`;
        ftueInnerContainer__okButton.addEventListener("click", (e) => {
            this.showMainUI();
            ftueOuterContainer.remove();
        });
        ftueInnerContainer.appendChild(ftueInnerContainer__okButton);

        document.body.appendChild(ftueOuterContainer);
        ftueInnerContainer__okButton.focus();

        document.querySelector(".ftueInnerContainer__profileLink").addEventListener("click", (e) => {
            this.showMainUI();
            ftueOuterContainer.remove();
            this.showAvatarContextMenu(userDataController.myAvatar.myUserData);
        });
    }

    updateMyProfileImage() {
        let avatarContextMenu__removeProfileImageButton = document.querySelector(".avatarContextMenu__removeProfileImageButton");
        let myProfileImage = <HTMLElement>document.querySelector(".myProfileImage");

        if (!userDataController.myAvatar.myUserData.profileImageURL || userDataController.myAvatar.myUserData.profileImageURL.length === 0) {
            let avatarContextMenu__imageFile: HTMLInputElement = document.querySelector(".avatarContextMenu__imageFile");
            if (avatarContextMenu__imageFile) {
                avatarContextMenu__imageFile.value = null;
            }
            if (avatarContextMenu__removeProfileImageButton) {
                avatarContextMenu__removeProfileImageButton.classList.add("displayNone");
            }
            if (myProfileImage) {
                myProfileImage.style.backgroundColor = userDataController.myAvatar.myUserData.colorHex;
                myProfileImage.style.backgroundImage = "none";
            }

            userDataController.myAvatar.myUserData.profileImageEl = undefined;
        } else {
            if (avatarContextMenu__removeProfileImageButton) {
                avatarContextMenu__removeProfileImageButton.classList.remove("displayNone");
            }
            if (myProfileImage) {
                myProfileImage.style.backgroundImage = `url(${userDataController.myAvatar.myUserData.profileImageURL})`;
            }

            let myProfileImageEl = new Image();
            myProfileImageEl.addEventListener("load", () => {
                userDataController.myAvatar.myUserData.profileImageEl = myProfileImageEl;
                this.maybeUpdateAvatarContextMenu(userDataController.myAvatar.myUserData);
            });
            myProfileImageEl.src = userDataController.myAvatar.myUserData.profileImageURL;
        }

        if (myProfileImage) {
            myProfileImage.style.borderColor = userDataController.myAvatar.myUserData.colorHex;
        }
        
        let hasProfilePicture = userDataController.myAvatar.myUserData.profileImageURL && userDataController.myAvatar.myUserData.profileImageURL.length > 0;
        myProfileImage.setAttribute("aria-label", `A button which looks like your avatar.${hasProfilePicture ? " It contains your profile picture." : ""} "Click to edit your profile."`);

        this.maybeUpdateAvatarContextMenu(userDataController.myAvatar.myUserData);
        webSocketConnectionController.updateMyUserDataOnWebSocketServer();
        try {
            roomController.updateRoomList();
        } catch (e) { }
    }

    updateMyDisplayName() {
        let myDisplayName = document.querySelector(".myDisplayName");
        if (myDisplayName) {
            myDisplayName.innerHTML = userDataController.myAvatar.myUserData.displayName;
        }
    }

    initBottomRightControls() {
        let bottomRightControlsContainer = document.createElement("div");
        bottomRightControlsContainer.setAttribute("role", "navigation");
        bottomRightControlsContainer.classList.add("bottomRightControlsContainer", "displayNone");
        document.body.appendChild(bottomRightControlsContainer);

        let zoomInContainer = document.createElement("div");
        zoomInContainer.classList.add("bottomRightControlContainer", "zoomInContainer");
        let zoomInText = document.createElement("span");
        zoomInText.classList.add("bottomRightControlText", "displayNone");
        zoomInText.innerHTML = "Zoom In";
        zoomInContainer.appendChild(zoomInText);
        let zoomInButton = document.createElement("button");
        zoomInButton.setAttribute("aria-label", "Zoom In");
        zoomInButton.classList.add("zoomButton", "zoomInButton");
        zoomInButton.addEventListener("click", () => {
            physicsController.smoothZoomStartTimestamp = undefined;
            physicsController.pxPerMTarget = (physicsController.pxPerMTarget || physicsController.pxPerMCurrent) + PHYSICS.PX_PER_M_STEP;
        });
        zoomInContainer.appendChild(zoomInButton);
        bottomRightControlsContainer.appendChild(zoomInContainer);

        let zoomOutContainer = document.createElement("div");
        zoomOutContainer.classList.add("bottomRightControlContainer", "zoomOutContainer");
        let zoomOutText = document.createElement("span");
        zoomOutText.classList.add("bottomRightControlText", "displayNone");
        zoomOutText.innerHTML = "Zoom Out";
        zoomOutContainer.appendChild(zoomOutText);
        let zoomOutButton = document.createElement("button");
        zoomOutButton.setAttribute("aria-label", "Zoom Out");
        zoomOutButton.classList.add("zoomButton", "zoomOutButton");
        zoomOutButton.addEventListener("click", () => {
            physicsController.smoothZoomStartTimestamp = undefined;
            physicsController.pxPerMTarget = (physicsController.pxPerMTarget || physicsController.pxPerMCurrent) - PHYSICS.PX_PER_M_STEP;
        });
        zoomOutContainer.appendChild(zoomOutButton);
        bottomRightControlsContainer.appendChild(zoomOutContainer);
    }

    initContextMenu() {
        this.avatarContextMenu = document.createElement("div");
        this.avatarContextMenu.setAttribute("role", "dialog");
        this.avatarContextMenu.classList.add("avatarContextMenu", "displayNone");
        this.avatarContextMenu.addEventListener("click", (e) => { e.stopPropagation(); });
        this.modalBackground.appendChild(this.avatarContextMenu);
    }

    hideLoadingOverlay() {
        document.querySelector('.loadingScreen').classList.add("displayNone");
    }

    showConnectingOverlay() {
        let loadingScreen = <HTMLDivElement>document.querySelector('.loadingScreen');
        let loadingScreen__text = <HTMLDivElement>document.querySelector('.loadingScreen--text');
        loadingScreen__text.innerHTML = `connecting...`;
        loadingScreen.style.background = 'transparent';
        loadingScreen.classList.remove("displayNone");
    }

    async startConnectionProcess() {
        document.querySelector(".normalModeCanvas").classList.remove("displayNone");
        this.playOverlay.classList.add("displayNone");
        this.showConnectingOverlay();

        let audionetInitResponse: AudionetInitResponse;
        try {
            audionetInitResponse = await connectionController.startConnectionProcess();
        } catch (e) {
            console.error(`Couldn't connect to High Fidelity! Error:\n${e}`);
            return;
        }
        
        this.hideLoadingOverlay();
    }

    hideAvatarContextMenu() {
        let topBar = document.querySelector(".topBar");
        if (topBar) {
            topBar.classList.remove("displayNone");
        }
        let bottomRightControlsContainer = document.querySelector(".bottomRightControlsContainer");
        if (bottomRightControlsContainer) {
            bottomRightControlsContainer.classList.remove("displayNone");
        }

        this.modalBackground.classList.add("displayNone");
        this.modalBackground.classList.remove("modalBackground--mobileFullscreen");
        this.avatarContextMenu.classList.add("displayNone");
        this.avatarContextMenu.removeAttribute('visit-id-hash');
        this.avatarContextMenu.classList.remove("avatarContextMenu--mine");

        let bottomControlsContainer = document.querySelector(".bottomControlsContainer");
        if (bottomControlsContainer) {
            bottomControlsContainer.classList.remove("displayNone");
        }

        document.querySelector(".normalModeCanvas").setAttribute("tabIndex", "0");
        (<HTMLCanvasElement>document.querySelector(".normalModeCanvas")).focus();
    }
    
    generateCloseButtonUI() {
        let closeButton = document.createElement("button");
        closeButton.classList.add("avatarContextMenu__closeButton");
        closeButton.setAttribute("aria-label", "Close Profile Dialog");
        uiThemeController.refreshThemedElements();
        closeButton.addEventListener("click", (e) => {
            this.hideAvatarContextMenu();
        });
        this.avatarContextMenu.appendChild(closeButton);
    }

    generateHeader(userData: UserData) {
        let displayName;

        let avatarContextMenu__customizeContainer = document.createElement("div");
        avatarContextMenu__customizeContainer.classList.add("avatarContextMenu__customizeContainer");

        let avatarContextMenu__avatarRepresentation = document.createElement("div");
        avatarContextMenu__avatarRepresentation.classList.add("avatarContextMenu__avatarRepresentation");

        let avatarContextMenu__h1 = document.createElement("h1");
        avatarContextMenu__h1.id = "avatarContextMenu__h1";
        avatarContextMenu__h1.classList.add("avatarContextMenu__h1");
        avatarContextMenu__h1.innerHTML = "Profile";
        this.avatarContextMenu.appendChild(avatarContextMenu__h1);

        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
            displayName = document.createElement("input");
            displayName.classList.add("avatarContextMenu__displayName", "avatarContextMenu__displayName--mine");
            displayName.type = "text";
            displayName.value = userData.displayName;

            displayName.addEventListener('input', (e) => {
                userDataController.myAvatar.onMyDisplayNameChanged((<HTMLInputElement>e.target).value);
            });
            
            let avatarContextMenu__avatarCircle = document.createElement("button");
            avatarContextMenu__avatarCircle.classList.add("avatarContextMenu__avatarCircle", "avatarContextMenu__avatarCircle--mine");
            avatarContextMenu__avatarCircle.setAttribute("aria-label", "Click to Set your Color");
            avatarContextMenu__avatarCircle.style.backgroundColor = userData.colorHex;
            avatarContextMenu__avatarCircle.style.borderColor = userData.colorHex;
            if (userData.profileImageEl && userData.profileImageEl.complete) {
                avatarContextMenu__avatarCircle.style.backgroundImage = `url(${userDataController.myAvatar.myUserData.profileImageURL})`;
            }
            avatarContextMenu__avatarCircle.addEventListener("click", (e) => {
                avatarContextMenu__colorPickerContainer.classList.toggle("displayNone");
                e.stopPropagation();
            });
            avatarContextMenu__avatarRepresentation.appendChild(avatarContextMenu__avatarCircle);

            let avatarContextMenu__colorPickerContainer = document.createElement("div");
            avatarContextMenu__colorPickerContainer.classList.add("avatarContextMenu__colorPickerContainer", "displayNone");
            avatarContextMenu__colorPickerContainer.addEventListener("click", (e) => {
                e.stopPropagation();
            });
            let avatarContextMenu__closeColorPickerButton = document.createElement("div");
            avatarContextMenu__closeColorPickerButton.classList.add("avatarContextMenu__closeButton");
            avatarContextMenu__closeColorPickerButton.addEventListener("click", (e) => {
                avatarContextMenu__colorPickerContainer.classList.add("displayNone");
            });
            avatarContextMenu__colorPickerContainer.appendChild(avatarContextMenu__closeColorPickerButton);
            this.avatarContextMenu.appendChild(avatarContextMenu__colorPickerContainer);
            this.avatarContextMenu.addEventListener("click", (e) => {
                avatarContextMenu__colorPickerContainer.classList.add("displayNone");
            });

            const colorPicker = new ColorPicker({
                el: avatarContextMenu__colorPickerContainer,
                color: userData.colorHex,
                width: 200,
                height: 200
            });
            colorPicker.onChange((e: string) => {
                userDataController.myAvatar.onMyColorHexChanged(e);
            });

            if (userData.profileImageURL && userData.profileImageURL.length > 0) {
                let removeProfileImageButton = document.createElement("button");
                removeProfileImageButton.setAttribute("aria-label", "Remove Profile Photo");
                removeProfileImageButton.classList.add("avatarContextMenu__removeProfileImageButton");
                removeProfileImageButton.innerHTML = `Remove`;
                removeProfileImageButton.addEventListener("click", (e) => {
                    userDataController.myAvatar.onMyProfileImageURLChanged("");
                });
                avatarContextMenu__avatarRepresentation.appendChild(removeProfileImageButton);
            }

            avatarContextMenu__customizeContainer.appendChild(avatarContextMenu__avatarRepresentation);

            let chooseColorButton = document.createElement("button");
            chooseColorButton.classList.add("avatarContextMenu__chooseColorButton");
            chooseColorButton.addEventListener('click', (e) => {
                avatarContextMenu__colorPickerContainer.classList.remove("displayNone");
                e.stopPropagation();
            });
            let chooseColorButtonImage = document.createElement("img");
            chooseColorButtonImage.classList.add("avatarContextMenu__chooseColorButtonImage");
            chooseColorButtonImage.src = ChooseColorButtonImage;
            chooseColorButton.appendChild(chooseColorButtonImage);
            let chooseColorButtonText = document.createElement("span");
            chooseColorButtonText.classList.add("avatarContextMenu__chooseColorButtonText");
            chooseColorButtonText.innerHTML = "Choose Color";
            chooseColorButton.appendChild(chooseColorButtonText);
            avatarContextMenu__customizeContainer.appendChild(chooseColorButton);
            
            let avatarContextMenu__imageFile = document.createElement("input");
            avatarContextMenu__imageFile.classList.add("avatarContextMenu__imageFile");
            avatarContextMenu__imageFile.type = "file";
            avatarContextMenu__imageFile.accept = "image/*"
            avatarContextMenu__imageFile.addEventListener("change", (e) => {
                let selectedFile = (<HTMLInputElement>(e.currentTarget)).files;
                if (selectedFile.length === 1) {
                    let imageFile = selectedFile[0];

                    let fileReader = new FileReader();
                    fileReader.onload = (fileLoadedEvent) => {
                        let srcData = fileLoadedEvent.target.result;
                        let newImage = document.createElement('img');
                        newImage.addEventListener('load', (event) => {
                            this.updateProfileImageFromBase64String((<HTMLImageElement>event.currentTarget).src);
                        });
                        newImage.src = srcData as string;
                    }
                    fileReader.readAsDataURL(imageFile);
                }
            })
            avatarContextMenu__customizeContainer.appendChild(avatarContextMenu__imageFile);
            
            let addPhotoButton = document.createElement("button");
            addPhotoButton.classList.add("avatarContextMenu__addPhotoButton");
            addPhotoButton.addEventListener('click', (e) => {
                avatarContextMenu__imageFile.click();
            });
            let addPhotoButtonImage = document.createElement("img");
            addPhotoButtonImage.classList.add("avatarContextMenu__addPhotoButtonImage");
            addPhotoButtonImage.src = AddPhotoButtonImage;
            addPhotoButton.appendChild(addPhotoButtonImage);
            let addPhotoButtonText = document.createElement("span");
            addPhotoButtonText.classList.add("avatarContextMenu__addPhotoButtonText");
            addPhotoButtonText.innerHTML = "Add Photo";
            addPhotoButton.appendChild(addPhotoButtonText);
            avatarContextMenu__customizeContainer.appendChild(addPhotoButton);

            this.avatarContextMenu.appendChild(displayName);
            this.avatarContextMenu.appendChild(avatarContextMenu__customizeContainer);
        } else {
            displayName = document.createElement("h1");
            displayName.classList.add("avatarContextMenu__displayName");
            displayName.innerText = userData.displayName && userData.displayName.length > 0 ? userData.displayName : userData.providedUserID;

            let avatarContextMenu__avatarCircle = document.createElement("div");
            avatarContextMenu__avatarCircle.classList.add("avatarContextMenu__avatarCircle");
            avatarContextMenu__avatarCircle.style.backgroundColor = userData.colorHex;
            avatarContextMenu__avatarCircle.style.borderColor = userData.colorHex;
            if (userData.profileImageEl && userData.profileImageEl.complete) {
                avatarContextMenu__avatarCircle.style.backgroundImage = `url(${userData.profileImageURL})`;
            }
            avatarContextMenu__avatarRepresentation.appendChild(avatarContextMenu__avatarCircle);
            avatarContextMenu__customizeContainer.appendChild(avatarContextMenu__avatarRepresentation);

            avatarContextMenu__customizeContainer.appendChild(displayName);
            this.avatarContextMenu.appendChild(avatarContextMenu__customizeContainer);
        }

        uiThemeController.refreshThemedElements();
    }

    updateProfileImageFromBase64String(newBase64String: string) {
        // Draw the image
        let image = new Image();
        image.onload = () => {
            // Create canvas
            let tempProfileImageCanvas = document.createElement('canvas');
            let tempCtx = tempProfileImageCanvas.getContext('2d');
            // Set width and height
            tempProfileImageCanvas.width = AVATAR.PROFILE_IMAGE_DIMENSIONS_MAX_PX;
            tempProfileImageCanvas.height = AVATAR.PROFILE_IMAGE_DIMENSIONS_MAX_PX;
    
            let imgRatio = image.height / image.width;
            let canvasRatio = tempProfileImageCanvas.height / tempProfileImageCanvas.width;
    
            if (imgRatio > canvasRatio) {
                let h = tempProfileImageCanvas.width * imgRatio;
                tempCtx.drawImage(image, 0, (tempProfileImageCanvas.height - h) / 2, tempProfileImageCanvas.width, h);
            } else {
                let w = tempProfileImageCanvas.width * canvasRatio / imgRatio;
                tempCtx.drawImage(image, (tempProfileImageCanvas.width - w) / 2, 0, w, tempProfileImageCanvas.height);
            }
    
            let imageData = tempCtx.getImageData(0, 0, AVATAR.PROFILE_IMAGE_DIMENSIONS_MAX_PX, AVATAR.PROFILE_IMAGE_DIMENSIONS_MAX_PX);
            let selectedPixel: any;
            for (let i = 0; i < AVATAR.PROFILE_IMAGE_DIMENSIONS_MAX_PX; i++) {
                for (let j = 0; j < AVATAR.PROFILE_IMAGE_DIMENSIONS_MAX_PX; j++) {
                    let rgba = Utilities.getPixelDataFromCanvasImageData(imageData.data, i, j, imageData.width);
                    let hsv = Utilities.RGBtoHSV(rgba);
                    if (!selectedPixel || (hsv.s > selectedPixel.s && hsv.v > 0.3 && hsv.v < 0.8)) {
                        selectedPixel = { x: i, y: j, rgba: rgba, s: hsv.s, v: hsv.v };
                    }
                }
            }
    
            tempProfileImageCanvas.toBlob((blob) => {
                tempProfileImageCanvas.remove();
                let s3KeyName = `${Utilities.generateUUID(true)}.png`;
                s3Controller.s3.upload({
                    Bucket: s3Controller.bucketName,
                    Key: s3KeyName,
                    Body: blob,
                    ACL: "public-read"
                }, (err, data) => {
                    if (err) {
                        console.log(`There was an error uploading your photo:\n${err.message}`);
                        return;
                    }
        
                    accessibilityController.speak("You successfully changed your profile photo!", "polite", 250);
                    console.log(`Successfully uploaded photo! URL:\n${data.Location}`);
    
                    userDataController.myAvatar.onMyProfileImageURLChanged(data.Location);
                    let newHexColor = Utilities.RGBAtoHex(selectedPixel.rgba, true);
                    userDataController.myAvatar.onMyColorHexChanged(newHexColor);
                });
            });
        };
        image.src = newBase64String;
    }

    generateEchoCancellationUI(userData: UserData) {
        if (typeof (userData.echoCancellationEnabled) !== "boolean" || !(typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().echoCancellation)) {
            return;
        }

        let echoCancellationContainer = document.createElement("div");
        echoCancellationContainer.classList.add("echoCancellationContainer");
        this.avatarContextMenu.appendChild(echoCancellationContainer);

        let echoCancellationCheckboxLabel = document.createElement("label");
        echoCancellationCheckboxLabel.setAttribute("for", "echoCancellationCheckbox");
        echoCancellationCheckboxLabel.classList.add("echoCancellationCheckboxLabel");
        echoCancellationCheckboxLabel.innerHTML = "Echo Cancellation";
        echoCancellationContainer.appendChild(echoCancellationCheckboxLabel);

        let echoCancellationSwitchLabel = document.createElement("label");
        echoCancellationSwitchLabel.classList.add("switch");
        let echoCancellationSwitchSlider = document.createElement("span");
        echoCancellationSwitchSlider.classList.add("slider");

        let echoCancellationCheckbox = document.createElement("input");
        echoCancellationCheckbox.id = "echoCancellationCheckbox";
        echoCancellationCheckbox.classList.add("echoCancellationCheckbox");
        echoCancellationCheckbox.type = "checkbox";
        echoCancellationCheckbox.checked = userData.echoCancellationEnabled;
        echoCancellationCheckbox.addEventListener("click", (e) => {
            let newEchoCancellationStatus = (<HTMLInputElement>e.target).checked;
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                userInputController.setEchoCancellationStatus(newEchoCancellationStatus)
            } else {
                if (webSocketConnectionController && newEchoCancellationStatus) {
                    webSocketConnectionController.requestToEnableEchoCancellation(userData.visitIDHash);
                } else if (webSocketConnectionController && !newEchoCancellationStatus) {
                    webSocketConnectionController.requestToDisableEchoCancellation(userData.visitIDHash);
                }
            }
        });

        echoCancellationSwitchLabel.appendChild(echoCancellationCheckbox);
        echoCancellationSwitchLabel.appendChild(echoCancellationSwitchSlider);

        echoCancellationContainer.appendChild(echoCancellationSwitchLabel);
    }

    generateAGCUI(userData: UserData) {
        if (typeof (userData.agcEnabled) !== "boolean" || !(typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().autoGainControl)) {
            return;
        }

        let agcContainer = document.createElement("div");
        agcContainer.classList.add("agcContainer");
        this.avatarContextMenu.appendChild(agcContainer);

        let agcCheckboxLabel = document.createElement("label");
        agcCheckboxLabel.setAttribute("for", "agcCheckbox");
        agcCheckboxLabel.classList.add("agcCheckboxLabel");
        agcCheckboxLabel.innerHTML = "Automatic Gain Control";
        agcContainer.appendChild(agcCheckboxLabel);

        let agcSwitchLabel = document.createElement("label");
        agcSwitchLabel.classList.add("switch");
        let agcSwitchSlider = document.createElement("span");
        agcSwitchSlider.classList.add("slider");

        let agcCheckbox = document.createElement("input");
        agcCheckbox.id = "agcCheckbox";
        agcCheckbox.classList.add("agcCheckbox");
        agcCheckbox.type = "checkbox";
        agcCheckbox.checked = userData.agcEnabled;
        agcCheckbox.addEventListener("click", (e) => {
            let newAGCStatus = (<HTMLInputElement>e.target).checked;
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                userInputController.setAGCStatus(newAGCStatus)
            } else {
                if (webSocketConnectionController && newAGCStatus) {
                    webSocketConnectionController.requestToEnableAGC(userData.visitIDHash);
                } else if (webSocketConnectionController && !newAGCStatus) {
                    webSocketConnectionController.requestToDisableAGC(userData.visitIDHash);
                }
            }
        });

        agcSwitchLabel.appendChild(agcCheckbox);
        agcSwitchLabel.appendChild(agcSwitchSlider);

        agcContainer.appendChild(agcSwitchLabel);
    }

    generateNoiseSuppressionUI(userData: UserData) {
        if (typeof (userData.noiseSuppressionEnabled) !== "boolean" || !(typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().noiseSuppression)) {
            return;
        }

        let noiseSuppressionContainer = document.createElement("div");
        noiseSuppressionContainer.classList.add("noiseSuppressionContainer");
        this.avatarContextMenu.appendChild(noiseSuppressionContainer);

        let noiseSuppressionCheckboxLabel = document.createElement("label");
        noiseSuppressionCheckboxLabel.setAttribute("for", "noiseSuppressionCheckbox");
        noiseSuppressionCheckboxLabel.classList.add("noiseSuppressionCheckboxLabel");
        noiseSuppressionCheckboxLabel.innerHTML = "Noise Suppression";
        noiseSuppressionContainer.appendChild(noiseSuppressionCheckboxLabel);

        let noiseSuppressionSwitchLabel = document.createElement("label");
        noiseSuppressionSwitchLabel.classList.add("switch");
        let noiseSuppressionSwitchSlider = document.createElement("span");
        noiseSuppressionSwitchSlider.classList.add("slider");

        let noiseSuppressionCheckbox = document.createElement("input");
        noiseSuppressionCheckbox.id = "noiseSuppressionCheckbox";
        noiseSuppressionCheckbox.classList.add("noiseSuppressionCheckbox");
        noiseSuppressionCheckbox.type = "checkbox";
        noiseSuppressionCheckbox.checked = userData.noiseSuppressionEnabled;
        noiseSuppressionCheckbox.addEventListener("click", (e) => {
            let newNoiseSuppressionStatus = (<HTMLInputElement>e.target).checked;
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                userInputController.setNoiseSuppressionStatus(newNoiseSuppressionStatus)
            } else {
                if (webSocketConnectionController && newNoiseSuppressionStatus) {
                    webSocketConnectionController.requestToEnableNoiseSuppression(userData.visitIDHash);
                } else if (webSocketConnectionController && !newNoiseSuppressionStatus) {
                    webSocketConnectionController.requestToDisableNoiseSuppression(userData.visitIDHash);
                }
            }
        });

        noiseSuppressionSwitchLabel.appendChild(noiseSuppressionCheckbox);
        noiseSuppressionSwitchLabel.appendChild(noiseSuppressionSwitchSlider);

        noiseSuppressionContainer.appendChild(noiseSuppressionSwitchLabel);
    }

    generateStereoInputUI(userData: UserData) {
        if (userData.visitIDHash !== userDataController.myAvatar.myUserData.visitIDHash || typeof (userData.stereoInput) !== "boolean") {
            return;
        }

        let stereoInputContainer = document.createElement("div");
        stereoInputContainer.classList.add("stereoInputContainer");
        this.avatarContextMenu.appendChild(stereoInputContainer);

        let stereoInputCheckboxLabel = document.createElement("label");
        stereoInputCheckboxLabel.setAttribute("for", "stereoInputCheckbox");
        stereoInputCheckboxLabel.classList.add("stereoInputCheckboxLabel");
        stereoInputCheckboxLabel.innerHTML = "Stereo Input";
        stereoInputContainer.appendChild(stereoInputCheckboxLabel);

        let stereoInputSwitchLabel = document.createElement("label");
        stereoInputSwitchLabel.classList.add("switch");
        let stereoInputSwitchSlider = document.createElement("span");
        stereoInputSwitchSlider.classList.add("slider");

        let stereoInputCheckbox = document.createElement("input");
        stereoInputCheckbox.id = "stereoInputCheckbox";
        stereoInputCheckbox.classList.add("stereoInputCheckbox");
        stereoInputCheckbox.type = "checkbox";
        stereoInputCheckbox.checked = userData.stereoInput;
        stereoInputCheckbox.addEventListener("click", (e) => {
            let newStereoInputStatus = (<HTMLInputElement>e.target).checked;
            userInputController.setStereoInputStatus(newStereoInputStatus)
        });

        stereoInputSwitchLabel.appendChild(stereoInputCheckbox);
        stereoInputSwitchLabel.appendChild(stereoInputSwitchSlider);

        stereoInputContainer.appendChild(stereoInputSwitchLabel);
    }

    generateUserGainForThisConnectionUI(userData: UserData) {
        let hifiCommunicator = connectionController.hifiCommunicator;

        if (!hifiCommunicator || userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
            return;
        }

        if (userData.userGainForThisConnection === undefined) {
            userData.userGainForThisConnection = 1.0;
        }

        let avatarContextMenu__userGainForThisConnectionContainer = document.createElement("div");
        avatarContextMenu__userGainForThisConnectionContainer.classList.add("avatarContextMenu__userGainForThisConnectionContainer");
        this.avatarContextMenu.appendChild(avatarContextMenu__userGainForThisConnectionContainer);

        let avatarContextMenu__userGainForThisConnectionHeader = document.createElement("h3");
        avatarContextMenu__userGainForThisConnectionHeader.id = "avatarContextMenu__userGainForThisConnectionHeader";
        avatarContextMenu__userGainForThisConnectionHeader.innerHTML = `Volume (Personal): ${Math.round(userData.userGainForThisConnection * 100)}%`;
        avatarContextMenu__userGainForThisConnectionHeader.classList.add("avatarContextMenu__userGainForThisConnectionHeader");
        avatarContextMenu__userGainForThisConnectionHeader.setAttribute("aria-label", "Volume of This User for You");
        avatarContextMenu__userGainForThisConnectionContainer.appendChild(avatarContextMenu__userGainForThisConnectionHeader);

        let avatarContextMenu__userGainForThisConnectionSliderContainer = document.createElement("div");
        avatarContextMenu__userGainForThisConnectionSliderContainer.classList.add("avatarContextMenu__userGainForThisConnectionSliderContainer");

        let avatarContextMenu__userGainForThisConnectionSlider = document.createElement("input");
        avatarContextMenu__userGainForThisConnectionSlider.type = "range";
        avatarContextMenu__userGainForThisConnectionSlider.min = "0.0";
        avatarContextMenu__userGainForThisConnectionSlider.max = "4.0";
        avatarContextMenu__userGainForThisConnectionSlider.value = userData.userGainForThisConnection.toString();
        avatarContextMenu__userGainForThisConnectionSlider.step = "0.1";
        avatarContextMenu__userGainForThisConnectionSlider.classList.add("avatarContextMenu__userGainForThisConnectionSlider");
        avatarContextMenu__userGainForThisConnectionSlider.setAttribute("aria-labelledby" ,"avatarContextMenu__userGainForThisConnectionHeader");
        avatarContextMenu__userGainForThisConnectionSlider.setAttribute("aria-valuemin", "0.0");
        avatarContextMenu__userGainForThisConnectionSlider.setAttribute("aria-valuemax", "4.0");
        avatarContextMenu__userGainForThisConnectionSlider.setAttribute("aria-valuenow", avatarContextMenu__userGainForThisConnectionSlider.value);
        avatarContextMenu__userGainForThisConnectionSlider.setAttribute("aria-valuetext", `${parseFloat(avatarContextMenu__userGainForThisConnectionSlider.value) * 100}x`);

        // The `change` event fires when the user lets go of the slider.
        // The `input` event fires as the user moves the slider.
        avatarContextMenu__userGainForThisConnectionSlider.addEventListener("input", async (e) => {
            let userGainForThisConnectionSliderValue = parseFloat((<HTMLInputElement>e.target).value);
            try {
                await hifiCommunicator.setOtherUserGainForThisConnection(userData.visitIDHash, userGainForThisConnectionSliderValue);
                userData.userGainForThisConnection = userGainForThisConnectionSliderValue;
            } catch (e) {
                console.error(`Couldn't set user gain for this connection for Visit ID Hash \`${userData.visitIDHash}\`! Error:\n${JSON.stringify(e)}`);
                avatarContextMenu__userGainForThisConnectionSlider.value = userData.userGainForThisConnection.toString();
            }
            this.maybeUpdateAvatarContextMenu(userData);
        });

        let avatarContextMenu__userGainForThisConnectionSliderLeftImage = document.createElement("div");
        avatarContextMenu__userGainForThisConnectionSliderLeftImage.classList.add("avatarContextMenu__userGainForThisConnectionSliderLeftImage");

        let avatarContextMenu__userGainForThisConnectionSliderRightImage = document.createElement("div");
        avatarContextMenu__userGainForThisConnectionSliderRightImage.classList.add("avatarContextMenu__userGainForThisConnectionSliderRightImage");

        avatarContextMenu__userGainForThisConnectionSliderContainer.appendChild(avatarContextMenu__userGainForThisConnectionSliderLeftImage);
        avatarContextMenu__userGainForThisConnectionSliderContainer.appendChild(avatarContextMenu__userGainForThisConnectionSlider);
        avatarContextMenu__userGainForThisConnectionSliderContainer.appendChild(avatarContextMenu__userGainForThisConnectionSliderRightImage);
        avatarContextMenu__userGainForThisConnectionContainer.appendChild(avatarContextMenu__userGainForThisConnectionSliderContainer);

        let avatarContextMenu__userGainForThisConnectionFooter = document.createElement("p");
        avatarContextMenu__userGainForThisConnectionFooter.innerHTML = `<div class="avatarContextMenu__userGainForThisConnectionFooterImage"></div> Controls how loud this person is <strong>for just you</strong>`;
        avatarContextMenu__userGainForThisConnectionFooter.classList.add("avatarContextMenu__userGainForThisConnectionFooter");
        avatarContextMenu__userGainForThisConnectionContainer.appendChild(avatarContextMenu__userGainForThisConnectionFooter);
    }

    onHiFiGainSliderValueChanged(slider: HTMLInputElement, userData: UserData) {
        let gainSliderValue = slider.value;
        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
            let newHiFiGain = userInputController.setHiFiGainFromSliderValue(gainSliderValue);
            
            document.querySelector(".avatarContextMenu__hiFiGainSlider").setAttribute("aria-valuetext", `${Math.round(newHiFiGain * 100)} percent`);
        } else {
            webSocketConnectionController.requestToChangeHiFiGainSliderValue(userData.visitIDHash, gainSliderValue);
        }
        this.maybeUpdateAvatarContextMenu(userData);
    }

    generateHiFiGainUI(userData: UserData) {
        if (typeof (userData.hiFiGain) !== "number") {
            return;
        }

        let avatarContextMenu__hiFiGainContainer = document.createElement("div");
        avatarContextMenu__hiFiGainContainer.classList.add("avatarContextMenu__hiFiGainContainer");
        this.avatarContextMenu.appendChild(avatarContextMenu__hiFiGainContainer);

        let avatarContextMenu__hiFiGainHeader = document.createElement("h3");
        avatarContextMenu__hiFiGainHeader.id = "avatarContextMenu__hiFiGainHeader";
        avatarContextMenu__hiFiGainHeader.innerHTML = `Mic Volume: ${Math.round(userData.hiFiGain * 100)} percent`;
        avatarContextMenu__hiFiGainHeader.classList.add("avatarContextMenu__hiFiGainHeader");
        avatarContextMenu__hiFiGainHeader.setAttribute("aria-label", "Microphone Volume");
        avatarContextMenu__hiFiGainContainer.appendChild(avatarContextMenu__hiFiGainHeader);

        let avatarContextMenu__hiFiGainSliderContainer = document.createElement("div");
        avatarContextMenu__hiFiGainSliderContainer.classList.add("avatarContextMenu__hiFiGainSliderContainer");

        let avatarContextMenu__hiFiGainSlider = document.createElement("input");
        avatarContextMenu__hiFiGainSlider.type = "range";
        avatarContextMenu__hiFiGainSlider.min = "0";
        avatarContextMenu__hiFiGainSlider.max = "41";
        avatarContextMenu__hiFiGainSlider.value = userData.hiFiGainSliderValue;
        avatarContextMenu__hiFiGainSlider.step = "1";
        avatarContextMenu__hiFiGainSlider.classList.add("avatarContextMenu__hiFiGainSlider");
        avatarContextMenu__hiFiGainSlider.setAttribute("aria-labelledby", "avatarContextMenu__hiFiGainHeader");
        avatarContextMenu__hiFiGainSlider.setAttribute("aria-valuemin", "0");
        avatarContextMenu__hiFiGainSlider.setAttribute("aria-valuemax", "41");
        avatarContextMenu__hiFiGainSlider.setAttribute("aria-valuenow", avatarContextMenu__hiFiGainSlider.value);
        avatarContextMenu__hiFiGainSlider.setAttribute("aria-valuetext", `${Math.round(this.hiFiGainFromSliderValue(avatarContextMenu__hiFiGainSlider.value) * 100)} percent`);

        // The `input` event fires as the user is changing the value of the slider.
        avatarContextMenu__hiFiGainSlider.addEventListener("input", (e) => {
            this.onHiFiGainSliderValueChanged((<HTMLInputElement>e.target), userData);
        });

        let avatarContextMenu__hiFiGainSliderLeftImage = document.createElement("div");
        avatarContextMenu__hiFiGainSliderLeftImage.classList.add("avatarContextMenu__hiFiGainSliderLeftImage");
        avatarContextMenu__hiFiGainSliderLeftImage.addEventListener("click", (e) => {
            avatarContextMenu__hiFiGainSlider.value = "0";
            this.onHiFiGainSliderValueChanged(avatarContextMenu__hiFiGainSlider, userData);
        });

        let avatarContextMenu__hiFiGainSliderRightImage = document.createElement("div");
        avatarContextMenu__hiFiGainSliderRightImage.classList.add("avatarContextMenu__hiFiGainSliderRightImage");

        avatarContextMenu__hiFiGainSliderContainer.appendChild(avatarContextMenu__hiFiGainSliderLeftImage);
        avatarContextMenu__hiFiGainSliderContainer.appendChild(avatarContextMenu__hiFiGainSlider);
        avatarContextMenu__hiFiGainSliderContainer.appendChild(avatarContextMenu__hiFiGainSliderRightImage);
        avatarContextMenu__hiFiGainContainer.appendChild(avatarContextMenu__hiFiGainSliderContainer);

        if (userData.visitIDHash !== userDataController.myAvatar.myUserData.visitIDHash) {
            let avatarContextMenu__hiFiGainFooter = document.createElement("p");
            avatarContextMenu__hiFiGainFooter.innerHTML = `<div class="avatarContextMenu__hiFiGainFooterImage"></div> Controls how loud this person is <strong>for everyone</strong>`;
            avatarContextMenu__hiFiGainFooter.classList.add("avatarContextMenu__hiFiGainFooter");
            avatarContextMenu__hiFiGainContainer.appendChild(avatarContextMenu__hiFiGainFooter);
        }
    }

    generateVolumeThresholdUI(userData: UserData) {
        if (userData.visitIDHash !== userDataController.myAvatar.myUserData.visitIDHash || typeof (userData.volumeThreshold) !== "number") {
            return;
        }

        let avatarContextMenu__volumeThresholdContainer = document.createElement("div");
        avatarContextMenu__volumeThresholdContainer.classList.add("avatarContextMenu__volumeThresholdContainer");
        this.avatarContextMenu.appendChild(avatarContextMenu__volumeThresholdContainer);

        let avatarContextMenu__volumeThresholdHeader = document.createElement("h3");
        avatarContextMenu__volumeThresholdHeader.id = "avatarContextMenu__volumeThresholdHeader";
        avatarContextMenu__volumeThresholdHeader.innerHTML = `Mic Threshold: ${userData.volumeThreshold} dB`;
        avatarContextMenu__volumeThresholdHeader.classList.add("avatarContextMenu__volumeThresholdHeader");
        avatarContextMenu__volumeThresholdHeader.setAttribute("aria-label", "Microphone Threshold");
        avatarContextMenu__volumeThresholdContainer.appendChild(avatarContextMenu__volumeThresholdHeader);

        let avatarContextMenu__volumeThresholdSlider = document.createElement("input");
        avatarContextMenu__volumeThresholdSlider.type = "range";
        avatarContextMenu__volumeThresholdSlider.min = "-96";
        avatarContextMenu__volumeThresholdSlider.max = "0";
        avatarContextMenu__volumeThresholdSlider.value = userData.volumeThreshold.toString();
        avatarContextMenu__volumeThresholdSlider.step = "1";
        avatarContextMenu__volumeThresholdSlider.classList.add("avatarContextMenu__volumeThresholdSlider");
        avatarContextMenu__volumeThresholdSlider.setAttribute("aria-labelledby", "avatarContextMenu__volumeThresholdHeader");
        avatarContextMenu__volumeThresholdSlider.setAttribute("aria-valuemin", "-96");
        avatarContextMenu__volumeThresholdSlider.setAttribute("aria-valuemax", "0");
        avatarContextMenu__volumeThresholdSlider.setAttribute("aria-valuenow", avatarContextMenu__volumeThresholdSlider.value);
        avatarContextMenu__volumeThresholdSlider.setAttribute("aria-valuetext", `${avatarContextMenu__volumeThresholdSlider.value} decibels`);

        avatarContextMenu__volumeThresholdSlider.addEventListener("input", (e) => {
            let volumeThresholdSliderValue = parseInt((<HTMLInputElement>e.target).value);
            if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
                userInputController.setVolumeThreshold(volumeThresholdSliderValue);
            } else {
                webSocketConnectionController.requestToChangeVolumeThreshold(userData.visitIDHash, volumeThresholdSliderValue);
            }
            avatarContextMenu__volumeThresholdSlider.setAttribute("aria-valuetext", `${avatarContextMenu__volumeThresholdSlider.value} decibels`);
        });

        avatarContextMenu__volumeThresholdContainer.appendChild(avatarContextMenu__volumeThresholdSlider);
    }

    generateMuteForAllUI(userData: UserData) {
        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash || typeof (userData.hiFiGain) !== "number") {
            return;
        }

        let muteForAllButton = document.createElement("button");
        muteForAllButton.classList.add("avatarContextMenu__muteForAllButton");
        let muteForAllButtonImage = document.createElement("img");
        muteForAllButtonImage.classList.add("avatarContextMenu__muteForAllButtonImage");
        muteForAllButtonImage.src = MuteForEveryoneButtonIcon;
        muteForAllButton.appendChild(muteForAllButtonImage);
        let muteForAllButtonText = document.createElement("span");
        muteForAllButtonImage.classList.add("avatarContextMenu__muteForAllButtonText");
        muteForAllButtonText.innerHTML = "Mute for everyone";
        muteForAllButton.appendChild(muteForAllButtonText);

        muteForAllButton.addEventListener('click', (e) => {
            webSocketConnectionController.requestToMuteAudioInputDevice(userData.visitIDHash);
            muteForAllButtonText.innerHTML = "Muted!";
            setTimeout(() => {
                muteForAllButtonText.innerHTML = "Mute for everyone";
            }, UI.BUTTON_TEXT_CHANGE_TIMEOUT_MS);
        });

        this.avatarContextMenu.appendChild(muteForAllButton);
    }

    createAndShowScreenShareUI(userData: UserData) {
        if (!videoController.providedUserIDToVideoElementMap.has(userData.providedUserID)) {
            return;
        }

        this.hideScreenShareUI();

        this.screenShareContainer.innerHTML = ``;

        let screenShareHeader = document.createElement("div");
        screenShareHeader.classList.add("screenShareHeader", "displayNone");
        this.screenShareContainer.appendChild(screenShareHeader);

        let screenShareHeader__avatarContainer = document.createElement("div");
        screenShareHeader__avatarContainer.classList.add("screenShareHeader__avatarContainer");
        screenShareHeader.appendChild(screenShareHeader__avatarContainer);

        let screenShareHeader__avatar = document.createElement("button");
        screenShareHeader__avatar.classList.add("screenShareHeader__avatar");
        screenShareHeader__avatar.style.backgroundColor = userData.colorHex;
        screenShareHeader__avatar.style.borderColor = userData.colorHex;
        if (userData.profileImageEl && userData.profileImageEl.complete) {
            screenShareHeader__avatar.style.backgroundImage = `url(${userData.profileImageURL})`;
        }
        screenShareHeader__avatar.addEventListener("click", () => {
            this.showAvatarContextMenu(userData);
        });
        screenShareHeader__avatarContainer.appendChild(screenShareHeader__avatar);

        let screenShareHeader__textContainer = document.createElement("div");
        screenShareHeader__textContainer.classList.add("screenShareHeader__textContainer");
        screenShareHeader__avatarContainer.appendChild(screenShareHeader__textContainer);

        let screenShareHeader__displayName = document.createElement("p");
        screenShareHeader__displayName.classList.add("screenShareHeader__displayName");
        screenShareHeader__displayName.innerHTML = userData.displayName;
        screenShareHeader__textContainer.appendChild(screenShareHeader__displayName);

        let screenShareHeader__bottomText = document.createElement("p");
        screenShareHeader__bottomText.classList.add("screenShareHeader__bottomText");
        screenShareHeader__bottomText.innerHTML = "is sharing their screen";
        screenShareHeader__textContainer.appendChild(screenShareHeader__bottomText);

        let screenShareHeader__exitContainer = document.createElement("button");
        screenShareHeader__exitContainer.classList.add("screenShareHeader__exitContainer");
        screenShareHeader__exitContainer.addEventListener("click", () => {
            this.hideScreenShareUI();
        });
        screenShareHeader.appendChild(screenShareHeader__exitContainer);

        let screenShareHeader__exitButton = document.createElement("button");
        screenShareHeader__exitButton.classList.add("screenShareHeader__exitButton");
        screenShareHeader__exitContainer.appendChild(screenShareHeader__exitButton);

        let screenShareHeader__exitButtonText = document.createElement("button");
        screenShareHeader__exitButtonText.classList.add("screenShareHeader__exitButtonText");
        screenShareHeader__exitButtonText.innerHTML = "exit full screen";
        screenShareHeader__exitContainer.appendChild(screenShareHeader__exitButtonText);

        this.screenShareContainer.appendChild(videoController.providedUserIDToVideoElementMap.get(userData.providedUserID));
        
        this.screenShareContainer.classList.remove("displayNone");
        this.showScreenShareHeader();
    }

    showScreenShareHeader() {
        let screenShareHeader = document.querySelector(".screenShareHeader");
        if (!screenShareHeader) {
            return;
        }

        screenShareHeader.classList.remove("displayNone");

        if (this.showScreenShareHeaderTimeout) {
            clearTimeout(this.showScreenShareHeaderTimeout);
            this.showScreenShareHeaderTimeout = undefined;
        }

        this.showScreenShareHeaderTimeout = setTimeout(() => {
            this.showScreenShareHeaderTimeout = undefined;
            screenShareHeader.classList.add("screenShareHeader--out");

            setTimeout(() => {
                screenShareHeader.classList.remove("screenShareHeader--out");
                screenShareHeader.classList.add("displayNone");
            }, 250);
        }, 5000);
    }

    hideScreenShareUI() {
        let videoContainer = document.querySelector(".videoContainer");
        if (videoContainer) {
            let allVideoNodes = this.screenShareContainer.querySelectorAll("video");
            allVideoNodes.forEach((videoNode) => {
                videoContainer.appendChild(videoNode);
            });
        }

        this.screenShareContainer.classList.add("displayNone");
    }

    showAvatarContextMenu(userData: UserData) {
        roomController.hideRoomList();

        let topBar = document.querySelector(".topBar");
        if (topBar) {
            topBar.classList.add("displayNone");
        }
        let bottomRightControlsContainer = document.querySelector(".bottomRightControlsContainer");
        if (bottomRightControlsContainer) {
            bottomRightControlsContainer.classList.add("displayNone");
        }

        this.avatarContextMenu.innerHTML = ``;

        this.generateHeader(userData);
        this.generateEchoCancellationUI(userData);
        this.generateAGCUI(userData);
        this.generateNoiseSuppressionUI(userData);
        this.generateStereoInputUI(userData);
        this.generateUserGainForThisConnectionUI(userData);
        this.generateHiFiGainUI(userData);
        this.generateVolumeThresholdUI(userData);
        this.generateMuteForAllUI(userData);
        this.generateCloseButtonUI();

        this.avatarContextMenu.setAttribute('visit-id-hash', userData.visitIDHash);

        this.modalBackground.classList.remove("displayNone");
        this.avatarContextMenu.classList.remove("displayNone");

        if (userData.visitIDHash === userDataController.myAvatar.myUserData.visitIDHash) {
            this.avatarContextMenu.classList.add("avatarContextMenu--mine");
            this.hasCompletedTutorial = true;
            localStorage.setItem("hasCompletedTutorial", "true");

            let bottomControlsContainer = document.querySelector(".bottomControlsContainer");
            if (bottomControlsContainer) {
                bottomControlsContainer.classList.add("displayNone");
            }
        } else {
            this.modalBackground.classList.add("modalBackground--mobileFullscreen");
        }

        accessibilityController.speak(`Showing Profile dialog for ${userData.displayName}.`, "polite", 250);
        this.avatarContextMenu.focus();
        document.querySelector(".normalModeCanvas").setAttribute("tabIndex", "-1");
    }

    maybeUpdateAvatarContextMenu(userData: UserData) {
        if (this.avatarContextMenu.getAttribute('visit-id-hash') !== userData.visitIDHash) {
            return;
        }

        (<HTMLHeadingElement>this.avatarContextMenu.querySelector('.avatarContextMenu__displayName')).innerText = userData.displayName ? userData.displayName : userData.providedUserID;

        let avatarContextMenu__avatarCircle = <HTMLElement>document.querySelector(".avatarContextMenu__avatarCircle");
        if (avatarContextMenu__avatarCircle) {
            avatarContextMenu__avatarCircle.style.backgroundColor = userData.colorHex;
            avatarContextMenu__avatarCircle.style.borderColor = userData.colorHex;

            if (userData.profileImageEl && userData.profileImageEl.complete) {
                avatarContextMenu__avatarCircle.style.backgroundImage = `url(${userData.profileImageURL})`;
                avatarContextMenu__avatarCircle.style.borderColor = userData.colorHex;

                let avatarContextMenu__removeProfileImageButton = document.querySelector(".avatarContextMenu__removeProfileImageButton");
                let avatarContextMenu__avatarRepresentation = document.querySelector(".avatarContextMenu__avatarRepresentation");
                if (!avatarContextMenu__removeProfileImageButton && avatarContextMenu__avatarRepresentation) {
                    let removeProfileImageButton = document.createElement("button");
                    removeProfileImageButton.classList.add("avatarContextMenu__removeProfileImageButton");
                    removeProfileImageButton.setAttribute("aria-label", "Remove Profile Photo");
                    removeProfileImageButton.innerHTML = `Remove`;
                    removeProfileImageButton.addEventListener("click", (e) => {
                        userDataController.myAvatar.onMyProfileImageURLChanged("");
                    });
                    avatarContextMenu__avatarRepresentation.appendChild(removeProfileImageButton);
                }
            } else {
                avatarContextMenu__avatarCircle.style.backgroundImage = "none";
            }
        }

        let echoCancellationCheckbox = this.avatarContextMenu.querySelector(".echoCancellationCheckbox");
        if (echoCancellationCheckbox) {
            (<HTMLInputElement>echoCancellationCheckbox).checked = userData.echoCancellationEnabled;
        }

        let agcCheckbox = this.avatarContextMenu.querySelector(".agcCheckbox");
        if (agcCheckbox) {
            (<HTMLInputElement>agcCheckbox).checked = userData.agcEnabled;
        }

        let noiseSuppressionCheckbox = this.avatarContextMenu.querySelector(".noiseSuppressionCheckbox");
        if (noiseSuppressionCheckbox) {
            (<HTMLInputElement>noiseSuppressionCheckbox).checked = userData.noiseSuppressionEnabled;
        }

        let avatarContextMenu__hiFiGainSlider = <HTMLInputElement>this.avatarContextMenu.querySelector(".avatarContextMenu__hiFiGainSlider");
        let avatarContextMenu__hiFiGainHeader = <HTMLHeadingElement>this.avatarContextMenu.querySelector(".avatarContextMenu__hiFiGainHeader");
        if (avatarContextMenu__hiFiGainSlider) {
            avatarContextMenu__hiFiGainSlider.value = userData.hiFiGainSliderValue;
            avatarContextMenu__hiFiGainHeader.innerHTML = `Mic Volume: ${Math.round(userData.hiFiGain * 100)}%`;
        }

        let avatarContextMenu__userGainForThisConnectionSlider = <HTMLInputElement>this.avatarContextMenu.querySelector(".avatarContextMenu__userGainForThisConnectionSlider");
        let avatarContextMenu__userGainForThisConnectionHeader = <HTMLHeadingElement>this.avatarContextMenu.querySelector(".avatarContextMenu__userGainForThisConnectionHeader");
        if (avatarContextMenu__userGainForThisConnectionSlider) {
            avatarContextMenu__userGainForThisConnectionSlider.value = userData.userGainForThisConnection.toString();
            avatarContextMenu__userGainForThisConnectionHeader.innerHTML = `Volume (Personal): ${Math.round(userData.userGainForThisConnection * 100)}%`;
        }

        let avatarContextMenu__volumeThresholdSlider = <HTMLInputElement>this.avatarContextMenu.querySelector(".avatarContextMenu__volumeThresholdSlider");
        let avatarContextMenu__volumeThresholdHeader = <HTMLHeadingElement>this.avatarContextMenu.querySelector(".avatarContextMenu__volumeThresholdHeader");
        if (avatarContextMenu__volumeThresholdSlider) {
            avatarContextMenu__volumeThresholdSlider.value = userData.volumeThreshold.toString();
            avatarContextMenu__volumeThresholdHeader.innerHTML = `Mic Threshold: ${userData.volumeThreshold} dB`;
        }
    }

    hiFiGainFromSliderValue(hiFiGainSliderValue: string) {
        // Make the UI look nice with a default gain slider value of 1.0 instead of 1.05...
        if (hiFiGainSliderValue === "21") {
            return 1.0;
        } else if (hiFiGainSliderValue === "0") {
            return 0.0;
        } else {
            return Utilities.logarithmicScale(parseInt(hiFiGainSliderValue), 1, 41, 1, 110) / 10;
        }
    }
}

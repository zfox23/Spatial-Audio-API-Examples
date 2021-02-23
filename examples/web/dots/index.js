const Version = "g.1.20";
// Provide publish/subscribe communications with others. This could be to a server, p2p, etc.
// Using a pub/sub discipline is up to the application, but it happens to work well here.
class Client extends Croquet.View {
    subscribeToMessages(messages, scope = this.model.sessionAvatarId, ) { // A convience.
        messages.forEach(message => this.subscribe(scope, message, this[message]));
    }
}
class Avatar extends Client {
    constructor(options) {
        super();
        let {room, model, streamingAvatarId=''} = options,
            streamingAvatar = room.avatars[streamingAvatarId],
            fragment = avatarTemplate.content.cloneNode(true);
        // Capture a bunch of named elements within the cloned fragment.
        ['Avatar', 'Picture', 'Volume', 'Button', 'NameDisplay', 'Self', 'Countdown']
            .forEach(tagName => this['dom' + tagName] = fragment.querySelector(tagName));
        Object.assign(this, {
            room, model, streamingAvatar,
            audioAvatars: {},
            audioSources: {}
        });
        this.domNameDisplay.innerText = model.name;
        this.domVolume.style.backgroundColor = model.color;
        this.domButton.onclick = event => this.kick(event);
        this.constructor.domAvatars.set(this.domAvatar, this);
        this.redraw();
        map.append(this.domAvatar);
        if (Avatar.mine && Avatar.mine.model.canKickOthers) {
            this.showMeICanKick();
        }
        if (model.image) this.setImage(model.image);
        if (streamingAvatar || model.sessionAvatarId === this.viewId) {
            let initialHiFiAudioAPIData = this.hifiData(this.model.x, this.model.y);
            this.communicator = new HighFidelityAudio.HiFiCommunicator({initialHiFiAudioAPIData});
            this.connect();
        }
        if (streamingAvatar) {
            streamingAvatar.audioAvatars[model.sessionAvatarId] = this;
            this.makeDraggable();
            this.canPickFile("image/*");
            this.domButton.classList.remove('disabled');
            let source = this.audioSource;
            if (source) {
                source.source.start(0);
                this.setInputAudio(source.stream, source.isStereo);
            }
        }
        this.subscribeToMessages(['exit', 'redraw', 'setKickState', 'setImage']);
    }
    get audioSource() { return this.streamingAvatar && this.streamingAvatar.audioSources[this.model.sessionAvatarId]; }
    hifiData(x, y) {
        const PixelsToMeters = 1/40;
        return new HighFidelityAudio.HiFiAudioAPIData({
            position: new HighFidelityAudio.Point3D({x: x * PixelsToMeters, y:0, z: y * PixelsToMeters}),
            orientationEuler: new HighFidelityAudio.OrientationEuler3D({ "pitchDegrees": 0, "yawDegrees": 0, "rollDegrees": 0 })
        });
    }
    setInputAudio(stream, stereo = false) {
        this.gotInputAudio = true;
        this.communicator.setInputAudioMediaStream(stream, stereo);
    }
    async makeJWT(applicationUserId) { // A production app would likely require the user to log in to a server, which would provide the JWT token.
        let payload = {
                app_id: '6023060e-1668-483f-bd6f-e7ff707b8918',
                space_id: this.room.model.hifiRoomId,
                user_id: applicationUserId,
                stack: 'audionet-mixer-api-alpha-01'
            };
        // If a client knew the secret, the client could generate the JWT using this in the .html
        // <script src="https://kjur.github.io/jsrsasign/jsrsasign-latest-all-min.js">
        // and:
        /*
        let header = {alg: 'HS256', typ: 'JWT'},
            secret = YOUR_ACCOUNT_SECRET;
        return KJUR.jws.JWS.sign("HS256", JSON.stringify(header), JSON.stringify(payload), secret);
        */
        // That's the easiest thing for running your own demo, but, of course, anyone who looked at the source could connect at your expense.
        // Below, we contact a server that only responds to this demo. 
        let response = await fetch('https://lit-inlet-37897.herokuapp.com?payload=' + JSON.stringify(payload));
        return await response.json();
    }
    get hifiUserId() {  // Could be anything unique, such as this.model.sessionAvatarId.
        return `${this.model.color} ${this.model.name}`;
    }
    async connect() {
        let jwt = await this.makeJWT(this.hifiUserId);
        this.communicator.connectToHiFiAudioAPIServer(jwt).then(response => this.connected(response));
    }
    connected(response) { console.info('HiFidelityAudio connect response', response); }
    redraw({x = this.model.x, y = this.model.y, sourceId} = {}) { // after x/y change
        if (sourceId === this.viewId) return; // We've already done it.
        if (this.communicator) this.communicator.updateUserDataAndTransmit(this.hifiData(x, y));
        this.domAvatar.style.left = (x - this.constructor.baseRadius) + 'px';
        this.domAvatar.style.top = (y - this.constructor.baseRadius) + 'px';
    }
    setKickState(state) {
        this.domCountdown.className = state === 0 ? '' : 'counting';
        this.domCountdown.querySelector('span').innerHTML = state;
    }
    showMeICanKick() { // Enable the button on my view of this user.
        this.domButton.classList.remove('disabled');
    }
    set volume(v) { // Volume comes directly from High Fidelity for all users.
        // Unlike x and y, we do not bother to pub/sub it through to each peer.
        if (typeof(v) !== 'number') return;
        const Min_displayed_dB = -50,
              Max_displayed_dB = 30,
              Range = Max_displayed_dB - Min_displayed_dB,
              Max_pixel_expansion = 30;
        let clampedV = Math.max(Min_displayed_dB, Math.min(Max_displayed_dB, v)),
            positiveV = clampedV - Min_displayed_dB,
            fractionOfRange = positiveV / Range,
            addendum = fractionOfRange * Max_pixel_expansion,
            radius = this.constructor.baseRadius + addendum;
        this.domVolume.style.width = this.domVolume.style.height = (radius * 2) + 'px';
    }
    enableSelfLabel(isEnabled) {
        this.domAvatar.querySelector('self').classList[isEnabled ?  'remove' : 'add']('hidden');
    }
    kick(event) { // Remove this avatar, and any associated music.
        ourBehaviorOnly(event);
        if (this !== Avatar.mine && !Avatar.mine.model.canKickOthers && !this.streamingAvatar) {
            alert('You cannot kick other users until several seconds after you have participated by speaking.');
            return;
        }
        Object.values(this.audioAvatars).forEach(avatar => avatar.kick(event));
        let senderToReport = this != Avatar.mine && Avatar.mine.hifiUserId;
        this.publish(this.sessionId, 'view-exit', {sender: senderToReport, sessionAvatarId: this.model.sessionAvatarId});
    }
    setImage(url = this.model.image) {
        this.domPicture.style.backgroundImage = `url(${url})`;
    }
    exit() {
        if (this.streamingAvatar) {
            this.audioSource && this.audioSource.source.stop();
            delete this.streamingAvatar.audioSources[this.model.sessionAvatarId];
            delete this.streamingAvatar.audioAvatars[this.model.sessionAvatarId];
        }
        this.domAvatar.remove();
        this.detach();
        this.room.destroyAvatar(this);
    }
    canPickFile(accepts) {
        this.domAvatar.onclick = event => this.pickFile(event, accepts);
    }
    pickFile(clickEvent, accepts) {
        if (this.didDrag) return; // Not really a click.
        filePicker.setAttribute('accept', accepts);
        // It can be confusing if the user picks the same file and nothing happens, because there is no change.
        filePicker.onchange = _ => null;
        filePicker.value = "";
        // Create a duck-typed event from the clickEvent, so that the drop goes to the right place.
        let {clientX, clientY} = clickEvent,
            noop = _ => null;
        filePicker.onchange = changeEvent => drop({
            stopPropagation: noop,
            preventDefault: noop,
            dataTransfer: filePicker,
            target: this.domPicture,
            clientX, clientY
        });
        filePicker.click();
    }

    // All the rest of this class is just to support dragging by mouse or touch!
    makeDraggable() {
        // Drag start/end & move events aren't supported in Android, so use mouse/touch events.
        this.domAvatar.onmousedown = this.domAvatar.ontouchstart = event => this.startDrag(event);
        this.domAvatar.style.cursor = "move";
    }
    captureEventPosition(event, positionName) { // Store event[positionName] in this.
        let source = event.touches ? event.touches[0] : event;
        return this[positionName] = source[positionName];
    }
    updateDimension(event, positionName) { // capture new positionName and return the delta.
        let from = this[positionName];
        return this.captureEventPosition(event, positionName) - from;
    }
    startDrag(event) { // Capture event position and set up remaining handlers.
        this.captureEventPosition(event, 'clientX');
        this.captureEventPosition(event, 'clientY');
        this.didDrag = false; // So that we can distinguish clicks.
        this.x = this.model.x;
        this.y = this.model.y;
        // Define move/end on whole document, in case user moves faster than the domAvatar.
        document.onmousemove = document.ontouchmove = event => this.drag(event);
        document.onmouseup = document.ontouchend = event => this.stopDrag(event);
        for (let element of document.getElementsByTagName('avatar')) { // Keep ours on top, locally.
            element.style.zIndex = (element == this.domAvatar) ? 1 : "auto";
        }
    }
    drag(event) { // On each move, update position.
        this.didDrag = true;
        let {x, y} = this; // From startDrag.
        x += this.updateDimension(event, 'clientX');
        y += this.updateDimension(event, 'clientY');
        let data = {x, y};
        Object.assign(this, data);
        this.redraw(data); // local
        // Now tell everyone.
        data.sourceId = Avatar.mine.model.sessionAvatarId;
        this.publish(this.model.sessionAvatarId, 'setPosition', data);
    }
    stopDrag(event) { // Tear down handlers.
        document.onmouseup = document.onmousemove = null;
    }
    eventPositionInViewport(event, positionName) { // Mouse and touch events are slightly different.
        let source = event.touches ? event.touches[0] : event;
        return source[positionName];
    }
}
Avatar.baseRadius = 50; // Safari doesn't allow `static var = val;` syntax in classes yet.
Avatar.domAvatars = new WeakMap(); // Map of avatar elements back to Avatar Client objects.

class MyAvatar extends Avatar {
    constructor(...parameters) {
        super(...parameters);
        this.enableSelfLabel(true);
        this.makeDraggable();
        this.domButton.classList.remove('disabled');
        this.startAudio();
    }
    startAudio() {
        if (this.gotInputAudio) return;
        let bestAudioConstraints = HighFidelityAudio.getBestAudioConstraints();
        navigator.mediaDevices.getUserMedia({ audio: bestAudioConstraints, video: false })
            .then(stream => {
                this.setInputAudio(stream);
                this.canPickFile(".mp3,.jpg,.jpeg,.png,image/*,audio/*");
            })
            .catch(console.error); // No harm. User can try again.
    }
    connected(response) { // Connect the communicator output to the player.
        super.connected(response);
        player.srcObject = this.communicator.getOutputAudioMediaStream();
        player.play();
        let subscription = new HighFidelityAudio.UserDataSubscription({
            "components": [
                HighFidelityAudio.AvailableUserDataSubscriptionComponents.VolumeDecibels
            ],
            "callback": data => this.updateVolumes(data)
        });
        // Each browser has one MyAvatar that subscribes to volumes for all, including music "avatars".
        this.communicator.addUserDataSubscription(subscription);
    }
    updateVolumes(data) {
        let avatars = this.room.avatarsByName,
            mine = Avatar.mine;
        data.forEach(datum => {
            let avatar = avatars[datum.providedUserID];
            if (!avatar) return;
            avatar.volume = datum.volumeDecibels; // No need to re-publish to server/model/peer/records.
            if (avatar === mine && datum.volumeDecibels > -30) { // Start countdown to enable kick, if needed.
                if (typeof(this.model.kickState) !== 'number') { // Not already counting or counted.
                    this.publish(this.model.sessionAvatarId, 'setKickState', 10);
                }
            }
        });
    }
    exit(sender) {
        player.pause();
        this.communicator.disconnectFromHiFiAudioAPIServer();
        super.exit(sender);
        if (sender) alert(`You got kicked out by ${sender}.`);
        LobbySession.view.returnToLobby();
    }
    setKickState(state) {
        super.setKickState(state);
        if (state === 0) {
            Object.values(this.room.avatars).forEach(avatar => avatar.showMeICanKick());
        }
    }
    stopDrag(event) {
        super.stopDrag(event);
        this.enableSelfLabel(false);
        this.startAudio();
    }
    async image(file, event) { // Handle an image.
        let dataURL = await this.fileResult(file, 'readAsDataURL'),
            target = event.target;
        // If we drop on the avatar or text of ourself or any music, that's the target.
        while (target !== map && target !== this.domPicture) {
            let avatar = this.constructor.domAvatars.get(target.parentNode);
            if (avatar && avatar.streamingAvatar) break;
            target = target.parentNode;
        }
        let avatar = this.constructor.domAvatars.get(target.parentNode),
            scope = avatar ? avatar.model.sessionAvatarId : this.sessionId;
        this.publish(scope, 'storeImage', dataURL);
    }
    async audio(file, event) { // Handle an audio file.
        let context = this.audioContext || (this.audioContext = new (window.AudioContext || window.webkitAudioContext)());
        let result = await this.fileResult(file, 'readAsArrayBuffer');
        context.decodeAudioData(result, buffer => {
            let audioSource = context.createBufferSource(),
                destination = context.createMediaStreamDestination(); // has destination.stream property
            audioSource.buffer = buffer;
            audioSource.connect(destination);
            let ourId = this.model.sessionAvatarId,
                sessionAvatarId = Object.keys(this.audioSources).length + 'm' + ourId,
                name = `${this.model.name}'s ${file.name.replace('.mp3', '')}`;
            this.audioSources[sessionAvatarId] = {
                source: audioSource,
                stream: destination.stream,
                isStereo: buffer.numberOfChannels === 2
            };
            let {clientX:x, clientY:y} = event;
            this.publish(this.sessionId, 'addAvatarRecord', {
                sessionAvatarId, name, x, y,
                color: this.model.color,
                streamingAvatarId: ourId
            });
        });
    }
    fileResult(file, operation) { // Return a promise for the result of operation on file.
        return new Promise(resolve => {
            let reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader[operation](file);
        });
    }
}

function ourBehaviorOnly(event) { // E.g., don't let browser create a new tab with media.
    event.stopPropagation();
    event.preventDefault();
}
function drop(event) {
    ourBehaviorOnly(event);
    // Clipboard would "work", but only for editable targets, and only if doesn't take too long, and only if it isn't music on Apple, and...
    let transfer = event.dataTransfer || event.clipboardData;
    for (let file of transfer.files) {
        let type = file.type.split('/')[0];
        if (Avatar.mine[type]) {
            Avatar.mine[type](file, event);
        } else {
            console.error(`Unrecognized mime type ${file.type} for ${file.name}.`);
        }
    }
}

class Room extends Client {
    createAvatar({sessionAvatarId, ...options}) {
        let model = this.model.avatars.get(sessionAvatarId),
            // Croquet-specific: All View objects have viewId set to the sessionAvatarId of this browser.
            isOurs = sessionAvatarId === this.viewId,
            kind = isOurs ? MyAvatar : Avatar,
            avatar = new kind({room:this, model, ...options});
        if (isOurs) Avatar.mine = avatar;
        this.avatars[sessionAvatarId] = avatar;
        this.avatarsByName[avatar.hifiUserId] = avatar;
        return avatar;
    }
    setImage(url = this.model.image) {
        map.style.backgroundImage = `url(${url})`;
    }
    destroyAvatar(avatar) {
        delete this.avatars[avatar.model.sessionAvatarId];
        delete this.avatarsByName[avatar.hifiUserId]
    }
    detach() { // Clean up all Clients, WITHOUT publishing anything to the records.
        super.detach();
        Object.values(this.avatars).forEach(avatar => avatar.detach());
    }
    constructor(roomRecord) {
        super(roomRecord);
        this.model = roomRecord;
        this.avatars = {};
        this.avatarsByName = {};        
        if (roomRecord.image) this.setImage();
        this.subscribeToMessages(['createAvatar', 'setImage'], this.sessionId);
        for (let [sessionAvatarId, record] of roomRecord.avatars) { // Instantiate our copy of everyone already in the record.
            this.createAvatar({sessionAvatarId, ...record});
        }
    }
}

// Provides the synchronized data, shared identically among all users.
// You can think of this as the communciations to a database record on the server combined with business logic,
// or as the model in a model-view system. In any case, all the data here is serializable over the wire - simple
// data types or pointers to other records. Again, we're using pub/sub to communicate with the Client objects.
class Record extends Croquet.Model {
    subscribeToMessages(messages, scope = this.sessionAvatarId, ) { // A convience.
        messages.forEach(message => this.subscribe(scope, message, this[message.replace('view-', '')]));
    }
}
class RoomRecord extends Record {
    // Keeps track of the avilable names and colors, and the users currently in the room (creating UserRecords as needed).
    init(options) { // Initialize when there's no snapshot.
        super.init(options);
        this.hifiRoomId = options.roomId;
        this.avatars = new Map(); // sessionAvatarIds to AvatarRecords of those currently in the room. // FIXME: Map => Object.
        this.availableColors = ['AliceBlue', 'AntiqueWhite', 'Aqua', 'Aquamarine', 'Azure', 'Beige', 'Bisque', 'Black', 'BlanchedAlmond', 'Blue', 'BlueViolet', 'Brown', 'BurlyWood', 'CadetBlue', 'Chartreuse', 'Chocolate', 'Coral', 'CornflowerBlue', 'Cornsilk', 'Crimson', 'Cyan', 'DarkBlue', 'DarkCyan', 'DarkGoldenRod', 'DarkGrey', 'DarkGreen', 'DarkKhaki', 'DarkMagenta', 'DarkOliveGreen', 'DarkOrange', 'DarkOrchid', 'DarkRed', 'DarkSalmon', 'DarkSeaGreen', 'DarkSlateBlue', 'DarkSlateGrey', 'DarkTurquoise', 'DarkViolet', 'DeepPink', 'DeepSkyBlue', 'DimGrey', 'DodgerBlue', 'FireBrick', 'FloralWhite', 'ForestGreen', 'Fuchsia', 'Gainsboro', 'GhostWhite', 'Gold', 'GoldenRod', 'Grey', 'Green', 'GreenYellow', 'HoneyDew', 'HotPink', 'IndianRed', 'Indigo', 'Ivory', 'Khaki', 'Lavender', 'LavenderBlush', 'LawnGreen', 'LemonChiffon', 'LightBlue', 'LightCoral', 'LightCyan', 'LightGoldenRodYellow', 'LightGrey', 'LightGreen', 'LightPink', 'LightSalmon', 'LightSeaGreen', 'LightSkyBlue', 'LightSlateGrey', 'LightSteelBlue', 'LightYellow', 'Lime', 'LimeGreen', 'Linen', 'Magenta', 'Maroon', 'MediumAquaMarine', 'MediumBlue', 'MediumOrchid', 'MediumPurple', 'MediumSeaGreen', 'MediumSlateBlue', 'MediumSpringGreen', 'MediumTurquoise', 'MediumVioletRed', 'MidnightBlue', 'MintCream', 'MistyRose', 'Moccasin', 'NavajoWhite', 'Navy', 'OldLace', 'Olive', 'OliveDrab', 'Orange', 'OrangeRed', 'Orchid', 'PaleGoldenRod', 'PaleGreen', 'PaleTurquoise', 'PaleVioletRed', 'PapayaWhip', 'PeachPuff', 'Peru', 'Pink', 'Plum', 'PowderBlue', 'Purple', 'RebeccaPurple', 'Red', 'RosyBrown', 'RoyalBlue', 'SaddleBrown', 'Salmon', 'SandyBrown', 'SeaGreen', 'SeaShell', 'Sienna', 'Silver', 'SkyBlue', 'SlateBlue', 'SlateGrey', 'Snow', 'SpringGreen', 'SteelBlue', 'Tan', 'Teal', 'Thistle', 'Tomato', 'Turquoise', 'Violet', 'Wheat', 'White', 'WhiteSmoke', 'Yellow', 'YellowGreen'];
        this.availableNames = ['Nile', 'Amazon', 'Yangtze ', 'Mississippi', 'Yenisei', 'Ob', 'Congo', 'Amur', 'Lena', 'Mekong', 'Mackenzie', 'Brahmaputra', 'Murray', 'Tocantins', 'Volg', 'Indus', 'Euphrates', 'Madeira', 'Purús', 'Yukon', 'Salween', 'Tunguska', 'Danube', 'Zambezi', 'Vilyuy', 'Araguaia', 'Ganges', 'Japurá', 'Nelson', 'Paraguay', 'Kolyma', 'Pilcomayo', 'Ishim', 'Juruá', 'Ural', 'Arkansa', 'Colorado', 'Olenyok', 'Dniepe', 'Aldan', 'Ubangi', 'Negro', 'Columbia', 'Pearl', 'Ayeyarwady', 'Kasai', 'Ohio', 'Orinoco', 'Tarim', 'Xingu', 'Salado', 'Vitim', 'Tigris', 'Songhua', 'Tapajós', 'Don', 'Pechora', 'Kama', 'Limpopo', 'Chulym', 'Guaporé', 'Indigirka', 'Snake','Senegal', 'Uruguay', 'Churchill', 'Khatanga', 'Okavango', 'Volta', 'Beni', 'Platte', 'Tobol', 'Alazeya', 'Jubba', 'Içá', 'Magdalena', 'Han', 'Kura', 'Oka', 'Murray', 'Guaviare', 'Pecos', 'Murrumbidgee', 'Yenisei', 'Godavari', 'Belaya', 'Cooper', 'Marañón', 'Dniester', 'Benue', 'Ili', 'Warburton', 'Sutlej', 'Yamuna', 'Vyatka', 'Fraser', 'Brazos', 'Liao', 'Lachlan', 'Yalong', 'Iguaçu', 'Olyokma', 'Dvina', 'Krishna', 'Iriri', 'Narmada', 'Lomami', 'Ottawa', 'Lerma', 'Elbe', 'Zeya', 'Juruena', 'Rhine', 'Athabasca', 'Canadian', 'Saskatchewan', 'Vistula', 'Vaal', 'Shire', 'Ogooué', 'NenKızıl', 'Markha', 'Green', 'Milk', 'Chindwin', 'Sankuru', 'Wu', 'James', 'Kapuas', 'Desna', 'Helmand', 'Tietê', 'Vychegda', 'Sepik', 'Cimarron', 'Anadyr', 'Jialing', 'Liard', 'Cumberland', 'Huallaga', 'Kwango', 'Draa', 'Gambia', 'Tyung', 'Chenab', 'Yellowstone', 'Ghaghara', 'Huai', 'Aras', 'Chu', 'Bermejo', 'Fly', 'Kuskokwim', 'Tennessee', 'Oder', 'Aruwimi', 'Daugava', 'Gila', 'Loire', 'Essequibo', 'Khoper', 'Tagus', 'Flinders'];
        this.subscribeToMessages(['view-join', 'view-exit', 'addAvatarRecord', 'storeImage'], this.sessionId);
    }
    storeImage(url) {
        this.image = url;
        this.publish(this.sessionId, 'setImage');
    }
    addAvatarRecord(options) {
        let {sessionAvatarId} = options;
        this.avatars.set(sessionAvatarId, AvatarRecord.create(options));
        this.publish(this.sessionId, 'createAvatar', options);
    }
    join(sessionAvatarId) {
        let name = this.availableNames.shift(),
            color = this.availableColors.shift(),
            x = this.random() * 250 + 50,
            y = this.random() * 550 + 50;
        this.addAvatarRecord({sessionAvatarId, name, color, x, y});
    }
    exit(sessionAvatarId) {
        let sender;
        if (sessionAvatarId.hasOwnProperty('sender')) { // can be a string or object
            sender = sessionAvatarId.sender;
            sessionAvatarId = sessionAvatarId.sessionAvatarId;
        }
        let avatarRecord = this.avatars.get(sessionAvatarId);
        if (avatarRecord && !avatarRecord.streamingAvatarId) {
            this.availableColors.push(avatarRecord.color);
            this.availableNames.push(avatarRecord.name);
        }
        this.publish(sessionAvatarId, 'exit', sender);
        this.avatars.delete(sessionAvatarId);
    }
}
class AvatarRecord extends Record {
    init({sessionAvatarId, name, color, x, y, streamingAvatarId, ...options}) {
        super.init(options);
        Object.assign(this, {sessionAvatarId, name, color, x, y, streamingAvatarId});
        this.subscribeToMessages(['setPosition', 'setKickState', 'storeImage']);
    }
    storeImage(url) {
        this.image = url;
        this.publish(this.sessionAvatarId, 'setImage');
    }
    setPosition({x, y, sourceId}) {
        Object.assign(this, {x, y});
        this.publish(this.sessionAvatarId, 'redraw', {sourceId});
    }
    setKickState(state) {
        this.kickState = state;
        if (state > 0) {
            this.future(1000).publish(this.sessionAvatarId, 'setKickState', --state);
        }
    }
    get canKickOthers() {
        return this.kickState === 0;
    }
}
// Now for the lobby. Just four messages!
class LobbyRecord extends Record {
    init(options) {
        super.init(options);
        this.users = {}; // lobby session user id => room id
        this.rooms = Object.fromEntries(options.roomNames.map(n => [n, 0]));
        this.subscribeToMessages(['view-join', 'view-exit', 'updateModel'], this.sessionId);
    }
    updateModel({userId, roomId}) {
        let oldRoomId = this.users[userId];
        if (oldRoomId) {
            this.rooms[oldRoomId] = Math.max(0, this.rooms[oldRoomId] - 1); // Shouldn't go negative. Bug :-)
            this.publish(this.sessionId, 'updateDisplay', oldRoomId);
        }
        if (roomId) {
            this.users[userId] = roomId; // We need to keep track, in case they close the tab from a room.
            this.rooms[roomId]++
            this.publish(this.sessionId, 'updateDisplay', roomId);
        }
    }
    join(userId) { // Everyone enters through TheLobby.
        this.updateModel({userId, roomId: 'TheLobby'});
    }
    exit(userId) { // Completely exiting the browser tab, from the lobby or any room.
        this.updateModel({userId});
    }
}
class LobbyUI extends Client {
    constructor(model) {
        super(model);
        this.model = model;
        this.subscribe(this.sessionId, 'updateDisplay', this.updateDisplay);
    }
    updateDisplay() {
        let total = 0, rooms = this.model.rooms;
        for (let roomId in rooms) {
            let concurrency = rooms[roomId],
                room = document.getElementById(roomId),
                element = room.getElementsByTagName('concurrency')[0];
            element.innerText = this.model.rooms[roomId];
            total += concurrency;
        }
        totalConcurrency.innerText = total;
    }
    returnToLobby() {
        if (!this.roomSession) return; // old message from an earlier session.
        this.roomSession.leave();
        delete this.roomSession;
        this.publish(this.sessionId, 'updateModel', {userId: this.viewId, roomId: 'TheLobby'});        
        rooms.classList.remove('hidden');
        map.remove();
    }
    async enterRoom(roomId) {
        this.publish(this.sessionId, 'updateModel', {userId: this.viewId, roomId});
        rooms.classList.add('hidden');
        // Easist way to maintain rooms is to rebuild them as needed.
        map = mapTemplate.content.cloneNode(true).firstElementChild;
        map.ondragover = ourBehaviorOnly;
        map.ondrop = map.onpaste = drop;
        document.body.append(map);
        map.querySelector('h2').innerText = document.getElementById(roomId).querySelector('a').innerText;
        this.roomSession = await Croquet.Session.join({
            appId: "com.highfidelity.dots",
            name: roomId + Version,
            password: "none",
            model: RoomRecord,
            autoSleep: false,
            options: {roomId},
            view: Room
        });
    }
}

[Record, RoomRecord, AvatarRecord, LobbyRecord].forEach(kind => kind.register(kind.name));
var LobbySession, map;
Croquet.Session.join({  // Join the lobby session, which we will be part of the whole time. (Low traffic.)
    appId: "com.highfidelity.dots.lobby",
    name: Version,
    password: "none",
    model: LobbyRecord,
    options: {roomNames: Array.from(document.getElementsByTagName('room')).map(e => e.id)},
    view: LobbyUI
}).then(s => {
    LobbySession = s;
    console.log('HighFidelityAudio example Dots', Version);
    Array.from(document.getElementsByTagName('a')).forEach(e => e.onclick = (event => LobbySession.view.enterRoom(event.target.parentElement.id)));
});

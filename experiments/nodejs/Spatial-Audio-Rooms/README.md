# Spatial-Audio-Rooms
A very complex demo application for High Fidelity's Spatial Audio API written in modular TypeScript which integrates many of the Spatial Audio API's features. Other features include:
- Twilio video conferencing with in-avatar video.
- The ability to configure the application and its virtual rooms with a `.json` configuration file.
- Users can join a "Watch Party" inside a "Watch Party Room" and watch synced YouTube videos together.
- Rooms contain "landmarks", which can have associated sounds. Users who click on these landmarks will hear the sounds spatialized locally on their client using [Howler.JS](https://howlerjs.com/).
- Code for a Discord bot and Slack integration which can be used to add a `/hifi` command to Discord/Slack (try `npm run discord`).
- The repository includes code for generating a native Electron app from the Spatial Audio Rooms code (try `npm run electron`).
- Code for injecting Audio Bots (with tree sounds!) into a Spatial Audio Room (try `npm run audiobots`).
- A particle system, currently used for "Signals" (click the star and minus icon in the top right, then click on the canvas).
- The ability for users to put their "ears" in the center of a table, to hear what that sounds like (press "U" on your keyboard when sitting in a seat).
- A bare-bones "map editor" mode (press CTRL+E on your keyboard).

For help with Spatial Audio Rooms, or for general help with the Spatial Audio API, [click here to join our Discord server](https://discord.gg/WwjNQx9K).

!["Spatial-Audio-Rooms" Example Screenshot](./screenshot.png)

## Author
Zach Fox

## Usage
1. Install [NodeJS v14.15.x](https://nodejs.org/en/)
2. Run `npm install`
3. Copy `auth.example.json` to `auth.json`.
4. Populate your credentials inside `./auth.json`.
    - Obtain `HIFI_*` credentials from the [High Fidelity Spatial Audio API Developer Console](https://account.highfidelity.com/dev/account)
    - Obtain `TWILIO_*` credentials from the [Twilio Console](https://www.twilio.com/console)
    - _Optionally,_ obtain `SLACK_*` credentials from the [Slack Apps Console](https://api.slack.com/apps)
        - This is only necessary if you want to develop a Slack app which links users to Spatial Audio Rooms. Detailed instructions for doing this are not included in this README.
5. Open `./node_modules/webpack-hot-middleware/process-update.js` in a text editor. Change `ignoreUnaccepted: true,` to `ignoreUnaccepted: false,`.
    - This is a bug that occurs between webpack-hot-middleware and webpack 5.
6. Open `./node_modules/util/util.js` in a text editor. Change `if (process.env.NODE_DEBUG) {` to `if (typeof (process) !== "undefined" && process.env.NODE_DEBUG) {`.
    - This is a bug with Twilio's client library.
7. Run `npm run start`
8. If your Web browser doesn't automatically open, use a Web browser to navigate to [http://localhost:8080/](http://localhost:8080/).

# Spatial-Audio-Rooms
A complex demo application for High Fidelity's Spatial Audio API which integrates many of the API's features as well as Twilio Video Conferencing.

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
5. Open `./node_modules/webpack-hot-middleware/process-update.js` in a text editor. Change `ignoreUnaccepted: true,` to `ignoreUnaccepted: false,`.
    - This is a bug that occurs between webpack-hot-middleware and webpack 5.
6. Open `./node_modules/util/util.js` in a text editor. Change `if (process.env.NODE_DEBUG) {` to `if (typeof (process) !== "undefined" && process.env.NODE_DEBUG) {`.
    - This is a bug with Twilio's client library.
7. Run `npm run start`
8. If your Web browser doesn't automatically open, use a Web browser to navigate to [http://localhost:8080/](http://localhost:8080/).

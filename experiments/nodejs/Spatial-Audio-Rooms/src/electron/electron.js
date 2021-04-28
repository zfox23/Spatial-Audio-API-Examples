// This file cannot be run with Electron from within the /src/electron directory.
// Use `npm run electron` to perform all necessary steps to run this file with Electron.

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path')

function createWindow() {
    Menu.setApplicationMenu(null);

    const browserWindow = new BrowserWindow({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        icon: path.join(__dirname, 'favicon.ico'),
    });
    browserWindow.maximize();
    browserWindow.show();
    browserWindow.loadFile(path.join(__dirname, "electron.html"))
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
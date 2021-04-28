const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
    Menu.setApplicationMenu(null);

    const browserWindow = new BrowserWindow({
        webPreferences: {
            preload: path.join(__dirname, '..', '..', 'dist', 'preload.js')
        },
        show: false,
        icon: path.join(__dirname, "..", "server", "static", "favicon.ico"),
    });
    browserWindow.maximize();
    browserWindow.show();
    browserWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'electron.html'))
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
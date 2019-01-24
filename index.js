const path = require('path');
const {BrowserWindow, app} = require('electron');
// @const autoUpdater = require('./autoUpdater');

let debug = /--debug/.test(process.argv[2]);
// debug = true;

if (process.mas) {
	app.setName('Electron APIs');
}

let mainWindow = null;

function initialize() {
	const shouldQuit = makeSingleInstance();
	if (shouldQuit) {
		return app.quit();
	}

	function createWindow() {
		const windowOptions = {
			width: 1080,
			minWidth: 680,
			minHeight: 680,
			height: 840,
			title: app.getName(),
			'web-preferences': {
				'web-security': false,
				'overlay-fullscreen-video': true
			}
		};
		/* @if (process.platform === 'linux') {
			windowOptions.icon = path.join(__dirname, '/assets/app-icon/png/512.png');
		} */

		mainWindow = new BrowserWindow(windowOptions);
		mainWindow.loadURL(path.join('file://', __dirname, '/index.html'));

		// Launch fullscreen with DevTools open, usage: npm run debug
		if (debug) {
			mainWindow.webContents.openDevTools();
			mainWindow.maximize();
			require('devtron').install();
		}

		mainWindow.on('closed', () => {
			mainWindow = null;
		});

		mainWindow.on('unresponsive', e => {
			console.log('[Unresponsive]', e);
		});

		mainWindow.webContents.on('crashed', e => {
			console.log('[Crashed]', e);
		});

		mainWindow.webContents.on('will-navigate', e => {
			e.preventDefault();
		});
	}

	app.on('ready', () => {
		createWindow();
		// @autoUpdater.initialize();
	});

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	app.on('activate', () => {
		if (mainWindow === null) {
			createWindow();
		}
	});

	process.on('uncaughtException', e => {
		console.log('[uncaughtException]', e);
	});
}

// Make this app a single instance app.
//
// The main window will be restored and focused instead of a second window
// opened when a person attempts to launch a second instance.
//
// Returns true if the current version of the app should quit instead of
// launching.
function makeSingleInstance() {
	if (process.mas) {
		return false;
	}

    app.requestSingleInstanceLock();
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }

            mainWindow.focus();
        }
    });
}

/* // Handle Squirrel on Windows startup events
switch (process.argv[1]) {
	case '--squirrel-install':
		autoUpdater.createShortcut(() => {
			app.quit();
		});
		break;
	case '--squirrel-uninstall':
		autoUpdater.removeShortcut(() => {
			app.quit();
		});
		break;
	case '--squirrel-obsolete':
	case '--squirrel-updated':
		app.quit();
		break;
	default:
		initialize();
} */

initialize();

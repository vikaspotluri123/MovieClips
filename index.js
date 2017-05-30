const path = require('path'),
glob = require('glob'),
electron = require('electron'),
autoUpdater = require('./autoUpdater'),

BrowserWindow = electron.BrowserWindow,
app = electron.app

var debug = /--debug/.test(process.argv[2]);
debug = true;

if (process.mas) app.setName('Electron APIs')

var mainWindow = null

function initialize () {
	var shouldQuit = makeSingleInstance()
	if (shouldQuit) return app.quit()

	function createWindow () {
		var windowOptions = {
			width: 1080,
			minWidth: 680,
			height: 840,
			title: app.getName()
		}

		if (process.platform === 'linux') {
			windowOptions.icon = path.join(__dirname, '/assets/app-icon/png/512.png')
		}

		mainWindow = new BrowserWindow(windowOptions)
		mainWindow.loadURL(path.join('file://', __dirname, '/index.html'))

		// Launch fullscreen with DevTools open, usage: npm run debug
		if (debug) {
			mainWindow.webContents.openDevTools()
			mainWindow.maximize()
			require('devtron').install()
		}

		mainWindow.on('closed', function () {
			mainWindow = null
		})

		mainWindow.on('unresponsive', function(e){
			console.log('[Unresponsive]',e);
		})

		mainWindow.webContents.on('crashed', function(e){
			console.log('[Crashed]',e);
		})

	}

	app.on('ready', function () {
		createWindow()
		autoUpdater.initialize()
	})

	app.on('window-all-closed', function () {
		if (process.platform !== 'darwin') {
			app.quit()
		}
	})

	app.on('activate', function () {
		if (mainWindow === null) {
			createWindow()
		}
	})

	process.on('uncaughtException', function(e) {
		console.log('[uncaughtException]',e)
	})
}

// Make this app a single instance app.
//
// The main window will be restored and focused instead of a second window
// opened when a person attempts to launch a second instance.
//
// Returns true if the current version of the app should quit instead of
// launching.
function makeSingleInstance () {
	if (process.mas) return false

	return app.makeSingleInstance(function () {
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore()
			mainWindow.focus()
		}
	})
}

// Handle Squirrel on Windows startup events
switch (process.argv[1]) {
	case '--squirrel-install':
		autoUpdater.createShortcut(function () { app.quit() })
		break
	case '--squirrel-uninstall':
		autoUpdater.removeShortcut(function () { app.quit() })
		break
	case '--squirrel-obsolete':
	case '--squirrel-updated':
		app.quit()
		break
	default:
		initialize()
}
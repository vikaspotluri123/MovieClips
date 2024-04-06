/* global window, document, localStorage, fs, Materialize */
class NoDirectoriesError extends Error {
	constructor() {
		super('No directories are available');
	}
}

class File {
	/**
	 * @param {FileSystemFileHandle} handle
	 */
	static async read(handle) {
		const file = await handle.getFile();
		const string = `${file.name} (${file.size})`
		return new File(string);
	}

	constructor(string) {
		this.string = string;
	}
}

/**
 * @template T
 * @param {Record<string, T>} store
 * @param {string} key
 * @param {Promise<T>} value
 */
async function setProperty(store, key, value) {
	store[key] = await value;
}

class Directory {
	/**
	 * @param {FileSystemDirectoryHandle} handle
	 */
	static async read(handle) {
		const promises = [];

		/**
		 * @type {Record<string, Directory | string>}
		 */
		const tree = {};

		for await (const node of handle.values()) {
			if (node.kind === 'directory') {
				promises.push(setProperty(tree, node.name, Directory.read(node)));
			} else {
				promises.push(setProperty(tree, node.name, File.read(node)));
			}
		}

		await Promise.all(promises);
		return new Directory(tree);
	}

	constructor(tree) {
		Object.assign(this, tree);
	}
}

window.storage = window.storage || {
	get(item) {
		return localStorage.getItem(item);
	},
	set(item, value) {
		return localStorage.setItem(item, value);
	}
};

window.movieClips ??= {
	vids: [], // The array of scanned videos
	isLoading: false, // Loading screen is showing
	shorty: true, // Stop after {range} seconds or play to end
	index: 0, // Video index
	range: { // Shorty - min & max length to play
		min: 10, // 180, // At least 3 minutes
		max: 11 // 360 // At most 6 minutes
	},
	supported: ['mp4'], // Supported file extensions
	shortyTimer: -1, // Timeout for shorty; used to clear
	shortyTime: { // Time info for shorty
		set: -1, // The timer duration
		at: Date.now() // Current time
	},
	util: {
		/**
		 * @description: Returns all of the files in a given folder, recursively
		 * @param {String} folder: The folder to scan
		 * @returns {Array} All of the files in specified `${folder}`
		 */
		allFiles(folder) {
			let results = [];
			fs.readDir(folder).forEach(file => {
				file = `${folder}/${file}`;
				const stat = fs.stat(file);
				if (stat && stat.isDirectory()) {
					results = results.concat(window.movieClips.util.allFiles(file));
				} else {
					results.push(file);
				}
			});
			return results;
		},
		/**
		 * @description: Sets the visibility of the loading screens
		 * @param {Boolean} to: Should the loading be enabled
		 * @returns {null}
		 */
		setLoading(to) {
			window.movieClips.isLoading = Boolean(to);
			if (to) {
				document.querySelector('body').classList.add('loading');
			} else {
				document.querySelector('body').classList.remove('loading');
			}
		},
		/**
		 * @description: Sets the status text in the loading screen
		 * @param {String} to: Status text to set
		 * @returns {null}
		 */
		setStatus(to) {
			document.querySelector('#status').textContent = to;
		},
		/**
		 * @description: Sets the title element (above the video) to specified text
		 * @param {String} to: Title to set
		 * @returns {null}
		 */
		setTitle(title) {
			document.querySelector('#title').textContent = title;
		},
		/**
		 * @description: Loads the specified movie into the player and adds start / stop settings
		 * @param {Integer} index: Index position of filename in ${vids}
		 */
		setMovie(index) {
			// Filename
			const movie = window.movieClips.vids[index];
			if (!movie) {
				window.movieClips.util.setStatus('No movies found');
				return false;
			}

			// Check if the movie is supported based on the file extension (weed out the bad ones early)
			let ext = movie.split('.');
			ext = ext[ext.length - 1];
			if (!window.movieClips.supported.includes(ext)) {
				console.warn('[rejection]', movie);
				window.movieClips.vids.splice(index, 1); // Remove because it's not needed
				index--;
				window.movieClips.handlers.next(null);
				return true;
			}

			console.log(movie);
			// Load the movie
			document.querySelector('#main').setAttribute('src', movie);
			// Update the movie title area
			let title = movie.split('/');
			title = title[title.length - 1].split('.');
			title = title[title.length - 2];
			window.movieClips.util.setTitle(title);
			// Actually load the movie
			document.querySelector('#main').load();
			return true;
		},
		/**
		 * @description: Populates ${vids} with the files by scanning saved directories
		 * @param {null}
		 * @returns {Promise}, no parameters
		 */
		updateList() {
			return new Promise(resolve => {
				window.movieClips.util.setStatus('Reading Folders');
				let dirs = window.storage.get('dirs');
				if (!dirs) {
					throw new NoDirectoriesError();
					return resolve();
				}

				dirs = JSON.parse(dirs);
				dirs.forEach(dir => {
					window.movieClips.util.setStatus(`Reading Folder ${dir}`);
					const files = window.movieClips.util.allFiles(dir);
					window.movieClips.vids = window.movieClips.vids.concat(files);
				});
				window.movieClips.util.setStatus('Removing Duplicates');
				window.movieClips.vids = unique(window.movieClips.vids);
				window.movieClips.util.setStatus('Randomizing');
				shuffle(window.movieClips.vids); // See mutates input. See Secure-shuffle documentation
				window.movieClips.util.setStatus('Removing unplaybale tracks');
				window.movieClips.vids = window.movieClips.vids.map(video => {
					let ext = video.split('.');
					ext = ext[ext.length - 1];
					return (window.movieClips.supported.includes(ext)) ? video : null;
				}).filter(Boolean);
				resolve();
			});
		},
		/**
		 * @description: sets timers to stop after shorty duration
		 * @param {null}
		 * @returns {null}
		 */
		videoStop() {
			if (window.movieClips.shorty) {
				let stopAfter;
				if (window.movieClips.shortyTime.set > 0) {
					stopAfter = window.movieClips.shortyTime.set;
				} else {
					const diff = window.movieClips.range.max - window.movieClips.range.min + 1;
					stopAfter = 1000 * parseFloat((Math.random() * diff) + window.movieClips.range.min).toFixed(3);
				}

				console.log(`Next video after ${stopAfter / 1000} seconds`);
				window.movieClips.shortyTimer = setTimeout(window.movieClips.handlers.next, stopAfter);
				window.movieClips.shortyTime.set = stopAfter;
				window.movieClips.shortyTime.at = Date.now();
			} else {
				console.warn('videoStop was called but shorty is false');
			}
		}
	},
	/**
	 * @description: functions for manipulating the video
	 */
	mediaActions: {
		/**
		 * @returns {Promise<void>} the promise returned by calling play
		 */
		play() {
			return document.querySelector('#main').play();
		},
		/**
		 * @returns {Promise<void>}
		 */
		pause() {
			document.querySelector('#main').pause(); // Returns undefined
		},
		/**
		 * @description: increase the speed of the video
		 * @param {Number} [0.1] increment: How much to increase the current speed by
		 * @returns {Number} The new playback rate
		 */
		increaseSpeed(increment) {
			const current = document.querySelector('#main').playbackRate;
			const min = 0.5; // Audio stops working below 0.5x
			const max = 4; // Audio stops working past 4x
			let final = current + (increment || 0.1); // Default increment 0.1x
			final = (final > max) ? max : final;
			final = (final < min) ? min : final;
			document.querySelector('#main').playbackRate = final;
			return final;
		},
		/**
		 * @description: increase the speed of the video
		 * @param {Number} [0.1] decrement: How much to decrease the current speed by
		 * @returns {Number} The new playback rate
		 */
		decreaseSpeed(decrement) {
			const current = document.querySelector('#main').playbackRate;
			const min = 0.5; // Audio stops working below 0.5x
			const max = 4; // Audio stops working past 4x
			let final = current - (decrement || 0.1); // Default decrement 0.1x
			final = (final < min) ? min : final;
			final = (final > max) ? max : final;
			document.querySelector('#main').playbackRate = final;
			return final;
		},
		/**
		 * @description: Forwards the video
		 * @param {Number} [0.5] seconds: How much to increase the current time by
		 * @returns {Number} The new time
		 */
		scrollForward(seconds) {
			const current = document.querySelector('#main').currentTime;
			const min = 0.5; // Anything less than half a second isn't really noticeable
			const max = document.querySelector('#main').duration - 0.5; // Half a second event buffer
			let final = current + (seconds || 5); // Default increment 5 seconds
			final = (final < min) ? min : final;
			final = (final > max) ? max : final;
			document.querySelector('#main').currentTime = final;
			return final;
		},
		/**
		 * @description: Rewinds the video
		 * @param {Number} [0.5] seconds: How much to decrease the current time by
		 * @returns {Number} The new time
		 */
		scrollBackward(seconds) {
			const current = document.querySelector('#main').currentTime;
			const min = 0.5; // Anything less than half a second isn't really noticeable
			const max = document.querySelector('#main').duration - 0.5; // Half a second event buffer
			let final = current - (seconds || 5); // Default increment 5 seconds
			final = (final < min) ? min : final;
			final = (final > max) ? max : final;
			document.querySelector('#main').currentTime = final;
			return final;
		},
		/**
		 * @description: Increase the video volume
		 * @param {Number} [0.05] percent(as decimal): What percent to increase the volume
		 * @returns {Number} The new volume level
		 */
		increaseVolume(percent) {
			const current = document.querySelector('#main').volume;
			const min = 0;
			const max = 1;
			let final = current + (percent || 0.05); // Default increment of 5%
			final = final < min ? min : final;
			final = final > max ? max : final;
			document.querySelector('#main').volume = final;
			return final;
		},
		/**
		 * @description: Decrease the video volume
		 * @param {Number} [0.05] percent(as decimal): What percent to decrease the volume
		 * @returns {Number} The new volume level
		 */
		decreaseVolume(percent) {
			const current = document.querySelector('#main').volume;
			const min = 0;
			const max = 1;
			let final = current - (percent || 0.05); // Default decrement of 5%
			final = final < min ? min : final;
			final = final > max ? max : final;
			document.querySelector('#main').volume = final;
			return final;
		},
		/**
		 * @description: Sets the video time
		 * @param {Number} [0.1] seconds: Position to set video at
		 * @returns {Number} The new time (should = ${seconds})
		 */
		moveTo(seconds) {
			const min = 0.1; // Start a little after the beginning of the video
			const max = document.querySelector('#main').duration - 0.5; // Half a second event buffer
			seconds = ((seconds || min) > max) ? max : seconds;
			seconds = (seconds < min) ? min : seconds;
			document.querySelector('#main').currentTime = seconds;
		},
		/**
		 * @description: Sets the volume
		 * @param {Number} [1] percent (as decimal): the volume percentage to set
		 * @returns {Number} The new volume (should = ${level})
		 */
		setVolume(level) {
			level = parseFloat((level || 1)).toFixed(2);
			level = level < 0 ? 0 : level;
			level = level > 1 ? 1 : level;
			document.querySelector('#main').volume = level;
			return level;
		},
		/**
		 * @description: Mutes the video
		 */
		mute() {
			document.querySelector('#main').muted = true;
		},
		/**
		 * @description: Unmutes the video
		 */
		unMute() {
			document.querySelector('#main').muted = false;
		},
		/**
		 * @description: Switches between mute states
		 */
		toggleMute() {
			document.querySelector('#main').muted = !(document.querySelector('#main').muted);
		},
		/**
		 * @description: Switches between play states
		 */
		togglePlaying() {
			return (document.querySelector('#main').paused ? window.movieClips.mediaActions.play() : window.movieClips.mediaActions.pause());
		}
	},
	handlers: {
		async directory() {
			const handle = await window.showDirectoryPicker();
			const directory = await Directory.read(handle);
			// TODO
		},
		/**
		 * @description: Handles switching between fullscreen states
		 * @param {Event} [event] The `Event` object that was fired. If called directly, no object will be present
		 */
		fullscreen(event) {
			// @todo
			console.log('fullscreen', event);
		},
		/**
		 * @description: Sets the start and stop point of the video
		 * @param {Event} [_] `Event` object that was fired. If called directly, no object will be present
		 */
		metadata(_) {
			// @todo add full video support
			const len = this.duration;
			let start = Math.floor((Math.random() * (len - 0.5 + 1)) + 0.5);
			if ((len - start) < window.movieClips.range.upper) {
				start = len - window.movieClips.range.upper;
			}

			this.currentTime = start;
		},
		/**
		 * @description: Moves to the next video [when the current video is over or times out (shorty)]
		 * @param {Event} {event} The `Event` object that was fired. If called directly, no object will be present
		 */
		next(event) {
			if (event) {
				event.preventDefault();
			}

			// Reset shorty stuff
			window.movieClips.shortyTime.set = -1;
			clearTimeout(window.movieClips.shortyTimer);

			window.movieClips.index++;

			// Check if at end of array
			if (window.movieClips.index >= window.movieClips.vids.length - 1) {
				window.movieClips.index = 0;
				window.movieClips.vids = [];
				window.movieClips.util.setLoading(true);
				console.info('initializing');
				window.movieClips.util.updateList().then(() => {
					window.movieClips.util.setStatus('Starting Up');
					window.movieClips.util.setMovie(0);
					window.movieClips.util.setStatus('Done... Goodbye');
					window.movieClips.util.setLoading(false);
				});
				document.querySelector('#back').classList.add('disabled');
			} else {
				document.querySelector('#back').classList.remove('disabled');
				window.movieClips.util.setMovie(window.movieClips.index);
			}
		},
		/**
		 * @description: Movies to the previous video
		 * @param {Event} [event] The `Event` object that was fired. If called directly, no object will be present
		 */
		previous(event) {
			// Make sure it's possible to go back
			if (window.movieClips.index > 0) {
				event.preventDefault();
				window.movieClips.index--;
				window.movieClips.util.setMovie(window.movieClips.index);
			} else {
				document.querySelector('#back').classList.add('disabled');
			}
		},
		/**
		 * @description: Controls the state of shorty (next clip after ${range})
		 * @param {Event} [event] The `Event` object that was fired. If called directly, no object will be present
		 */
		playPause(_) {
			const current = this.textContent;
			if (current === 'pause') {
				window.movieClips.shorty = false;
				clearTimeout(window.movieClips.shortyTimer);
				console.log('timeout cleared');
				window.movieClips.shortyTime.set = -1;
				this.textContent = 'play_arrow';
				Materialize.toast('Snippets Disabled', 2000);
			} else {
				window.movieClips.shorty = true;
				window.movieClips.util.videoStop();
				this.textContent = 'pause';
				Materialize.toast('Snippets Enabled', 2000);
			}
		},
		/**
		 * @description: Handles keypress events for keyboard shortcuts
		 * @param {Event} [event] The `Event` object that was fired. Should not be called directly
		 */
		keypress(event) {
			switch (event.keyCode) {
				case 32: // @key {space}
				case 107: // @key {k}
				case 112: // @key {p}
					window.movieClips.mediaActions.togglePlaying();
					break;
				case 102: // @key {f}
					window.movieClips.handlers.fullscreen();
					break;
				case 100: // @key {d}
					window.movieClips.mediaActions.increaseSpeed();
					break;
				case 106: // @key {j}
					window.movieClips.mediaActions.scrollBackward(10);
					break;
				case 108: // @key {l}
					window.movieClips.mediaActions.scrollForward(10);
					break;
				case 109: // @key {m}
					window.movieClips.mediaActions.toggleMute();
					break;
				case 110:
					window.movieClips.handlers.next();
					break;
				case 115: // @key {s}
					window.movieClips.mediaActions.decreaseSpeed();
					break;
				default:
					console.log('Keypress not found', event.keyCode, event.which);
					break;
			}
		},
		/**
		 * @description: Handles keydown events for special keys for keyboard shortcuts. These keys don't trigger keypressed
		 * @param {Event} [event] The `Event` object that was fired. Should not be called directly.
		 */
		keydown(event) {
			switch (event.keyCode) {
				case 27: // @key {escape}
					window.movieClips.handlers.fullscreen();
					break;
				case 35: // @key {end}
					window.movieClips.handlers.next();
					break;
				case 36: // @key {home}
					window.movieClips.mediaActions.moveTo(0);
					break;
				case 37: // @key {left-arrow}
					window.movieClips.mediaActions.scrollBackward(5);
					break;
				case 38: // @key {up-arrow}
					window.movieClips.mediaActions.increaseVolume(0.05);
					break;
				case 39: // @key {right-arrow}
					window.movieClips.mediaActions.scrollForward(5);
					break;
				case 40: // @key {down-arrow}
					window.movieClips.mediaActions.decreaseVolume(0.05);
					break;
				default:
					console.log('Keydown not found', event.keyCode, event.which);
					break;
			}
		},
		/**
		 * @description: Adds listeners for pause and adds timeouts
		 * @param {Event} [_] The `Event` object that was fired. Should not be called directly.
		 */
		play(_) {
			document.querySelector('#main').removeEventListener('ended', window.movieClips.handlers.next);
			if (window.movieClips.shorty) {
				window.movieClips.util.videoStop();
			} else {
				document.querySelector('#main').addEventListener('ended', window.movieClips.handlers.next);
			}
		},
		pause(_) {
			clearTimeout(window.movieClips.shortyTimer);
			console.log('timeout cleared');
			window.movieClips.shortyTime.set = Date.now() - window.movieClips.shortyTime.at;
		},
		/**
		 * @description: Updates the UI when video speed is changed
		 * @param {Event} [_] The `Event` object that was fired. If called directly, no object will be present
		 */
		ratechange(_) {
			document.querySelector('#rate').textContent = parseFloat(this.playbackRate).toFixed(2);
		}
	},
	initialize() {
		window.movieClips.util.setLoading(1);
		document.querySelector('#directory-selector').addEventListener('click', window.movieClips.handlers.directory);
		// We have to wait for the list to update
		window.movieClips.util.updateList().then(() => {
			window.movieClips.util.setStatus('Making buttons clickable');
			document.querySelector('#back').addEventListener('click', window.movieClips.handlers.previous);
			document.querySelector('#next').addEventListener('click', window.movieClips.handlers.next);
			document.querySelector('#main').addEventListener('click', window.movieClips.mediaActions.togglePlaying); // We'll add a handler for this if needed in the future
			document.querySelector('#main').addEventListener('dblclick', window.movieClips.handlers.fullscreen);
			window.movieClips.util.setStatus('Adding keyboard shortcuts');
			document.querySelector('#playPause').addEventListener('click', window.movieClips.handlers.playPause);
			document.addEventListener('keypress', window.movieClips.handlers.keypress);
			document.addEventListener('keydown', window.movieClips.handlers.keydown);
			window.movieClips.util.setStatus('Loading video helpers');
			document.querySelector('#main').addEventListener('ratechange', window.movieClips.handlers.ratechange);
			document.querySelector('#main').addEventListener('play', window.movieClips.handlers.play);
			document.querySelector('#main').addEventListener('pause', window.movieClips.handlers.pause);
			document.querySelector('#main').addEventListener('loadedmetadata', window.movieClips.handlers.metadata);
			document.querySelector('#main').onerror = window.movieClips.handlers.next;
			window.movieClips.util.setStatus('Starting Up');
			if (window.movieClips.util.setMovie(0)) {
				window.movieClips.util.setStatus('Done... Goodbye');
				window.movieClips.util.setLoading(false);
			}
		}).catch(error => {
			if (error instanceof NoDirectoriesError) {
				window.movieClips.util.setLoading(false);
				document.querySelector('#selector').removeAttribute('hidden')
				document.querySelector('#player').setAttribute('hidden', true)
			}
		});
	}
};

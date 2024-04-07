// @ts-check

class NoDirectoriesError extends Error {
	constructor() {
		super('No directories are available');
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
		 * @type {Record<string, Directory | File>}
		 */
		const tree = {};

		for await (const node of handle.values()) {
			if (node.kind === 'directory') {
				promises.push(setProperty(tree, node.name, Directory.read(node)));
			} else {
				promises.push(setProperty(tree, node.name, node.getFile()));
			}
		}

		await Promise.all(promises);
		return new Directory(tree);
	}

	/**
	 * @param {Record<string, Directory | File>} tree
	 */
	constructor(tree) {
		this.tree = tree;
	}

	/**
	 * @param {string[]} extensions
	 */
	filterFlat(extensions) {
		const response = [];
		for (const [file, store] of Object.entries(this.tree)) {
			if (store instanceof Directory) {
				response.concat(store.filterFlat(extensions));
			} else {
				const extension = file.split('.').pop();
				if (extensions.includes(extension)) {
					response.push(store);
				}
			}
		}

		return response;
	}
}

/**
 * @template T
 * @param {T extends Record<'onerror' | 'onsuccess' | 'result' | 'error', any> ? T : never} request
 * @returns {Promise<Awaited<T['result']>>}
 */
function promisifyRequest(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

class MovieDb {
	/**
	 * @param {string} dbName
	 * @param {string} storeName
	 */
	constructor(dbName, storeName) {
		this.dbName = dbName;
		this.storeName = storeName;
		this._db = this._initialize();
	}

	/**
	 * @param {string} key
	 * @returns {Promise<FileSystemDirectoryHandle>}
	 */
	async fetch(key) {
		const db = await this._db;
		const request = db.transaction([this.storeName], 'readonly')
			.objectStore(this.storeName)
			.get(key);

		return promisifyRequest(request);
	}

	/**
	 * @param {string} key
	 * @param {FileSystemDirectoryHandle} value
	 */
	async store(key, value) {
		const db = await this._db;
		const request = db.transaction([this.storeName], 'readwrite')
			.objectStore(this.storeName)
			.put(value, key);

		await promisifyRequest(request);
	}

	/**
	 * @returns {Promise<string[]>}
	 */
	async getDirectories() {
		const db = await this._db;
		const request = db.transaction([this.storeName], 'readonly')
			.objectStore(this.storeName)
			.getAllKeys();

		const keys = await promisifyRequest(request);
		if (!keys.every(key => typeof key ==='string')) {
			const invalidKeys = keys.filter(key => typeof key !== "string").join(', ');
			throw new Error(`Key(s) have invalid type: ${invalidKeys}`);
		}

		// @ts-expect-error the next version of typescript will understand that `keys` is guaranteed to be a `string[]`
		return keys;
	}

	/**
	 * @private
	 */
	async _initialize() {
		const request = window.indexedDB.open(this.dbName, 1);
		request.onupgradeneeded = () => {
			return request.result.createObjectStore(this.storeName);
		};

		return promisifyRequest(request);
	}
}

const MovieClips = {
	/** @returns {HTMLVideoElement} */
	// @ts-expect-error
	mediaElement: () => document.getElementById('main'),
	db: new MovieDb('movie-clips', 'file-handles'),
	/**
	 * @type {File[]}
	 */
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
		 * @description: Sets the visibility of the loading screens
		 * @param {boolean} to: Should the loading be enabled
		 */
		setLoading(to) {
			movieClips.isLoading = Boolean(to);
			if (to) {
				document.querySelector('body').classList.add('loading');
			} else {
				document.querySelector('body').classList.remove('loading');
			}
		},
		/**
		 * @description: Sets the status text in the loading screen
		 * @param {string} to Status text to set
		 * @param {string | null} color
		 */
		setStatus(to, color = null) {
			/** @type {HTMLElement} */
			const status = document.querySelector('#status');
			status.textContent = to;
			if (color) {
				status.style.color = color;
			} else {
				delete status.style.color;
			}
		},
		/**
		 * @description: Sets the title element (above the video) to specified text
		 * @param {string} title: Title to set
		 */
		setTitle(title) {
			document.querySelector('#title').textContent = title;
		},
		/**
		 * @description: Loads the specified movie into the player and adds start / stop settings
		 * @param {number} index Index position of filename in ${vids}
		 */
		setMovie(index) {
			// Filename
			const movie = movieClips.vids[index];
			if (!movie) {
				movieClips.util.setStatus('No movies found');
				return false;
			}

			// Check if the movie is supported based on the file extension (weed out the bad ones early)
			const ext = movie.name.split('.').pop();
			if (!movieClips.supported.includes(ext)) {
				console.warn('[rejection]', movie);
				movieClips.vids.splice(index, 1); // Remove because it's not needed
				index--;
				movieClips.handlers.next(null);
				return true;
			}

			console.log(movie);
			const video = movieClips.mediaElement();
			// Load the movie
			video.setAttribute('src', URL.createObjectURL(movie));
			// Update the movie title area
			const title = movie.name.split('/')
				.pop()
				.split('.')
				.at(-2);
			movieClips.util.setTitle(title);
			// Actually load the movie
			video.load();
			return true;
		},
		/**
		 * @description Populates ${vids} with the files by scanning saved directories
		 * @returns {Promise<void>}
		 */
		async updateList() {
			movieClips.util.setStatus('Reading Folders');
			const directories = await movieClips.db.getDirectories();

			if (directories.length === 0) {
				throw new NoDirectoriesError();
			}

			for (const directory of directories) {
				movieClips.util.setStatus(`Reading Folder: ${directory}`);
				const handle = await movieClips.db.fetch(directory);
				const dirObject = await Directory.read(handle);
				movieClips.vids = movieClips.vids.concat(dirObject.filterFlat(movieClips.supported));
			}

			// throw new Error('oops')

			movieClips.util.setStatus('Removing Duplicates');
			movieClips.vids = unique(movieClips.vids);
			movieClips.util.setStatus('Randomizing');
			shuffle(movieClips.vids); // See mutates input. See Secure-shuffle documentation
		},
		/**
		 * @description: sets timers to stop after shorty duration
		 */
		videoStop() {
			if (movieClips.shorty) {
				let stopAfter;
				if (movieClips.shortyTime.set > 0) {
					stopAfter = movieClips.shortyTime.set;
				} else {
					const diff = movieClips.range.max - movieClips.range.min + 1;
					stopAfter = 1000 * parseFloat(((Math.random() * diff) + movieClips.range.min).toFixed(3));
				}

				console.log(`Next video after ${stopAfter / 1000} seconds`);
				movieClips.shortyTimer = setTimeout(movieClips.handlers.next, stopAfter);
				movieClips.shortyTime.set = stopAfter;
				movieClips.shortyTime.at = Date.now();
			} else {
				console.warn('videoStop was called but shorty is false');
			}
		}
	},
	/**
	 * @description: functions for manipulating the video
	 */
	mediaActions: {
		play() {
			return movieClips.mediaElement().play();
		},
		pause() {
			movieClips.mediaElement().pause();
		},
		/**
		 * @description: increase the speed of the video
		 * @param {number} [increment] How much to increase the current speed by
		 * @returns {number} The new playback rate
		 */
		increaseSpeed(increment = 0.1) {
			const video = movieClips.mediaElement();
			const current = video.playbackRate;
			const min = 0.5; // Audio stops working below 0.5x
			const max = 4; // Audio stops working past 4x
			let final = current + increment; // Default increment 0.1x
			final = (final > max) ? max : final;
			final = (final < min) ? min : final;
			video.playbackRate = final;
			return final;
		},
		/**
		 * @description: increase the speed of the video
		 * @param {number} [decrement] How much to decrease the current speed by
		 * @returns {number} The new playback rate
		 */
		decreaseSpeed(decrement = 0.1) {
			const video = movieClips.mediaElement();
			const current = video.playbackRate;
			const min = 0.5; // Audio stops working below 0.5x
			const max = 4; // Audio stops working past 4x
			let final = current - decrement; // Default decrement 0.1x
			final = (final < min) ? min : final;
			final = (final > max) ? max : final;
			video.playbackRate = final;
			return final;
		},
		/**
		 * @description: Forwards the video
		 * @param {number} [seconds] How much to increase the current time by
		 * @returns {number} The new time
		 */
		scrollForward(seconds = 5) {
			const video = movieClips.mediaElement();
			const current = video.currentTime;
			const min = 0.5; // Anything less than half a second isn't really noticeable
			const max = video.duration - 0.5; // Half a second event buffer
			let final = current + seconds; // Default increment 5 seconds
			final = (final < min) ? min : final;
			final = (final > max) ? max : final;
			video.currentTime = final;
			return final;
		},
		/**
		 * @description: Rewinds the video
[		 * @param {number} [seconds] How much to decrease the current time by
]		 * @returns {number} The new time
		 */
		scrollBackward(seconds = 5) {
			const video = movieClips.mediaElement();
			const current = video.currentTime;
			const min = 0.5; // Anything less than half a second isn't really noticeable
			const max = video.duration - 0.5; // Half a second event buffer
			let final = current - seconds; // Default increment 5 seconds
			final = (final < min) ? min : final;
			final = (final > max) ? max : final;
			video.currentTime = final;
			return final;
		},
		/**
		 * @description: Increase the video volume
		 * @param {number} [percent] (decimal) What percent to increase the volume
		 * @returns {number} The new volume level
		 */
		increaseVolume(percent = 0.05) { // Default increment of 5%
			const video = movieClips.mediaElement();
			const current = video.volume;
			const min = 0;
			const max = 1;
			let final = current + percent;
			final = final < min ? min : final;
			final = final > max ? max : final;
			video.volume = final;
			return final;
		},
		/**
		 * @description: Decrease the video volume
		 * @param {number} [percent] (decimal) What percent to decrease the volume
		 * @returns {number} The new volume level
		 */
		decreaseVolume(percent = 0.05) { // Default decrement of 5%
			const video = movieClips.mediaElement();
			const current = video.volume;
			const min = 0;
			const max = 1;
			let final = current - percent;
			final = final < min ? min : final;
			final = final > max ? max : final;
			video.volume = final;
			return final;
		},
		/**
		 * @description: Sets the video time
		 * @param {number} [seconds] Position to set video at
		 * @returns {number} The new time (should = ${seconds})
		 */
		moveTo(seconds = 0.1) {
			const video = movieClips.mediaElement();
			const min = 0.1; // Start a little after the beginning of the video
			const max = video.duration - 0.5; // Half a second event buffer
			seconds = ((seconds || min) > max) ? max : seconds;
			seconds = (seconds < min) ? min : seconds;
			video.currentTime = seconds;
			return seconds;
		},
		/**
		 * @description: Sets the volume
		 * @param {number} [level] percent (as decimal): the volume percentage to set
		 * @returns {number} The new volume (should = ${level})
		 */
		setVolume(level = 1) {
			level = parseFloat(level.toFixed(2));
			level = level < 0 ? 0 : level;
			level = level > 1 ? 1 : level;
			movieClips.mediaElement().volume = level;
			return level;
		},
		/**
		 * @description: Mutes the video
		 */
		mute() {
			movieClips.mediaElement().muted = true;
		},
		/**
		 * @description: Unmutes the video
		 */
		unMute() {
			movieClips.mediaElement().muted = false;
		},
		/**
		 * @description: Switches between mute states
		 */
		toggleMute() {
			const video = movieClips.mediaElement();
			video.muted = !(video.muted);
		},
		/**
		 * @description: Switches between play states
		 */
		togglePlaying() {
			return (movieClips.mediaElement().paused ? movieClips.mediaActions.play() : movieClips.mediaActions.pause());
		}
	},
	handlers: {
		async directory() {
			const handle = await window.showDirectoryPicker({mode: 'read'});
			await movieClips.db.store(handle.name, handle);
			movieClips.initialize();
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
			if ((len - start) < movieClips.range.upper) {
				start = len - movieClips.range.upper;
			}

			this.currentTime = start;
		},
		/**
		 * @description: Moves to the next video [when the current video is over or times out (shorty)]
		 * @param {Event} [event] The `Event` object that was fired. If called directly, no object will be present
		 */
		next(event) {
			if (event) {
				event.preventDefault();
			}

			// Reset shorty stuff
			movieClips.shortyTime.set = -1;
			clearTimeout(movieClips.shortyTimer);

			movieClips.index++;

			// Check if at end of array
			if (movieClips.index >= movieClips.vids.length - 1) {
				movieClips.index = 0;
				movieClips.vids = [];
				movieClips.util.setLoading(true);
				console.info('initializing');
				movieClips.util.updateList().then(() => {
					movieClips.util.setStatus('Starting Up');
					movieClips.util.setMovie(0);
					movieClips.util.setStatus('Done... Goodbye');
					movieClips.util.setLoading(false);
				});
				document.querySelector('#back').classList.add('disabled');
			} else {
				document.querySelector('#back').classList.remove('disabled');
				movieClips.util.setMovie(movieClips.index);
			}
		},
		/**
		 * @description: Movies to the previous video
		 * @param {Event} [event] The `Event` object that was fired. If called directly, no object will be present
		 */
		previous(event) {
			// Make sure it's possible to go back
			if (movieClips.index > 0) {
				event.preventDefault();
				movieClips.index--;
				movieClips.util.setMovie(movieClips.index);
			} else {
				document.querySelector('#back').classList.add('disabled');
			}
		},
		/**
		 * @description: Controls the state of shorty (next clip after ${range})
		 * @param {Event} [_] The `Event` object that was fired. If called directly, no object will be present
		 */
		playPause(_) {
			const current = this.textContent;
			if (current === 'pause') {
				movieClips.shorty = false;
				clearTimeout(movieClips.shortyTimer);
				console.log('timeout cleared');
				movieClips.shortyTime.set = -1;
				this.textContent = 'play_arrow';
				Materialize.toast('Snippets Disabled', 2000);
			} else {
				movieClips.shorty = true;
				movieClips.util.videoStop();
				this.textContent = 'pause';
				Materialize.toast('Snippets Enabled', 2000);
			}
		},
		/**
		 * @description: Handles keypress events for keyboard shortcuts
		 * @param {KeyboardEvent} event The `Event` object that was fired. Should not be called directly
		 */
		keypress(event) {
			switch (event.keyCode) {
				case 32: // @key {space}
				case 107: // @key {k}
				case 112: // @key {p}
					movieClips.mediaActions.togglePlaying();
					break;
				case 102: // @key {f}
					movieClips.handlers.fullscreen();
					break;
				case 100: // @key {d}
					movieClips.mediaActions.increaseSpeed();
					break;
				case 106: // @key {j}
					movieClips.mediaActions.scrollBackward(10);
					break;
				case 108: // @key {l}
					movieClips.mediaActions.scrollForward(10);
					break;
				case 109: // @key {m}
					movieClips.mediaActions.toggleMute();
					break;
				case 110:
					movieClips.handlers.next();
					break;
				case 115: // @key {s}
					movieClips.mediaActions.decreaseSpeed();
					break;
				default:
					console.log('Keypress not found', event.keyCode, event.which);
					break;
			}
		},
		/**
		 * @description: Handles keydown events for special keys for keyboard shortcuts. These keys don't trigger keypressed
		 * @param {KeyboardEvent} [event] The `Event` object that was fired. Should not be called directly.
		 */
		keydown(event) {
			switch (event.keyCode) {
				case 27: // @key {escape}
					movieClips.handlers.fullscreen();
					break;
				case 35: // @key {end}
					movieClips.handlers.next();
					break;
				case 36: // @key {home}
					movieClips.mediaActions.moveTo(0);
					break;
				case 37: // @key {left-arrow}
					movieClips.mediaActions.scrollBackward(5);
					break;
				case 38: // @key {up-arrow}
					movieClips.mediaActions.increaseVolume(0.05);
					break;
				case 39: // @key {right-arrow}
					movieClips.mediaActions.scrollForward(5);
					break;
				case 40: // @key {down-arrow}
					movieClips.mediaActions.decreaseVolume(0.05);
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
			const video = movieClips.mediaElement();
			video.removeEventListener('ended', movieClips.handlers.next);
			if (movieClips.shorty) {
				movieClips.util.videoStop();
			} else {
				video.addEventListener('ended', movieClips.handlers.next);
			}
		},
		pause(_) {
			clearTimeout(movieClips.shortyTimer);
			console.log('timeout cleared');
			movieClips.shortyTime.set = Date.now() - movieClips.shortyTime.at;
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
		movieClips.util.setLoading(true);
		document.querySelector('#selector').setAttribute('hidden', 'true');
		document.querySelector('#player').removeAttribute('hidden');
		document.querySelector('#directory-selector').addEventListener('click', movieClips.handlers.directory);
		// We have to wait for the list to update
		movieClips.util.updateList().then(() => {
			const video = movieClips.mediaElement();
			movieClips.util.setStatus('Making buttons clickable');
			document.querySelector('#back').addEventListener('click', movieClips.handlers.previous);
			document.querySelector('#next').addEventListener('click', movieClips.handlers.next);
			video.addEventListener('click', movieClips.mediaActions.togglePlaying); // We'll add a handler for this if needed in the future
			video.addEventListener('dblclick', movieClips.handlers.fullscreen);
			movieClips.util.setStatus('Adding keyboard shortcuts');
			document.querySelector('#playPause').addEventListener('click', movieClips.handlers.playPause);
			document.addEventListener('keypress', movieClips.handlers.keypress);
			document.addEventListener('keydown', movieClips.handlers.keydown);
			movieClips.util.setStatus('Loading video helpers');
			video.addEventListener('ratechange', movieClips.handlers.ratechange);
			video.addEventListener('play', movieClips.handlers.play);
			video.addEventListener('pause', movieClips.handlers.pause);
			video.addEventListener('loadedmetadata', movieClips.handlers.metadata);
			video.onerror = movieClips.handlers.next;
			movieClips.util.setStatus('Starting Up');
			if (movieClips.util.setMovie(0)) {
				movieClips.util.setStatus('Done... Goodbye');
				movieClips.util.setLoading(false);
			}
		}).catch(error => {
			if (error instanceof NoDirectoriesError) {
				movieClips.util.setLoading(false);
				document.querySelector('#selector').removeAttribute('hidden');
				document.querySelector('#player').setAttribute('hidden', 'true');
			} else {
				console.error(error);
				movieClips.util.setStatus(`Something went wrong: ${error?.message ?? error}`, 'red');
			}
		});
	}
};

// @ts-expect-error
window.movieClips ??= MovieClips;
/**
 * @type {typeof MovieClips}
 */
// @ts-expect-error
const movieClips = window.movieClips;
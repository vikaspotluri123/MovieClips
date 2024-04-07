// @ts-check
import {filterFlat, readDirectory} from '../src/browser-files.ts';
import {MovieDb} from '../src/movie-db.ts';
import {ElementRegistry} from '../src/element-registry.ts';
import * as mediaControls from '../src/components/media-controls.ts';

/**
 * @typedef {import('../src/browser-files.js').FileNode} FileNode
 */

/**
 * @description perform an in-place Durstenfeld shuffle
 * @param {unknown[]} array
 */
function shuffle(array) {
	for (let i = array.length - 1; i > 0; --i) {
		const swapIndex = Math.floor(Math.random() * (i + 1));
		const swapData = array[i];
		array[i] = array[swapIndex];
		array[swapIndex] = swapData;
	}
}

/**
 * @template T
 *
 * @param {T[]} array an array with duplicate items
 * @returns {T[]} a new array without duplicate items
 */
const unique = array => Array.from(new Set(array));

class NoDirectoriesError extends Error {
	constructor() {
		super('No directories are available');
	}
}

/**
 * @satisfies {import('../src/interfaces/movie-clips.ts').MovieClips}
 */
const MovieClips = {
	db: new MovieDb('movie-clips', 'file-handles'),
	elements: new ElementRegistry([
		'body', '#loading-wrapper', '#progress-name', '#status', '#selector', '#directory-selector', '#player', '#video-wrapper', '#meta', '#rate', '#title', '#animatedActions', '#action-play', '#action-pause', '#main', '#controls', '#back', '#playPause', '#next',
	]),
	/**
	 * @type {FileNode[]}
	 */
	vids: [], // The array of scanned videos
	isLoading: false, // Loading screen is showing
	shorty: true, // Stop after {range} seconds or play to end
	index: 0, // Video index
	range: { // Shorty - min & max length to play
		min: 10, // 180, // At least 3 minutes
		max: 11 // 360 // At most 6 minutes
	},
	supported: ['mp4', 'mkv'], // Supported file extensions
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
				movieClips.elements.read('body').classList.add('loading');
			} else {
				movieClips.elements.read('body').classList.remove('loading');
			}
		},
		/**
		 * @description: Sets the status text in the loading screen
		 * @param {string} to Status text to set
		 * @param {string | null} color
		 */
		setStatus(to, color = null) {
			const status = movieClips.elements.read('#status');
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
			movieClips.elements.read('#title').textContent = title;
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

			const video = movieClips.elements.read('#main');
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
				const dirObject = await readDirectory(handle);
				movieClips.vids = movieClips.vids.concat(filterFlat(dirObject, movieClips.supported));
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
			return movieClips.elements.read('#main').play();
		},
		pause() {
			movieClips.elements.read('#main').pause();
		},
		/**
		 * @description: increase the speed of the video
		 * @param {number} [increment] How much to increase the current speed by
		 * @returns {number} The new playback rate
		 */
		increaseSpeed(increment = 0.1) {
			const video = movieClips.elements.read('#main');
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
			const video = movieClips.elements.read('#main');
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
			const video = movieClips.elements.read('#main');
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
		 * @param {number} [seconds] How much to decrease the current time by
		 * @returns {number} The new time
		 */
		scrollBackward(seconds = 5) {
			const video = movieClips.elements.read('#main');
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
			const video = movieClips.elements.read('#main');
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
			const video = movieClips.elements.read('#main');
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
			const video = movieClips.elements.read('#main');
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
			movieClips.elements.read('#main').volume = level;
			return level;
		},
		/**
		 * @description: Mutes the video
		 */
		mute() {
			movieClips.elements.read('#main').muted = true;
		},
		/**
		 * @description: Unmutes the video
		 */
		unMute() {
			movieClips.elements.read('#main').muted = false;
		},
		/**
		 * @description: Switches between mute states
		 */
		toggleMute() {
			const video = movieClips.elements.read('#main');
			video.muted = !(video.muted);
		},
		/**
		 * @description: Switches between play states
		 */
		togglePlaying() {
			return (movieClips.elements.read('#main').paused ? movieClips.mediaActions.play() : movieClips.mediaActions.pause());
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
				movieClips.elements.read('#back').classList.add('disabled');
			} else {
				movieClips.elements.read('#back').classList.remove('disabled');
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
				movieClips.elements.read('#back').classList.add('disabled');
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
			const video = movieClips.elements.read('#main');
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
			movieClips.elements.read('#rate').textContent = parseFloat(this.playbackRate).toFixed(2);
		}
	},
	initialize() {
		movieClips.util.setLoading(true);
		movieClips.elements.read('#selector').setAttribute('hidden', 'true');
		movieClips.elements.read('#player').removeAttribute('hidden');
		movieClips.elements.read('#directory-selector').addEventListener('click', movieClips.handlers.directory);
		// We have to wait for the list to update
		movieClips.util.updateList().then(() => {
			const video = movieClips.elements.read('#main');
			movieClips.util.setStatus('Making buttons clickable');
			movieClips.elements.read('#back').addEventListener('click', movieClips.handlers.previous);
			movieClips.elements.read('#next').addEventListener('click', movieClips.handlers.next);
			video.addEventListener('click', movieClips.mediaActions.togglePlaying); // We'll add a handler for this if needed in the future
			video.addEventListener('dblclick', movieClips.handlers.fullscreen);
			movieClips.util.setStatus('Adding keyboard shortcuts');
			movieClips.elements.read('#playPause').addEventListener('click', mediaControls.eventHandlers.playPause);
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
				movieClips.elements.read('#selector').removeAttribute('hidden');
				movieClips.elements.read('#player').setAttribute('hidden', 'true');
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
 * @type {import('../src/interfaces/movie-clips.ts').MovieClips}
 */
// @ts-expect-error
const movieClips = window.movieClips;
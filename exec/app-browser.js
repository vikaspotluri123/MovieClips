// @ts-check

try {
	Promise.all([
		import('./jquery.js'),
		import('./lib/hammer.js'),
		import('./lib/material.js'),
	]);
} catch {}

import {filterFlat, readDirectory} from '../src/browser-files.ts';
import {MovieDb} from '../src/movie-db.ts';
import {eventBus} from '../src/event-bus.ts';
import {ElementRegistry} from '../src/element-registry.ts';
import * as mediaControls from '../src/components/media-controls.ts';
import * as video from '../src/components/video.ts';
import {keybindings} from '../src/keybindings.ts';

const videoEndHandler = eventBus.createRedirect('event:next', 'video_ended');

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
	shorty: true, // Stop after {range} seconds or play to end
	index: 0, // Video index
	range: { // Shorty - min & max length to play
		min: 10, // 180, // At least 3 minutes
		max: 11 // 360 // At most 6 minutes
	},
	supported: ['mp4', 'mkv'], // Supported file extensions
	shortyTimer: null, // Timeout for shorty; used to clear
	shortyTime: { // Time info for shorty
		set: -1, // The timer duration
		at: Date.now() // Current time
	},
	util: {
		setLoading(to) {
			movieClips.elements.read('body').classList.toggle('loading', Boolean(to));
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
				// TODO: determine if this actually works
				// @ts-ignore
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
			/** @type {string} */
			// @ts-expect-error
			const ext = movie.name.split('.').pop();
			if (!movieClips.supported.includes(ext)) {
				console.warn('[rejection]', movie);
				movieClips.vids.splice(index, 1); // Remove because it's not needed
				index--;
				eventBus.dispatch('event:next', 'invalid_movie');
				return true;
			}

			const video = movieClips.elements.read('#main');
			// Load the movie
			video.setAttribute('src', URL.createObjectURL(movie));
			// Update the movie title area
			/** @type {string} */
			// @ts-expect-error
			const title = movie.fullName.split('/')
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
				movieClips.shortyTimer = eventBus.dispatchAfter(stopAfter, 'event:next', 'clip_timer');
				movieClips.shortyTime.set = stopAfter;
				movieClips.shortyTime.at = Date.now();
			} else {
				console.warn('videoStop was called but shorty is false');
			}
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
		 * @this {HTMLVideoElement}
		 * @param {Event} [_] `Event` object that was fired. If called directly, no object will be present
		 */
		metadata(_) {
			// @todo add full video support
			const len = this.duration;
			let start = Math.floor((Math.random() * (len - 0.5 + 1)) + 0.5);
			if ((len - start) < movieClips.range.max) {
				start = len - movieClips.range.max;
			}

			this.currentTime = start;
		},
		/**
		 * @description: Adds listeners for pause and adds timeouts
		 * @param {Event} [_] The `Event` object that was fired. Should not be called directly.
		 */
		play(_) {
			const video = movieClips.elements.read('#main');
			video.removeEventListener('ended', videoEndHandler);
			if (movieClips.shorty) {
				movieClips.util.videoStop();
			} else {
				video.addEventListener('ended', videoEndHandler);
			}
		},
		pause(_) {
			if (movieClips.shortyTimer) {
				clearTimeout(movieClips.shortyTimer);
			}

			console.log('timeout cleared');
			movieClips.shortyTime.set = Date.now() - movieClips.shortyTime.at;
		},
		/**
		 * @description: Updates the UI when video speed is changed
		 * @this {HTMLVideoElement}
		 * @param {Event} [_] The `Event` object that was fired. If called directly, no object will be present
		 */
		ratechange(_) {
			movieClips.elements.read('#rate').textContent = this.playbackRate.toFixed(2);
		}
	},
	crash(error) {
		if (error instanceof NoDirectoriesError) {
			movieClips.util.setLoading(false);
			movieClips.elements.read('#selector').removeAttribute('hidden');
			movieClips.elements.read('#player').setAttribute('hidden', 'true');
		} else {
			console.error(error);
			movieClips.util.setStatus(`Something went wrong: ${error?.message ?? error}`, 'red');
		}
	},
	async initialize(_force = false) {
		movieClips.util.setLoading(true);
		movieClips.elements.read('#selector').setAttribute('hidden', 'true');
		movieClips.elements.read('#player').removeAttribute('hidden');
		movieClips.elements.read('#directory-selector').addEventListener('click', movieClips.handlers.directory);

		try {
			await movieClips.util.updateList();
		} catch (error)  {
			movieClips.crash(error);
		}

		movieClips.util.setStatus('Performing final preparations');
		eventBus.dispatch('hook:bind_events');
		keybindings.registerAll({
			// @key {escape}
			'27': movieClips.handlers.fullscreen,
			// @key {end}
			'35': () => eventBus.dispatch('event:next', 'key_end'),
			// @key {f}
			'102': movieClips.handlers.fullscreen,
		});
		keybindings.bind(document);
		movieClips.util.setStatus('Starting Up');
		if (movieClips.util.setMovie(0)) {
			movieClips.util.setStatus('Done... Goodbye');
			movieClips.util.setLoading(false);
		}
	}
};

// @ts-expect-error
window.movieClips ??= MovieClips;
/**
 * @type {import('../src/interfaces/movie-clips.ts').MovieClips}
 */
// @ts-expect-error
const movieClips = window.movieClips;
// @ts-expect-error
if (!window.mcI) {
	// @ts-expect-error
	window.mcI = movieClips.initialize();
}
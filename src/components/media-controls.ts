import {afterInitialization} from '../initialization.ts';
import {Elements, MovieClips} from '../interfaces/movie-clips.ts';

let movieClips: MovieClips;
let shortyToggleNode: Elements['#playPause'];
let backNode: Elements['#back'];
let nextNode: Elements['#next'];

export const eventHandlers = {
	/**
	 * @description: Controls the state of shorty (next clip after ${range})
	 */
	playPause() {
		const current = shortyToggleNode.textContent;
		if (current === 'pause') {
			movieClips.shorty = false;
			clearTimeout(movieClips.shortyTimer);
			console.log('timeout cleared');
			movieClips.shortyTime.set = -1;
			shortyToggleNode.textContent = 'play_arrow';
			Materialize.toast('Snippets Disabled', 2000);
		} else {
			movieClips.shorty = true;
			movieClips.util.videoStop();
			shortyToggleNode.textContent = 'pause';
			Materialize.toast('Snippets Enabled', 2000);
		}
	},
	/**
	 * @description: Moves to the next video [when the current video is over or times out (shorty)]
	 */
	next(event?: Event | string) {
		if (typeof event === 'object') {
			event.preventDefault();
		}

		// Reset shorty stuff
		movieClips.shortyTime.set = -1;
		if (movieClips.shortyTimer) {
			clearTimeout(movieClips.shortyTimer);
		}

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
			backNode.classList.add('disabled');
		} else {
			backNode.classList.remove('disabled');
			movieClips.util.setMovie(movieClips.index);
		}
	},
	/**
	 * @description: Moves to the previous video
	 */
	previous(event?: Event) {
		// Make sure it's possible to go back
		if (movieClips.index > 0) {
			event?.preventDefault();
			movieClips.index--;
			movieClips.util.setMovie(movieClips.index);
		} else {
			backNode.classList.add('disabled');
		}
	},
}

afterInitialization(() => {
	movieClips = (window as unknown as {movieClips: MovieClips}).movieClips;
	shortyToggleNode = movieClips.elements.take('#playPause');
	backNode = movieClips.elements.take('#back');
	nextNode = movieClips.elements.take('#next');
});
import {afterInitialization} from '../initialization.ts';
import {Elements, MovieClips} from '../interfaces/movie-clips.ts';

let movieClips: MovieClips;
let shortyToggleNode: Elements['#playPause'];

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
}

afterInitialization(() => {
	movieClips = (window as unknown as {movieClips: MovieClips}).movieClips;
	shortyToggleNode = movieClips.elements.take('#playPause');
});
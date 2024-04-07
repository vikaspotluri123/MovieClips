import {MovieClips} from '../interfaces/movie-clips.ts';

let movieClips: MovieClips;

export const eventHandlers = {
	/**
	 * @description: Controls the state of shorty (next clip after ${range})
	 */
	playPause(_: Event) {
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
}

setTimeout(() => {
	movieClips = (window as unknown as {movieClips: MovieClips}).movieClips;
});
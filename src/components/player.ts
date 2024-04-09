import {eventBus} from '../event-bus.ts';
import {Elements, MovieClips} from '../interfaces/movie-clips.ts';

let movieClips: MovieClips;
let playerNode: Elements['#player'];

export function setVisibility(isVisible: boolean) {
	playerNode.hidden = !isVisible;
}

eventBus.once('hook:bind_events', () => {
	movieClips = (window as unknown as {movieClips: MovieClips}).movieClips;

	playerNode = movieClips.elements.take('#player');
});
import {eventBus} from '../event-bus.ts';
import {Elements, MovieClips} from '../interfaces/movie-clips.ts';

let movieClips: MovieClips;
let selectorNode: Elements['#selector'];
let buttonNode: Elements['#directory-selector'];

export function setVisibility(isVisible: boolean) {
	selectorNode.hidden = !isVisible;
}

eventBus.once('hook:bind_events', () => {
	movieClips = (window as unknown as {movieClips: MovieClips}).movieClips;

	selectorNode = movieClips.elements.take('#selector');
	buttonNode = movieClips.elements.take('#directory-selector');

	buttonNode.addEventListener('click', movieClips.handlers.directory);
});
import {eventBus, trackedEvent} from '../event-bus.ts';
import {Elements, MovieClips} from '../interfaces/movie-clips.ts';

let movieClips: MovieClips;
let activationNode: Elements['#activation-button'];
let previousStatus: string;
const ACTIVATION_STATUS = 'Click the button to start reading directories';

export const eventHandlers = {
  click() {
    movieClips.util.setStatus(previousStatus);
    previousStatus = '';
    activationNode.hidden = true;
    movieClips.initialize();
  }
}

eventBus.once('hook:bind_events', () => {
	movieClips = (window as unknown as {movieClips: MovieClips}).movieClips;

	activationNode = movieClips.elements.take('#activation-button');
	activationNode.addEventListener('click', trackedEvent('event:user_activated', eventHandlers.click));
});

export function requestActivation() {
  const currentStatus = movieClips.elements.read('#status').innerText;
  if (currentStatus === ACTIVATION_STATUS) {
    return;
  }

  previousStatus = currentStatus;
  movieClips.util.setStatus(ACTIVATION_STATUS);
  activationNode.hidden = false;
}
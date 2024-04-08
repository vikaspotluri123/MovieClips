import {eventBus} from '../event-bus.ts';
import {Elements, MovieClips} from '../interfaces/movie-clips.ts';

let movieClips: MovieClips;
let videoNode: Elements['#main'];

export const actions = {
	play() {
		return videoNode.play();
	},
	pause() {
		videoNode.pause();
	},
	increaseSpeed(increment = 0.1): number {
		const current = videoNode.playbackRate;
		const min = 0.5; // Audio stops working below 0.5x
		const max = 4; // Audio stops working past 4x
		let final = current + increment; // Default increment 0.1x
		final = (final > max) ? max : final;
		final = (final < min) ? min : final;
		videoNode.playbackRate = final;
		return final;
	},
	decreaseSpeed(decrement = 0.1): number {
		const current = videoNode.playbackRate;
		const min = 0.5; // Audio stops working below 0.5x
		const max = 4; // Audio stops working past 4x
		let final = current - decrement; // Default decrement 0.1x
		final = (final < min) ? min : final;
		final = (final > max) ? max : final;
		videoNode.playbackRate = final;
		return final;
	},
	scrollForward(seconds = 5): number {
		const current = videoNode.currentTime;
		const min = 0.5; // Anything less than half a second isn't really noticeable
		const max = videoNode.duration - 0.5; // Half a second event buffer
		let final = current + seconds; // Default increment 5 seconds
		final = (final < min) ? min : final;
		final = (final > max) ? max : final;
		videoNode.currentTime = final;
		return final;
	},
	scrollBackward(seconds = 5): number {
		const video = videoNode;
		const current = video.currentTime;
		const min = 0.5; // Anything less than half a second isn't really noticeable
		const max = video.duration - 0.5; // Half a second event buffer
		let final = current - seconds; // Default increment 5 seconds
		final = (final < min) ? min : final;
		final = (final > max) ? max : final;
		video.currentTime = final;
		return final;
	},
	increaseVolume(percent = 0.05): number { // Default increment of 5%
		const video = videoNode;
		const current = video.volume;
		const min = 0;
		const max = 1;
		let final = current + percent;
		final = final < min ? min : final;
		final = final > max ? max : final;
		video.volume = final;
		return final;
	},
	decreaseVolume(percent: number = 0.05): number { // Default decrement of 5%
		const video = videoNode;
		const current = video.volume;
		const min = 0;
		const max = 1;
		let final = current - percent;
		final = final < min ? min : final;
		final = final > max ? max : final;
		video.volume = final;
		return final;
	},
	moveTo(seconds: number = 0.1): number {
		const video = videoNode;
		const min = 0.1; // Start a little after the beginning of the video
		const max = video.duration - 0.5; // Half a second event buffer
		seconds = ((seconds || min) > max) ? max : seconds;
		seconds = (seconds < min) ? min : seconds;
		video.currentTime = seconds;
		return seconds;
	},
	setVolume(level: number = 1): number {
		level = parseFloat(level.toFixed(2));
		level = level < 0 ? 0 : level;
		level = level > 1 ? 1 : level;
		videoNode.volume = level;
		return level;
	},
	mute() {
		videoNode.muted = true;
	},
	unMute() {
		videoNode.muted = false;
	},
	toggleMute() {
		const video = videoNode;
		video.muted = !(video.muted);
	},
	togglePlaying() {
		return (videoNode.paused ? actions.play() : actions.pause());
	}
};

eventBus.once('hook:bind_events', () => {
	movieClips = (window as unknown as {movieClips: MovieClips}).movieClips;
	videoNode = movieClips.elements.take('#main');

	videoNode.addEventListener('click', actions.togglePlaying); // We'll add a handler for this if needed in the future
	videoNode.addEventListener('dblclick', movieClips.handlers.fullscreen);
	videoNode.addEventListener('ratechange', movieClips.handlers.ratechange);
	videoNode.addEventListener('play', movieClips.handlers.play);
	videoNode.addEventListener('pause', movieClips.handlers.pause);
	videoNode.addEventListener('loadedmetadata', movieClips.handlers.metadata);
	videoNode.onerror = () => eventBus.dispatch('event:next', 'error');
});


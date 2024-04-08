import {eventBus, trackedEvent} from '../event-bus.ts';
import {Elements, MovieClips} from '../interfaces/movie-clips.ts';
import {keybindings} from '../keybindings.ts';

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
	moveTo(seconds = 0.1): number {
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
	videoNode = movieClips.elements.read('#main'); // TODO: This should be a take

	videoNode.addEventListener('dblclick', movieClips.handlers.fullscreen);
	videoNode.addEventListener('ratechange', movieClips.handlers.ratechange);
	videoNode.addEventListener('play', movieClips.handlers.play);
	videoNode.addEventListener('pause', movieClips.handlers.pause);
	videoNode.addEventListener('loadedmetadata', movieClips.handlers.metadata);
	videoNode.onerror = () => eventBus.dispatch('event:next', 'error');

	keybindings.registerAll({
		// @key {space}
		'32': trackedEvent('key_space', actions.togglePlaying),
		// @key {k}
		'107': trackedEvent('key_k', actions.togglePlaying),
		// @key {p}
		'112': trackedEvent('key_p', actions.togglePlaying),
		// @key {d}
		'100': trackedEvent('key_d', actions.increaseSpeed),
		// @key {j}
		'106': trackedEvent('key_j', () => actions.scrollBackward(10)),
		// @key {l}
		'108': trackedEvent('key_l', () => actions.scrollForward(10)),
		// @key {m}
		'109': trackedEvent('key_m', actions.toggleMute),
		// @key {s}
		'115': trackedEvent('key_s', actions.decreaseSpeed),
		// @key {home}
		'36': trackedEvent('key_home', () => actions.moveTo(0)),
		// @key {left-arrow}
		'37': trackedEvent('key_left_arrow', actions.scrollBackward),
		// @key {up-arrow}
		'38': trackedEvent('key_up_arrow', actions.increaseVolume),
		// @key {right-arrow}
		'39': trackedEvent('key_right_arrow', actions.scrollForward),
		// @key {down-arrow}
		'40': trackedEvent('key_down_arrow', actions.decreaseVolume),
	})
});


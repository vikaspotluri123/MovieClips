import {type MovieDb} from '../movie-db.ts';
import {type FileNode} from '../browser-files.ts';

export interface MovieClips {
	mediaElement: () => HTMLVideoElement;
	db: MovieDb;
	vids: FileNode[];
	isLoading: boolean;
	shorty: boolean;
	index: number;
	range: {
		min: number;
		max: number;
	};
	supported: string[];
	shortyTimer: number;
	shortyTime: {
		set: number;
		at: number;
	};
	util: {
		setLoading: (to: boolean) => void;
		setStatus: (to: string, color?: string | null) => void;
		setTitle: (title: string) => void;
		setMovie: (index: number) => boolean;
		updateList: () => Promise<void>;
		videoStop: () => void;
	};
	mediaActions: {
		play: () => Promise<void>;
		pause: () => void;
		increaseSpeed: (increment?: number) => number;
		decreaseSpeed: (decrement?: number) => number;
		scrollForward: (seconds?: number) => number;
		scrollBackward: (seconds?: number) => number;
		increaseVolume: (percent?: number) => number;
		decreaseVolume: (percent?: number) => number;
		moveTo: (seconds?: number) => number;
		setVolume: (level?: number) => number;
		mute: () => void;
		unMute: () => void;
		toggleMute: () => void;
		togglePlaying: () => Promise<void> | void;
	};
	handlers: {
		directory: () => Promise<void>;
		fullscreen: (event?: Event) => void;
		metadata: (event?: Event) => void;
		next: (event?: Event) => void;
		previous: (event?: Event) => void;
		keypress: (event: KeyboardEvent) => void;
		keydown: (event?: KeyboardEvent) => void;
		play: (event?: Event) => void;
		pause: (event?: any) => void;
		ratechange: (event?: Event) => void;
	};
	initialize: () => void;
}
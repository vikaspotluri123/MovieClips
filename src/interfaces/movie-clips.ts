import {type MovieDb} from '../movie-db.ts';
import {type FileNode} from '../browser-files.ts';
import {ElementRegistry} from '../element-registry.ts';

export type Elements = {
	'body': HTMLBodyElement;
	'#loading-wrapper': HTMLDivElement;
	'#progress-name': HTMLDivElement;
	'#status': HTMLParagraphElement;
	'#selector': HTMLDivElement;
	'#directory-selector': HTMLButtonElement;
	'#player': HTMLElement;
	'#video-wrapper': HTMLDivElement;
	'#meta': HTMLDivElement;
	'#rate': HTMLDivElement;
	'#title': HTMLDivElement;
	'#animatedActions': HTMLDivElement;
	'#action-play': HTMLDivElement;
	'#action-pause': HTMLDivElement;
	'#main': HTMLVideoElement;
	'#controls': HTMLDivElement;
	'#back': HTMLElement;
	'#playPause': HTMLElement;
	'#next': HTMLElement;
}

export interface MovieClips {
	db: MovieDb;
	vids: FileNode[];
	elements: ElementRegistry<Elements>;
	shorty: boolean;
	index: number;
	range: {
		min: number;
		max: number;
	};
	supported: string[];
	shortyTimer: ReturnType<typeof setTimeout> | null;
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
	handlers: {
		directory: () => Promise<void>;
		fullscreen: (event?: Event) => void;
		metadata: (event?: Event) => void;
		keypress: (event: KeyboardEvent) => void;
		keydown: (event: KeyboardEvent) => void;
		play: (event?: Event) => void;
		pause: (event?: any) => void;
		ratechange: (event?: Event) => void;
	};
	initialize: () => void;
}
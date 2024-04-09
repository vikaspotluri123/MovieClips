export type EventMap = {
	'hook:bind_events': void;
	'event:previous': 'previous_button';
	'event:next': 'error' | 'key_end' | 'video_ended' | 'invalid_movie' | 'clip_timer' | 'next_button';
}

type TrackedKeyEvents = 'space' | 'k' | 'p' | 'd' | 'j' | 'l' |'m' |'s' | 'home' | 'left_arrow' | 'up_arrow' | 'right_arrow' | 'down_arrow';
type KeyEvent = `key_${TrackedKeyEvents}`;

export type SpiedEvent = keyof EventMap | KeyEvent | 'event:user_activated';

interface EventSpy {
	events: Array<{timestamp: number, event: keyof SpiedEvent}>;
	track(event: SpiedEvent | CustomEvent): void;
}

let eventSpy: EventSpy | undefined;

class EventBus extends EventTarget {
	once<
		TEvent extends keyof EventMap,
		TPayload extends EventMap[TEvent] = EventMap[TEvent],
	>(
		type: TEvent,
		listener: TPayload extends void ? () => void : (payload: CustomEvent<TPayload>) => void,
		options?: boolean | AddEventListenerOptions
	): void {
		const callback = (...args) => {
			super.removeEventListener(type, callback, options);
			// @ts-expect-error it's not worth typing this
			listener(...args);
		};

		super.addEventListener(type, callback, options);
	}

	/**
	 * Returns a proxy function that can be used to route events from other busses to this bus.
	 * `event.preventDefault()` will be called on the source event before an event is dispatched
	 */
	createRedirect(...args: Parameters<EventBus['_dispatchEvent']>) {
		return (event: Event) => {
			event.preventDefault();
			// @ts-expect-error it's not worth typing this
			this._dispatchEvent(...args);
		}
	}

	dispatchAfter(delay: number, ...args: Parameters<EventBus['_dispatchEvent']>) {
		return setTimeout(() => {
			// @ts-expect-error it's not worth typing this
			this._dispatchEvent(...args);
		}, delay);
	}

	override removeEventListener<
		TEvent extends keyof EventMap,
		TPayload extends EventMap[TEvent] = EventMap[TEvent],
	>(
		type: TEvent,
		listener: TPayload extends void ? () => void : (payload: CustomEvent<TPayload>) => void,
		options?: boolean | EventListenerOptions
	): void {
		super.removeEventListener(type, listener, options);
	}

	private _addEventListener<
		TEvent extends keyof EventMap,
		TPayload extends EventMap[TEvent] = EventMap[TEvent],
	>(
		type: TEvent,
		listener: TPayload extends void ? () => void : (payload: CustomEvent<TPayload>) => void,
		options?: boolean | AddEventListenerOptions
	): void {
		super.addEventListener(type, listener, options);
	}


	private _dispatchEvent<
		TEvent extends keyof EventMap,
		TPayload extends EventMap[TEvent] = EventMap[TEvent],
	>(
		event: CustomEvent<TPayload> | TEvent,
		...args: TPayload extends void ? [] : [TPayload]
	): boolean {
		eventSpy?.track(event as TEvent);
		if (!(event instanceof Event)) {
			const detail = (args as TPayload[])[0];
			event = new CustomEvent(event, {detail});
		}

		return super.dispatchEvent(event);
	}

	/**
	 * @deprecated use `subscribe`
	 */
	addEventListener(...args: Parameters<EventBus['_addEventListener']>) {
		return this._addEventListener(...args);
	}

	/**
	 * @deprecated use `dispatch`
	 */
	// @ts-expect-error we're extending the class, not the interface
	dispatchEvent(...args: Parameters<EventBus['_dispatchEvent']>) {
		// @ts-expect-error it's not typing this
		return this._dispatchEvent(...args);
	}

	subscribe: typeof this._addEventListener = this._addEventListener.bind(this);
	dispatch: typeof this._dispatchEvent = this._dispatchEvent.bind(this);
}

export const eventBus = new EventBus();

export let trackedEvent: (eventName: SpiedEvent, callback: () => void) => (() => void) = (_, x) => x;

if (true) {
	trackedEvent = (eventName: SpiedEvent, callback: (...args: any[]) => void) => () => {
		eventSpy.track(eventName);
		callback(eventSpy!.events);
	};

	eventSpy = {
		events: [],
		track(event) {
			let eventAsString: string;
			if (event instanceof CustomEvent) {
				const detail: string = typeof event.detail === 'object' ? '(obj)' : event.detail;
				eventAsString = `${event.type} (${detail})`;
			} else {
				eventAsString = event;
			}

			this.events.push({
				timestamp: performance.now(),
				event: eventAsString,
			});
		},
	};

	globalThis.eventSpy = eventSpy.events;
}
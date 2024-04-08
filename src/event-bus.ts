export type EventMap = {
	'hook:bind_events': void;
	'hook:initialize': void;
}

interface EventSpy {
	events: Array<{timestamp: number, event: keyof EventMap}>;
	track(event: keyof EventMap): void;
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
		return this._dispatchEvent(...args);
	}

	subscribe: typeof this._addEventListener = this._addEventListener.bind(this);
	dispatch: typeof this._dispatchEvent = this._dispatchEvent.bind(this);
}

export const eventBus = new EventBus();

if (true) {
	eventSpy = {
		events: [],
		track(event) {
			this.events.push({
				timestamp: performance.now(),
				event,
			});
		},
	};

	globalThis.eventSpy = eventSpy.events;
}
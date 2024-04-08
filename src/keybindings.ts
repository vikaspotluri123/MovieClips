interface KeyBinding {
	exclusive: boolean;
	listeners: Array<() => void>;
}

const KEY_DOWN_ONLY_EVENTS = new Set([
	27,
	35,
	36,
	37,
	38,
	39,
	40,
]);

function getEventType(key: string) {
	return key in KEY_DOWN_ONLY_EVENTS ? 'keydown' : 'keypress';
}

function createEventListener(
	eventType: ReturnType<typeof getEventType>,
	bindings: Map<string, KeyBinding>,
	verbose: () => boolean,
) {
	return (event: KeyboardEvent) => {
		const handlerType = getEventType(String(event.keyCode));
		if (handlerType !== eventType) {
			return;
		}

		const listeners = bindings.get(String(event.keyCode))?.listeners;

		if (!listeners) {
			if (verbose()) {
				console.log('0 handlers found', event.keyCode, event.which);
			}

			return;
		}

		if (verbose()) {
			console.log('%d handler(s) for key %s', listeners.length, event.keyCode);
		}

		for (const listener of listeners) {
			listener();
		}
	}
}

export class KeybindingRegistry {
	private readonly _verbose: boolean;
	private readonly _bindings = new Map<string, KeyBinding>();
	private _frozen = false;

	constructor(verbose = true) {
		this._verbose = verbose;
	}

	register(key: string, listener: () => void, exclusive = false) {
		if (this._frozen) {
			throw new Error('Keybindings are frozen');
		}

		const keybinding = this._bindings.get(key);

		if (!keybinding) {
			this._bindings.set(key, {
				exclusive,
				listeners: [listener]
			});

			return;
		}

		if (keybinding.exclusive) {
			throw new Error(`An exclusive listener for ${key} was requested, cannot register another listener`);
		}

		if (exclusive) {
			throw new Error(`Key ${key} has a listener, cannot register an exclusive listener`);
		}

		keybinding.listeners.push(listener);
	}

	registerAll(listeners: Record<string, () => void>, exclusive = false) {
		for (const [key, listener] of Object.entries(listeners)) {
			this.register(key, listener, exclusive);
		}
	}

	bind(node: Pick<EventTarget, 'addEventListener'>) {
		this._frozen = true;
		const logUnboundEvents = () => this._verbose;
		node.addEventListener('keydown', createEventListener('keydown', this._bindings, logUnboundEvents));
		node.addEventListener('keypress', createEventListener('keypress', this._bindings, logUnboundEvents));
	}
}

export const keybindings = new KeybindingRegistry();

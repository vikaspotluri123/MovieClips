export class ElementRegistry<TConfig extends Record<string, Element>> {
	private readonly _nodes = new Map<string, Element>();

	constructor(elements: Array<keyof TConfig>) {
		for (const element of elements) {
			this._nodes.set(element as string, document.querySelector(element as string)!);
		}
	}

	take<TKey extends keyof TConfig>(key: TKey): TConfig[TKey] {
		const node = this.read(key);
		this._nodes.delete(key as string);
		return node;
	}

	read<TKey extends keyof TConfig>(key: TKey): TConfig[TKey] {
		if (!this._nodes.has(key as string)) {
			throw new Error(`Key ${key as string} was taken`);
		}

		const node = this._nodes.get(key as string)!;
		return node as TConfig[TKey];
	}
}
function promisifyRequest<T extends Record<'onerror' | 'onsuccess' | 'result' | 'error', any>>(request: T): Promise<Awaited<T['result']>> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export class MovieDb {
	private readonly _db: Promise<IDBDatabase>;

	constructor(
		public readonly dbName: string,
		public readonly storeName: string
	) {
		this.dbName = dbName;
		this.storeName = storeName;
		this._db = this._initialize();
	}

	/**
	 * @param {string} key
	 * @returns {Promise<FileSystemDirectoryHandle>}
	 */
	async fetch(key: string): Promise<FileSystemDirectoryHandle> {
		const db = await this._db;
		const request = db.transaction([this.storeName], 'readonly')
			.objectStore(this.storeName)
			.get(key);

		return promisifyRequest(request);
	}

	/**
	 * @param {string} key
	 * @param {FileSystemDirectoryHandle} value
	 */
	async store(key: string, value: FileSystemDirectoryHandle) {
		const db = await this._db;
		const request = db.transaction([this.storeName], 'readwrite')
			.objectStore(this.storeName)
			.put(value, key);

		await promisifyRequest(request);
	}

	/**
	 * @returns {Promise<string[]>}
	 */
	async getDirectories(): Promise<string[]> {
		const db = await this._db;
		const request = db.transaction([this.storeName], 'readonly')
			.objectStore(this.storeName)
			.getAllKeys();

		const keys = await promisifyRequest(request);
		if (!keys.every(key => typeof key ==='string')) {
			const invalidKeys = keys.filter(key => typeof key !== "string").join(', ');
			throw new Error(`Key(s) have invalid type: ${invalidKeys}`);
		}

		// @ts-expect-error the next version of typescript will understand that `keys` is guaranteed to be a `string[]`
		return keys;
	}

	/**
	 * @private
	 */
	async _initialize() {
		const request = window.indexedDB.open(this.dbName, 1);
		request.onupgradeneeded = () => {
			return request.result.createObjectStore(this.storeName);
		};

		return promisifyRequest(request);
	}
}
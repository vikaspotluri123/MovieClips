/**
 * Perform an in-place Durstenfeld shuffle
 */
export function shuffle(array: unknown[]) {
	for (let i = array.length - 1; i > 0; --i) {
		const swapIndex = Math.floor(Math.random() * (i + 1));
		const swapData = array[i];
		array[i] = array[swapIndex];
		array[swapIndex] = swapData;
	}
}

export const unique = <T>(array: T[]): T[] => Array.from(new Set(array));

export function runOnce<TCallback extends (...args: any[]) => any>(callback: TCallback | null) {
  let response: ReturnType<TCallback>;
	return (...args: Parameters<TCallback>) => {
		if (callback) {
			const callbackRef = callback;
			callback = null;
			response = callbackRef(...args);
		}

    return response;
	};
}
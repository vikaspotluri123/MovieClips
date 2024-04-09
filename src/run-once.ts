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
const _initializationBuffers = [];

export function afterInitialization(callback: () => void) {
	_initializationBuffers.push(callback);
}

export function initialized() {
  for (const callback of _initializationBuffers) {
    callback();
  }
}
export class ActivationRequiredError extends Error {
	constructor() {
		super('User has not interacted with the page');
	}
}

export class NoDirectoriesError extends Error {
	constructor() {
		super('No directories are available');
	}
}
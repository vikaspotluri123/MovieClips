export type FileNode = File & {fullName: string;};
export type Node = Directory | FileNode;
export type DirectoryNode = Record<string, Node>;
export type Directory = {fullName: string; tree: DirectoryNode;};

async function setProperty<T>(store: Record<string, T>, key: string, value: Promise<T>) {
	store[key] = await value;
}

function getNodeFile(node: FileSystemFileHandle, root: string): Promise<FileNode> {
	return node.getFile()
		.then(file => {
			(file as FileNode).fullName = `${root}/${file.name}`;
			return file as FileNode;
		});
}

export async function readDirectory(handle: FileSystemDirectoryHandle, parent: string | null = null): Promise<Directory> {
	const promises: Promise<any>[] = [];
	const tree: DirectoryNode = {};
	const newParent = `${parent ?? '@'}/${handle.name}`;

	for await (const node of handle.values()) {
		if (node.kind === 'directory') {
			promises.push(setProperty<Node>(tree, node.name, readDirectory(node, newParent)));
		} else {
			promises.push(setProperty<Node>(tree, node.name, getNodeFile(node, newParent)));
		}
	}

	await Promise.all(promises);
	return {
		fullName: newParent,
		tree,
	};
}

export function filterFlat(directory: Directory, extensions: string[]) {
	const response: FileNode[] = [];
	for (const [file, store] of Object.entries(directory.tree)) {
		if (store instanceof File) {
			const extension = file.split('.').pop()!;
			if (extensions.includes(extension)) {
				response.push(store);
			}
		} else {
			response.push(...filterFlat(store, extensions));
		}
	}

	return response;
}
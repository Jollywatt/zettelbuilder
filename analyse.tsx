import { walkSync } from "@std/fs"
import assert from "node:assert"
import * as Path from "@std/path"
import { render } from "preact-render-to-string"

export interface Note {
	name: string
	type: string | null
	dir: Array<string>
	files: { [ext: string]: string }
}

interface NoteTypes {
	[label: string]: Array<string>
}

function detectNoteKind(nt: NoteTypes, extensions: Set<string>): string | null {
	for (const [type, exts] of Object.entries(nt)) {
		if (extensions.symmetricDifference(new Set(exts)).size == 0) {
			return type
		}
	}
	return null
}

export function findNoteFiles(dir: string) {
	const dirnorm = dir.replace(/\/$/, "")
	const iter = walkSync(dirnorm, {
		includeDirs: false,
		match: [/\.note\.\w+$/],
	})

	return Array.from(iter).map((entry) => entry.path)
}

export function notesFromFiles(
	paths: Array<string>,
	{ noteTypes, root = "" }: { noteTypes: NoteTypes; root?: string },
): { [name: string]: Note } {
	const notes: { [name: string]: Note } = {}

	// for each path, extract note name, etc
	for (const path of paths) {
		const parts = Path.parse(path)

		const name = parts.name.replace(/\.note$/, "")
		const rel = Path.relative(root, parts.dir)
		const dir = rel.length ? rel.split(Path.SEPARATOR) : []

		if (!(name in notes)) {
			notes[name] = {
				name,
				dir,
				type: null,
				files: {},
			}
		} else {
			// don't allow notes of same name but different directories
			assert(
				notes[name].dir.join("/") == dir.join("/"),
				`Note name '${name}' used by files in different directories: found ${path} and ${
					Object.values(notes[name].files)
				}.`,
			)
		}

		const ext = parts.ext.slice(1)
		notes[name].files[ext] = path
	}

	// deduce note types from file extensions present
	for (const name in notes) {
		const extensions = Object.keys(notes[name].files)
		const type = detectNoteKind(noteTypes, new Set(extensions))
		if (type === null) {
			console.error(
				`Couldn't determine type of note "${name}" with extensions: ${
					extensions.join(", ")
				}`,
			)
			continue
		}
		notes[name].type = type
	}

	return notes
}

export interface NoteFolder {
	notes: { [name: string]: Note }
	folders: { [name: string]: NoteFolder }
}

export function notesByFolder(notes: { [name: string]: Note }): NoteFolder {
	const tree: NoteFolder = { notes: {}, folders: {} }

	for (const name in notes) {
		const note = notes[name]
		let dir = tree
		for (const c of note.dir) {
			if (dir.folders[c] === undefined) {
				dir.folders[c] = { notes: {}, folders: {} }
				dir = dir.folders[c]
			}
		}
		dir.notes[name] = note
	}

	return tree
}

interface Project {
	noteTypes: NoteTypes
	notes: { [name: string]: Note }
	tree: NoteFolder
	renderPage: Function
}

export function setupProject({
	srcdir,
	sitedir = "build/",
	noteTypes,
}: {
	srcdir: string
	sitedir: string
	noteTypes: NoteTypes
}): Project {
	const files = findNoteFiles(srcdir)
	const notes = notesFromFiles(files, {
		noteTypes: noteTypes,
		root: srcdir,
	})
	const tree = notesByFolder(notes)

	return {
		noteTypes,
		notes,
		tree,
		renderPage: (path: string, page) => {
			const sitepath = Path.join(sitedir, path)
			console.log(`Writing ${sitepath}`)
			Deno.writeTextFileSync(sitepath, render(page))
		},
	}
}

import { walkSync } from "@std/fs"
import assert from "node:assert"
import * as Path from "@std/path"
import { render } from "preact-render-to-string"

export interface Note {
	name: string
	kind: string | null
	dir: Array<string>
	files: { [ext: string]: string }
}

const combos: { [kind: string]: Set<string> } = {
	"Markdown": new Set(["md"]),
	"plain text": new Set(["txt"]),
	"Typst PDF": new Set(["typ", "pdf"]),
}

function detectNoteKind(extensions: Set<string>): string | null {
	for (const [kind, exts] of Object.entries(combos)) {
		if (extensions.symmetricDifference(exts).size == 0) {
			return kind
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
	options: { root: string } = { root: "" },
): { [name: string]: Note } {
	const notes: { [name: string]: Note } = {}

	// for each path, extract note name, etc
	for (const path of paths) {
		const parts = Path.parse(path)

		const name = parts.name.replace(/\.note$/, "")
		const rel = Path.relative(options.root, parts.dir)
		const dir = rel.length ? rel.split(Path.SEPARATOR) : []

		if (!(name in notes)) {
			notes[name] = {
				name,
				dir,
				kind: null,
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

	// deduce note kinds from file extensions present
	for (const name in notes) {
		const extensions = Object.keys(notes[name].files)
		const kind = detectNoteKind(new Set(extensions))
		if (kind === null) {
			console.error(
				`Couldn't determine kind of note "${name}" with extensions: ${
					extensions.join(", ")
				}`,
			)
			continue
		}
		notes[name].kind = kind
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
	notes: { [name: string]: Note }
	tree: NoteFolder
	renderPage: Function
}

export function setupProject(options: {
	srcdir: string
	sitedir: string
}): Project {
	const files = findNoteFiles(options.srcdir)
	const notes = notesFromFiles(files, { root: options.srcdir })
	const tree = notesByFolder(notes)

	return {
		notes,
		tree,
		renderPage: (path: string, page) => {
			const sitepath = Path.join(options.sitedir, path)
			console.log(`Writing ${sitepath}`)
			Deno.writeTextFileSync(sitepath, render(page))
		},
	}
}

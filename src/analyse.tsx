import { walkSync } from "@std/fs"
import assert from "node:assert"
import * as Path from "@std/path"
import { render } from "preact-render-to-string"
import { create as BrowserSync } from "browser-sync"

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
			}
			dir = dir.folders[c]
		}
		dir.notes[name] = note
	}

	return tree
}

export interface ProjectData {
	files: Array<string>
	notes: { [name: string]: Note }
	tree: NoteFolder
}

export class Project {
	srcdir: string
	sitedir: string
	noteTypes: NoteTypes
	builder: Function

	analysis: ProjectData | null

	constructor({
		srcdir,
		sitedir,
		noteTypes,
		builder,
	}: {
		srcdir: string
		sitedir: string
		noteTypes: NoteTypes
		builder: Function
	}) {
		this.srcdir = srcdir
		this.sitedir = sitedir
		this.noteTypes = noteTypes
		this.builder = builder
		this.analysis = null
	}

	analyse() {
		const files = findNoteFiles(this.srcdir)
		const notes = notesFromFiles(files, {
			noteTypes: this.noteTypes,
			root: this.srcdir,
		})
		const tree = notesByFolder(notes)

		this.analysis = {
			files,
			notes,
			tree,
		}

		return this.analysis
	}

	renderPage(path: string, page) {
		const sitepath = Path.join(this.sitedir, path)
		console.log(`Writing ${sitepath}`)
		Deno.writeTextFileSync(sitepath, render(page))
	}

	build() {
		console.log(`Building site at ${this.sitedir}`)
		// ensure site directory exists and is empty
		Deno.mkdirSync(this.sitedir, { recursive: true })
		Deno.removeSync(this.sitedir, { recursive: true })
		Deno.mkdirSync(this.sitedir)
		this.builder(this)
	}

	serve(
		{ autoreload = true, autobuild = true } = {
			autoreload: Boolean,
			autobuild: Boolean,
		},
	) {
		const bs = BrowserSync()

		if (autoreload) {
			bs.watch(Path.join(this.sitedir, "**/*.html")).on("change", bs.reload)
		}

		bs.watch(Path.join(this.srcdir, "**/*")).on("change", (path) => {
			console.log(`Detected change: ${path}`)
			this.build()
		})

		bs.watch(Deno.mainModule, (path) => {
			console.log(`Detected change in zettelsite package: ${path}`)
			this.build()
		})

		bs.init({
			server: this.sitedir,
			serveStatic: [this.sitedir],
			serveStaticOptions: {
				extensions: ["html"], // pretty urls
			},
			open: false,
		})
	}
}

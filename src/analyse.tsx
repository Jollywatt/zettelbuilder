import { existsSync, walkSync } from "@std/fs"
import assert from "node:assert"
import * as Path from "@std/path"
import { render } from "preact-render-to-string"
import { create as BrowserSync } from "browser-sync"

/**
 * A text file pointer with lazily loaded content.
 *
 * The file's content is read and stored on first request.
 */
class LazyFile {
	path: string
	#content: string | null = null

	constructor(path: string) {
		existsSync(path)
		this.path = path
	}

	get content() {
		if (this.#content === null) {
			console.log(`%cReading%c ${this.path}`, "color: yellow", "")
			this.#content = Deno.readTextFileSync(this.path)
		}
		return this.#content
	}
}

interface NoteInfo {
	name: string
	type: typeof Note
	dir: Array<string>
	files: { [ext: string]: LazyFile }
}

type NoteTypes = Array<typeof Note>

function detectNoteKind(
	nt: NoteTypes,
	extensions: Set<string>,
): typeof Note | undefined {
	for (const noteClass of nt) {
		const extSet = new Set(noteClass.extensionCombo)
		if (extSet.symmetricDifference(new Set(extensions)).size == 0) {
			return noteClass
		}
	}
	return undefined
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
	project: Project,
): { [name: string]: Note } {
	const noteInfo: { [name: string]: NoteInfo } = {}

	// for each path, extract note name, etc
	for (const path of paths) {
		const parts = Path.parse(path)

		const name = parts.name.replace(/\.note$/, "")
		const rel = Path.relative(project.srcdir, parts.dir)
		const dir = rel.length ? rel.split(Path.SEPARATOR) : []

		if (!(name in noteInfo)) {
			noteInfo[name] = {
				name,
				dir,
				type: Note,
				files: {},
			}
		} else {
			// don't allow notes of same name but different directories
			assert(
				noteInfo[name].dir.join("/") == dir.join("/"),
				`NoteInfo name '${name}' used by files in different directories: found ${path} and ${
					Object.values(noteInfo[name].files)
				}.`,
			)
		}

		const ext = parts.ext.slice(1)
		noteInfo[name].files[ext] = new LazyFile(path)
	}

	// deduce note types from file extensions present
	for (const name in noteInfo) {
		const extensions = Object.keys(noteInfo[name].files)
		const type = detectNoteKind(project.noteTypes, new Set(extensions))
		if (type === undefined) {
			console.error(
				`Couldn't determine type of note "${name}" with extensions: ${
					extensions.join(", ")
				}`,
			)
			continue
		} else {
			noteInfo[name].type = type
		}
	}

	const notes: { [name: string]: Note } = {}
	for (const name in noteInfo) {
		const info = noteInfo[name]
		const NoteClass = info.type
		notes[name] = new NoteClass({
			name: info.name,
			dir: info.dir,
			files: info.files,
			sitedir: project.sitedir,
			siteroot: project.siteroot,
		})
	}

	return notes
}

export interface NoteFolder {
	notes: { [name: string]: Note }
	folders: { [name: string]: NoteFolder }
}

export function notesByFolder(
	notes: { [name: string]: Note },
): NoteFolder {
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

export class Note {
	static extensionCombo: string[] = []

	name: string
	dir: string[]
	files: { [extension: string]: LazyFile }
	sitedir: string
	siteroot: string

	getTitle(): string {
		return this.name
	}

	#title: string | null = null
	get title(): string {
		if (this.#title === null) this.#title = this.getTitle()
		return this.#title
	}

	static description: string | null = null
	get description() {
		const staticDescription = (this.constructor as typeof Note).description
		if (staticDescription !== null) return staticDescription
		return Object.keys(this.files).sort().join(", ")
	}

	constructor({
		name,
		dir,
		files,
		sitedir,
		siteroot,
	}) {
		this.name = name
		this.dir = dir
		this.files = files
		this.sitedir = sitedir
		this.siteroot = siteroot
	}

	refs: { outgoing: Note[]; incoming: Note[] } = {
		outgoing: [],
		incoming: [],
	}
	extractRefs(allNames: Set<string>): Set<string> {
		return new Set()
	}

	render(): preact.JSX.Element | string {
		console.log(
			`%cUsing default renderer%c for ${this.description} note "${this.name}"`,
			"color: red",
			"",
		)
		return (
			<main>
				This page was generated by the default note renderer.
				<pre>{Deno.inspect(this)}</pre>
			</main>
		)
	}
}

function getCrossrefGraph(notes: Note[]) {
	const outgoing: Record<string, Set<string>> = {}
	const incoming: Record<string, Set<string>> = {}
	const allNames = new Set(notes.map((note) => note.name))
	for (const note of notes) {
		const refs = note.extractRefs(allNames)
		let undefinedRefs = refs.difference(allNames)
		if (undefinedRefs.size) {
			throw Error(
				`Found unknown crossrefs in ${note.description} note "${note.name}": ${
					Deno.inspect(undefinedRefs)
				}`,
			)
		}
		outgoing[note.name] = refs
		for (const ref of refs) {
			if (!(ref in incoming)) incoming[ref] = new Set()
			incoming[ref].add(note.name)
		}
	}
	return { outgoing, incoming }
}

export interface ProjectData {
	files: Array<string>
	notes: { [name: string]: Note }
	tree: NoteFolder
	refs: {
		outgoing: { [name: string]: Set<string> }
		incoming: { [name: string]: Set<string> }
	}
}

export class Project {
	srcdir: string
	sitedir: string
	siteroot: string
	noteTypes: NoteTypes
	builder: Function

	analysis: ProjectData = {
		files: [],
		notes: {},
		tree: { notes: {}, folders: {} },
		refs: { outgoing: {}, incoming: {} },
	}

	constructor({
		srcdir,
		sitedir,
		siteroot = "/",
		noteTypes,
		builder,
	}: {
		srcdir: string
		sitedir: string
		siteroot?: string
		noteTypes: NoteTypes
		builder: Function
	}) {
		this.srcdir = srcdir
		this.sitedir = sitedir
		this.siteroot = siteroot
		this.noteTypes = noteTypes
		this.builder = builder
	}

	analyse() {
		const files = findNoteFiles(this.srcdir)
		const notes = notesFromFiles(files, this)
		const tree = notesByFolder(notes)
		const refs = getCrossrefGraph(Object.values(notes))
		for (const dir of ["outgoing", "incoming"]) {
			for (const name in notes) {
				const names = Array.from(refs[dir][name] ?? []) as string[]
				notes[name].refs[dir] = names.sort().map((name) => notes[name])
			}
		}

		this.analysis = {
			files,
			notes,
			tree,
			refs,
		}

		return this.analysis
	}

	renderPage(path: string, page) {
		const sitepath = Path.join(this.sitedir, path)
		console.log(`%cWriting%c ${sitepath}`, "font-weight: bold", "")
		const html = typeof page === "string"
			? page
			: `<!DOCTYPE html>` + render(page, { pretty: true })
		Deno.writeTextFileSync(sitepath, html)
	}

	build() {
		console.log(`%cBuilding%c site at ${this.sitedir}`, "font-weight: bold", "")
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
			bs.watch(Path.join(this.sitedir, "**/*.{html,css}")).on(
				"change",
				bs.reload,
			)
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

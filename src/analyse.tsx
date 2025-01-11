import { copySync, existsSync, walkSync } from "@std/fs"
import * as Path from "@std/path"
import { render } from "@preact/render"
import { startServer } from "./server.tsx"

function log(verb, message = "", color = "white") {
	console.log(
		`%c${verb}%c ${message}`,
		`color: ${color}; font-weight: bold`,
		"",
	)
}

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
			// log("Reading", this.path, "yellow")
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
		const rel = Path.relative(project.srcDir, parts.dir)
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
			if (noteInfo[name].dir.join("/") != dir.join("/")) {
				log(
					"┌ Repeated name",
					`"${name}" occurs in different directories:`,
					"red",
				)
				;[path, ...Object.values(noteInfo[name].files).map((file) => file.path)]
					.forEach((path) => log("├╴", path, "red"))
				log(
					"└",
					`Multi-file notes are expected to be in the same directory.`,
					"red",
				)
			}
		}

		const ext = parts.ext.slice(1)
		noteInfo[name].files[ext] = new LazyFile(path)
	}

	// deduce note types from file extensions present
	for (const name in noteInfo) {
		const extensions = Object.keys(noteInfo[name].files)
		const type = detectNoteKind(project.noteTypes, new Set(extensions))
		if (type === undefined) {
			log(
				"Unknown type",
				`of note "${name}" with extensions: ${extensions.join(", ")}`,
				"orange",
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

	/**
	 * Unique ID for the note.
	 *
	 * This defines the permalink used to reference notes.
	 */
	name: string
	dir: string[]
	/**
	 * Note files that belong to this note.
	 */
	files: { [extension: string]: LazyFile }

	/**
	 * Extract the note's full title (as opposed to its name).
	 *
	 * Override this if the note files can encode metadata such as a title
	 * (for example, the first heading of a markdown document could be considered the title).
	 *
	 * By default, this falls back to the notes name.
	 */
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
	}) {
		this.name = name
		this.dir = dir
		this.files = files
	}

	refs: { outgoing: Note[]; incoming: Note[] } = {
		outgoing: [],
		incoming: [],
	}
	extractRefs(allNames: Set<string>): Set<string> {
		return new Set()
	}

	render(project: Project): preact.JSX.Element | string {
		log(
			"Default renderer",
			`used for ${this.description} note "${this.name}"`,
			"orange",
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

/**
 * oieof
 */
export class Project {
	/** Path to directory containing note files. */
	srcDir: string
	/** Output directory for generated static site files. */
	buildDir: string
	/** Files or folders to copy to the output directory.
	 *
	 * Useful for including CSS and other static site assets.
	 *
	 * Keys are paths to files or folders in the current directory, and values are paths relative to `buildDir`.
	 */
	copyPaths: Record<string, string>
	/** Root directory to display URLs under. */
	urlRoot: string
	noteTypes: NoteTypes
	indexPage: Function

	analysis: ProjectData = {
		files: [],
		notes: {},
		tree: { notes: {}, folders: {} },
		refs: { outgoing: {}, incoming: {} },
	}

	constructor({
		srcDir,
		buildDir,
		copyPaths = {},
		theme,
	}: {
		srcDir: string
		buildDir: string
		copyPaths?: Record<string, string>
		theme: {
			ROOT: string
			noteTypes: NoteTypes
			indexPage: Function
		}
	}) {
		this.srcDir = srcDir
		this.buildDir = buildDir
		this.copyPaths = copyPaths
		this.urlRoot = theme.ROOT
		this.noteTypes = theme.noteTypes
		this.indexPage = theme.indexPage
	}

	analyse() {
		const files = findNoteFiles(this.srcDir)
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

	async renderPage(path: string, page) {
		const sitepath = Path.join(this.buildDir, path)
		log("Writing", `${sitepath}`, "white")
		const html = typeof page === "string"
			? page
			: `<!DOCTYPE html>` + render(page, { pretty: true })
		Deno.writeTextFileSync(sitepath, html)
	}

	async build() {
		let time = new Date().getTime()
		log("Building", `site at ${this.buildDir}`, "yellow")

		// ensure site directory exists and is empty
		Deno.mkdirSync(this.buildDir, { recursive: true })
		Deno.removeSync(this.buildDir, { recursive: true })
		Deno.mkdirSync(this.buildDir)

		// copy assets
		for (let [src, dest] of Object.entries(this.copyPaths)) {
			dest = Path.join(this.buildDir, dest)
			log("Copying", `${src} to ${dest}`)
			copySync(src, dest)
		}

		// render index page
		const { notes, tree } = this.analyse()
		await this.renderPage("index.html", this.indexPage(this))

		// render note pages
		for (const name in notes) {
			const note = notes[name]
			const html = await note.render(this)
			await this.renderPage(`${name}.html`, html)
		}

		log("Built", `site in ${new Date().getTime() - time}ms`, "green")
	}

	serve({ port }: { port?: null | number } = {}) {
		const watchPaths = [this.srcDir, ...Object.keys(this.copyPaths)]
		startServer({
			fsRoot: this.buildDir,
			urlRoot: this.urlRoot,
			watchPaths,
			onChange: () => this.build(),
			port: port,
		})
	}
}

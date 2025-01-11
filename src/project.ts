import {
	copySync,
	type existsSync,
	LazyFile,
	log,
	render,
	walkSync,
} from "./utils.ts"
import { join, parse, relative, SEPARATOR } from "@std/path"
import { Note, type NoteFolder, type NoteInfo } from "./note.ts"
import { startServer } from "./server.tsx"

function detectNoteType(
	nt: Array<typeof Note>,
	extensions: Set<string>,
): typeof Note {
	for (const noteClass of nt) {
		const extSet = new Set(noteClass.extensionCombo)
		if (extSet.symmetricDifference(new Set(extensions)).size == 0) {
			return noteClass
		}
	}
	log(
		"Unknown type",
		`of note "${name}" with extensions: ${Deno.inspect(extensions)}`,
		"orange",
	)
	return Note
}

export function notesFromFiles(
	paths: Array<string>,
	project: Project,
): { [name: string]: Note } {
	const noteInfo: { [name: string]: NoteInfo } = {}

	// for each path, extract note name, etc
	for (const path of paths) {
		const parts = parse(path)
		const name = parts.name.replace(/\.note$/, "")
		const ext = parts.ext.slice(1)

		const rel = relative(project.srcDir, parts.dir)
		const dir = rel.length ? rel.split(SEPARATOR) : []

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
				const paths = Object.values(noteInfo[name].files).map((file) =>
					file.path
				)
				for (const p in [path, ...paths]) log("├╴", p, "red")
				log(
					"└",
					`Multi-file notes are expected to be in the same directory.`,
					"red",
				)
			}
		}

		noteInfo[name].files[ext] = new LazyFile(path)
	}

	// deduce note types from file extensions present
	for (const name in noteInfo) {
		const extensions = new Set(Object.keys(noteInfo[name].files))
		noteInfo[name].type = detectNoteType(project.noteTypes, extensions)
	}

	// construct note instances of the applicable subclasses
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

/**
 * Collection of all cross references between notes detected in the project.
 *
 * Outgoing and incoming links refer to notes by {@link Note.name}.
 */
export interface CrossRefs {
	/** Notes linked to by each note. */
	outgoing: { [name: string]: Set<string> }
	/** Notes linking to each note. */
	incoming: { [name: string]: Set<string> }
}

/**
 * Type representing the notes, files, and references found in the project.
 */
export interface ProjectData {
	/** Paths to the note files discovered in the project relative to the {@link Project.srcDir} directory. */
	files: Array<string>
	/** Notes found in the project by their name. */
	notes: { [name: string]: Note }
	/**
	 * Notes found in the project by the folder they were found in.
	 *
	 * This is a tree structure which is helpful for rendering tables of contents.
	 */
	tree: NoteFolder
	/** Directed graph of cross references detected between notes. */
	refs: CrossRefs
}

/**
 * oieof
 */
export class Project {
	/** Path to directory containing note files. */
	public srcDir: string
	/** Output directory for generated static site files. */
	buildDir: string
	/** Files or folders to copy to the output directory.
	 *
	 * Useful for including CSS and other static site assets.
	 *
	 * Keys are paths to files or folders in the current directory, and values are paths relative to `buildDir`.
	 */
	copyPaths: Record<string, string>
	/**
	 * Root directory to prefix URLs with.
	 *
	 * The live server requires requested URLs to start with this root.
	 */
	urlRoot: string
	/**
	 * Note subclasses which are used to detect and render each type of note.
	 *
	 * If a note's file extensions do not match {@link Note.extensionCombo} for any
	 * of the subclasses provided here, a default renderer is used (with a warning).
	 */
	noteTypes: Array<typeof Note>
	indexPage: Function

	/**
	 * Object which holds project data after {@linkcode Project.analyse} is called.
	 */
	public analysis: ProjectData = {
		files: [],
		notes: {},
		tree: { notes: {}, folders: {} },
		refs: { outgoing: {}, incoming: {} },
	}

	getNoteFiles() {
		const dirnorm = this.srcDir.replace(/\/$/, "")
		const iter = walkSync(dirnorm, {
			includeDirs: false,
			match: [/\.note\.\w+$/],
		})

		return Array.from(iter).map((entry) => entry.path)
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
			noteTypes: Array<typeof Note>
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

	/**
	 * Find all notes in the project and detect cross references.
	 *
	 * Result is returned and stored in {@link Project.analysis}.
	 */
	analyse(): ProjectData {
		const files = this.getNoteFiles()
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
		const sitepath = join(this.buildDir, path)
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
			dest = join(this.buildDir, dest)
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

	/**
	 * Start serving the project and watching for changes.
	 * 
	 * Changes to files in {@link Project.srcDir} or any of the paths in {@link Project.copyPaths}
	 * will cause the project to rebuild and refresh any connected clients.
	 */
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

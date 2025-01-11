import { type LazyFile, log } from "./utils.ts"
import type { Project } from "./project.ts"

export interface NoteInfo {
	name: string
	type: typeof Note
	dir: Array<string>
	files: { [ext: string]: LazyFile }
}

export interface NoteFolder {
	notes: { [name: string]: Note }
	folders: { [name: string]: NoteFolder }
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

	/**
	 * Detect any cross references appearing in the note, returning a set of note names.
	 * This is used to build the project's {@link CrossRefs} graph.
	 * 
	 * Usually, this method should read the contents of one of the note's files and use
	 * a regular expression to extract the names of all referenced notes.
	 */
	extractRefs(allNames: Set<string>): Set<string> {
		return new Set()
	}

	/**
	 * Render the note as HTML.
	 *
	 * This method should be overridden for each note type, to determine
	 * how the note should be displayed in a webpage. Otherwise, the default
	 * renderer is used and a warning is logged.
	 *
	 * During {@link Project.build}, the result of this method is used to populate
	 * the note's static site page at `{Project.buildDir}/{this.name}.html`.
	 */
	render(project: Project): preact.JSX.Element | string {
		log(
			"Default renderer",
			`used for ${this.description} note "${this.name}"`,
			"orange",
		)
		return `
		This page was generated by the default note renderer.
		<pre>${Deno.inspect(this)}</pre>
		`
	}
}
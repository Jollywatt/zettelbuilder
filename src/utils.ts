import { existsSync } from "@std/fs"
import type * as Path from "@std/path"
import type { render } from "@preact/render"
import type { startServer } from "./server.tsx"

export { render } from "@preact/render"
export { copySync, existsSync, walkSync } from "@std/fs"

export function log(verb, message = "", color = "white") {
	console.log(
		`%c${verb}%c ${message}`,
		`color: ${color}; font-weight: bold`,
		"",
	)
}

/**
 * A text file whose content is read and stored when {@link LazyFile.content}
 * is accessed. Subsequent accesses used the cached result.
 */
export class LazyFile {
	/** File path to read from. */
	path: string
	#content: string | null = null

	constructor(path: string) {
		existsSync(path)
		this.path = path
	}

	/** Full content of the text file. */
	get content() {
		if (this.#content === null) {
			// log("Reading", this.path, "yellow")
			this.#content = Deno.readTextFileSync(this.path)
		}
		return this.#content
	}
}

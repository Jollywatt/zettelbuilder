import { walk } from "@std/fs"
import assert from "node:assert"
import * as Path from "@std/path"

interface Note {
	name: string
	kind: string | null
	// dir: string,
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

export async function findNoteFiles(dir: string) {
	const dirnorm = dir.replace(/\/$/, "")
	const iter = walk(dirnorm, {
		includeDirs: false,
		match: [/\.note\.\w+$/],
	})

	const entries = await Array.fromAsync(iter)
	return entries.map((entry) => entry.path.slice(dirnorm.length + 1))
}

export function detectNotes(paths: Array<string>) {
	const notes: { [name: string]: Note } = {}

	for (const path of paths) {
		const parts = Path.parse(path)

		const name = parts.name.replace(/\.note$/, "")
		const dir = parts.dir.length ? parts.dir.split(Path.SEPARATOR) : []

		if (!(name in notes)) {
			notes[name] = {
				name,
				dir,
				kind: null,
				files: {},
			}
		} else {
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

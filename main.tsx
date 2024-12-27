import { walk } from "@std/fs"
import render from "preact-render-to-string"

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

interface Note {
	name: string
	kind: string
	files: { [ext: string]: string }
}

export async function findNotes(src: string) {
	const iter = walk(src, {
		includeDirs: false,
		match: [/\.note\.\w+$/],
	})

	const filesByName: { [name: string]: { [ext: string]: string } } = {}

	for await (const file of iter) {
		const m = file.name.match(/(.+)\.note\.(.+)/)
		if (m) {
			const [_, name, ext] = m
			if (!(name in filesByName)) filesByName[name] = {}
			filesByName[name][ext] = file.path
		}
	}

	const notes: { [name: string]: Note } = {}

	for (const name in filesByName) {
		const extensions = Object.keys(filesByName[name])
		const kind = detectNoteKind(new Set(extensions))
		if (kind === null) {
			console.error(
				`Couldn't determine kind of note "${name}" with extensions: ${
					extensions.join(", ")
				}`,
			)
			continue
		}
		notes[name] = {
			name: name,
			kind: kind,
			files: filesByName[name],
		}
	}

	return notes
}

function Main() {
	return (
		<div>
			This is my site
		</div>
	)
}

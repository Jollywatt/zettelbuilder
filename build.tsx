import { render } from "preact-render-to-string"
import { detectNotes, findNoteFiles, Note } from "./analyse.tsx"
import assert from "node:assert"
import * as path from "@std/path"

import { parseArgs } from "jsr:@std/cli/parse-args"

function renderToFile(content: any, path: string) {
	Deno.writeTextFileSync(path, render(content))
}

interface NoteFolder {
	notes: { [name: string]: Note }
	folders: { [name: string]: NoteFolder }
}

function getTree(notes: { [name: string]: Note }) {
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

const tocEntry = (note: Note) => (
	<li>
		<a style={{ fontFamily: "monospace" }} href={note.name}>[{note.name}]</a>
		<span style={{ fontSize: "0.8em" }}>{note.kind}</span>
	</li>
)

function tocList(toc: NoteFolder) {
	const notenames = Object.keys(toc.notes).sort()
	const foldernames = Object.keys(toc.folders).sort()
	return (
		<>
			<ul>
				{notenames.map((name) => tocEntry(toc.notes[name]))}
				{foldernames.map((name) => (
					<li>
						{name}
						{tocList(toc.folders[name])}
					</li>
				))}
			</ul>
		</>
	)
}

function indexPage(toc: NoteFolder) {
	return (
		<>
			<h1>Index</h1>
			{tocList(toc)}
		</>
	)
}

export async function build(srcdir: string, outdir: string) {
	const files = await findNoteFiles(srcdir)
	const notes = detectNotes(files, { root: srcdir })
	const toc = getTree(notes)
	renderToFile(indexPage(toc), path.join(outdir, "index.html"))
}

if (import.meta.main) {
	const flags = parseArgs(Deno.args)
	assert.ok(flags.src, `--src flag not provided`)
	assert.ok(flags.out, `--out flag not provided`)

	build(flags.src, flags.out)
}

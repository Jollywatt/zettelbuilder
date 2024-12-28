import { render } from "preact-render-to-string"
import { analyseEverything, notesByFolder } from "./analyse.tsx"
import assert from "node:assert"
import * as path from "@std/path"

import { parseArgs } from "jsr:@std/cli/parse-args"

function renderToFile(content: any, path: string) {
	Deno.writeTextFileSync(path, render(content))
}

const tocEntry = (note: Note) => (
	<li>
		<a style={{ fontFamily: "monospace" }} href={note.name}>[{note.name}]</a>
		<span style={{ fontSize: "0.8em" }}>{note.kind}</span>
	</li>
)

function toc(node: NoteFolder) {
	const notenames = Object.keys(node.notes).sort()
	const foldernames = Object.keys(node.folders).sort()
	return (
		<>
			<ul>
				{notenames.map((name) => tocEntry(node.notes[name]))}
				{foldernames.map((name) => (
					<li>
						{name}
						{toc(node.folders[name])}
					</li>
				))}
			</ul>
		</>
	)
}

function indexPage(notes) {
	return (
		<>
			<h1>Index</h1>
			<p>Hello and welcome.</p>
			{toc(notesByFolder(notes))}
		</>
	)
}

export function build(srcdir: string, outdir: string) {
	const { notes } = analyseEverything(srcdir)
	renderToFile(indexPage(notes), path.join(outdir, "index.html"))
}

if (import.meta.main) {
	const flags = parseArgs(Deno.args)
	assert.ok(flags.src, `--src flag not provided`)
	assert.ok(flags.out, `--out flag not provided`)

	build(flags.src, flags.out)
}

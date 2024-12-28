import render from "preact-render-to-string"
import { detectNotes, findNoteFiles } from "./analyse.tsx"
import assert from "node:assert"
import * as path from "@std/path"

import { parseArgs } from "jsr:@std/cli/parse-args"

function renderToFile(content, path) {
	Deno.writeTextFileSync(path, render(content))
}

async function build(srcdir: string, outdir: string) {
	const files = await findNoteFiles(srcdir)
	const notes = detectNotes(files)
	const a = (
		<div>
			<h1>Basic site</h1>
			<pre>{JSON.stringify(notes, null, 2)}</pre>
		</div>
	)

	renderToFile(a, path.join(outdir, "index.html"))
}

if (import.meta.main) {
	const flags = parseArgs(Deno.args)
	assert.ok(flags.src, `--src flag not provided`)
	assert.ok(flags.out, `--out flag not provided`)

	build(flags.src, flags.out)
}

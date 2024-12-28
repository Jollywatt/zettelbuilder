import render from "preact-render-to-string"
import { findNotes } from "./analyse.tsx"
import * as path from "@std/path"

import { parseArgs } from "jsr:@std/cli/parse-args"

function renderToFile(content, path) {
	Deno.writeTextFileSync(path, render(content))
}

async function build(srcdir: string, outdir: string) {
	const notes = await findNotes(srcdir)
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

	build(flags.src, flags.out)
}

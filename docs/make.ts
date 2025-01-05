import { Project, Zetteldocs } from "../src/main.ts"

const project = new Project({
	noteTypes: [
		Zetteldocs.MarkdownNote,
	],
	srcdir: "docs/src/",
	sitedir: "docs/site/",
	builder: Zetteldocs.build,
})

project.build()
const [command] = Deno.args
if (command === "serve") project.serve()

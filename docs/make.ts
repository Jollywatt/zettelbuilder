import { Project, Zetteldocs } from "../src/main.ts"

const project = new Project({
	noteTypes: [
		Zetteldocs.MarkdownNote,
	],
	srcdir: "docs/src/",
	sitedir: "docs/site/",
	siteroot: "/zettelbuilder/",
	builder: Zetteldocs.build,
})

const [command] = Deno.args
if (command === "serve") project.serve()
else project.build()

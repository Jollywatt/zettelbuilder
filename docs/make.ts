import { Project, Zetteldocs } from "../src/mod.ts"

const project = new Project({
	noteTypes: [
		Zetteldocs.MarkdownNote,
	],
	srcDir: "docs/src/",
	buildDir: "docs/site/",
	urlRoot: "/zettelbuilder/",
	builder: Zetteldocs.build,
})

const [command] = Deno.args
if (command === "serve") project.serve()
else project.build()

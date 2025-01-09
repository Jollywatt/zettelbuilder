import { Project, Zetteldocs } from "../src/mod.ts"

const project = new Project({
	srcDir: "docs/src/",
	buildDir: "docs/site/",
	urlRoot: "/zettelbuilder/",
	theme: Zetteldocs,
})

await project.build()

const [command] = Deno.args
if (command === "serve") project.serve()

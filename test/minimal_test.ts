import { Minimal, Project } from "@jollywatt/zettelbuilder"

const project = new Project({
	srcDir: "test/example-notes",
	buildDir: "site/",
	theme: Minimal,
})

project.build()

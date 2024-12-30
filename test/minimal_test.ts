import { Project } from "../src/analyse.tsx"
import { build } from "../src/themes/minimal.tsx"

const project = new Project({
	noteTypes: {
		"markdown": ["md"],
		"typst pdf": ["typ", "pdf"],
		"plain text": ["txt"],
	},
	srcdir: "test/example-notes",
	sitedir: "build/",
	builder: build,
})

project.build()

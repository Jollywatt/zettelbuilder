import { Project } from "../src/analyse.tsx"
import {
	build,
	ExternalURLNote,
	MarkdownNote,
	PlainTextNote,
	TypstNote,
} from "../src/themes/minimal.tsx"

const project = new Project({
	noteTypes: [
		MarkdownNote,
		PlainTextNote,
		ExternalURLNote,
		TypstNote,
	],
	srcDir: "test/example-notes",
	buildDir: "site/",
	builder: build,
})

project.build()

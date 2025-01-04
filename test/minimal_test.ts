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
	srcdir: "test/example-notes",
	sitedir: "site/",
	builder: build,
})

project.build()

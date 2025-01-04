import { Project } from "../src/analyse.tsx"
import {
	build,
	ExternalURLNote,
	MarkdownNote,
	PlainTextNote,
	TypstNote,
} from "../src/themes/minimal.tsx"

const project = new Project({
	// noteTypes: {
	// 	"markdown": ["md"],
	// 	"typst pdf": ["typ", "pdf"],
	// 	"plain text": ["txt"],
	// },
	noteTypes: [MarkdownNote, PlainTextNote, ExternalURLNote, TypstNote],
	srcdir: "test/example-notes",
	sitedir: "build/",
	builder: build,
})

project.build()

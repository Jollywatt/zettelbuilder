import { setupProject } from "../analyse.tsx"
import { build, markdownNote } from "../themes/minimal.tsx"

const project = setupProject({
	noteTypes: {
		"markdown": ["md"],
		"typst pdf": ["typ", "pdf"],
		"plain text": ["txt"],
	},
	noteRenderers: {
		"markdown": markdownNote,
	},
	srcdir: "test/example-notes",
	sitedir: "build/",
})

build(project)

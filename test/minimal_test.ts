import { setupProject } from "../analyse.tsx"
import Minimal from "../themes/minimal.tsx"

const project = setupProject({
	noteTypes: {
		"markdown": ["md"],
		"typst pdf": ["typ", "pdf"],
		"plain text": ["txt"],
	},
	srcdir: "test/example-notes",
	sitedir: "build/",
})

Minimal(project)

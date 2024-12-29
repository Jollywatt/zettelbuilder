import { setupProject } from "../analyse.tsx"
import { build, renderMarkdown } from "../themes/minimal.tsx"

const project = setupProject({
	noteTypes: {
		"markdown": ["md"],
		"typst pdf": ["typ", "pdf"],
		"plain text": ["txt"],
	},
	noteRenderers: {
		"markdown": renderMarkdown,
	},
	srcdir: "test/example-notes",
	sitedir: "build/",
})

build(project)

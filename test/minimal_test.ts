import { setupProject } from "../analyse.tsx"
import Minimal from "../themes/minimal.tsx"

const project = setupProject({
	srcdir: "test/example-notes",
	sitedir: "build/",
})

Minimal(project)

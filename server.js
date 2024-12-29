import { setupProject } from "./analyse.tsx"
import { build } from "./themes/minimal.tsx"

const project = setupProject({
	noteTypes: {
		"markdown": ["md"],
		"typst pdf": ["typ", "pdf"],
		"plain text": ["txt"],
	},
	srcdir: "test/example-notes",
	sitedir: "build/",
})

import { create } from "browser-sync"
const bs = create()

bs.watch("build/**/*.html").on("change", bs.reload)

bs.watch("**/*.{ts,tsx,js,jsx,md}").on("change", (path) => {
	console.log(`Detected change: ${path}`)
	build(project)
})

// init starts the server
bs.init({
	server: "./build",
})

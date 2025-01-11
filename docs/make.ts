import { Project } from "@jollywatt/zettelbuilder"
import * as Theme from "./theme.tsx"

const project = new Project({
	srcDir: "docs/src/",
	buildDir: "docs/site/",
	copyPaths: {
		"docs/assets": "assets",
		"docs/reference": "reference",
	},
	theme: Theme,
})

await project.build()

const [command] = Deno.args
if (command === "serve") project.serve()

import { assertEquals } from "@std/assert"
import { assertSnapshot } from "@std/testing/snapshot"

import { findNoteFiles, notesFromFiles } from "../src/analyse.tsx"

Deno.test("note detection", async (shot) => {
	await assertSnapshot(
		shot,
		notesFromFiles([
			`maths/a.note.md`,
			`maths/b.note.md`,
			`c.note.typ`,
			`c.note.pdf`,
		], {
			noteTypes: {
				"Markdown": ["md"],
				"Typst PDF": ["typ", "pdf"],
			},
		}),
	)
})

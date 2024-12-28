import { assertEquals } from "@std/assert"
import { assertSnapshot } from "@std/testing/snapshot"

import { detectNotes, findNoteFiles } from "../analyse.tsx"

Deno.test("note detection", async (shot) => {
	await assertSnapshot(
		shot,
		detectNotes([
			`maths/a.note.md`,
			`maths/b.note.md`,
			`c.note.typ`,
			`c.note.pdf`,
		]),
	)
})

Deno.test("find notes", async function (shot) {
	const src = "test/example-notes"
	const paths = await findNoteFiles(src)
	const notes = detectNotes(paths, { root: src })

	console.log(notes)
})

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
	const paths = await findNoteFiles("test/example-notes")
	const notes = detectNotes(paths)
	// await assertSnapshot(shot, notes);

	console.log(notes)
})

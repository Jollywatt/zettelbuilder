import { assertEquals } from "@std/assert"
import { assertSnapshot } from "@std/testing/snapshot"

import { findNotes } from "../analyse.tsx"

Deno.test("find notes", async function (shot) {
	const notes = await findNotes("test")
	// await assertSnapshot(shot, notes);
	console.log(notes)
})

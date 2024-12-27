import { assertEquals } from "@std/assert"
import { findNotes } from "./main.tsx"

Deno.test({
	name: "read file test",
	permissions: { read: true },
	async fn() {
		console.log(await findNotes("test"))
	},
})

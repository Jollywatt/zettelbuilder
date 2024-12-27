import { assertEquals } from "@std/assert"
import { add } from "./main.tsx"

Deno.test(function addTest() {
	assertEquals(add(2, 3), 5)
})

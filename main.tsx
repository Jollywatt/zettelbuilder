export function add(a: number, b: number): number {
	const el = <span>{a + b}</span>
	return el.props.children
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
	console.log("Add 2 + 3 =", add(2, 3))
}

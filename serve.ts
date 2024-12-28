import { serveDir, serveFile } from "jsr:@std/http/file-server"

Deno.serve((req: Request) => {
	// const pathname = new URL(req.url).pathname

	// return serveFile(req, "./path/to/file.txt")
	// console.log(pathname)
	// if (pathname === "/simple_file") {
	// }

	// if (pathname.startsWith("/static")) {
	// }

	return serveDir(req, {
		fsRoot: "build",
		urlRoot: "",
	})
})

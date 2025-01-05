import { extname, join, relative, resolve } from "@std/path"
import { walk } from "@std/fs"
import { serveFile } from "@std/http"

function log(verb, message, color = "white") {
	console.log(
		`%c${verb}%c ${message}`,
		`color: ${color}; font-weight: bold`,
		"",
	)
}

async function handler(req: Request, { fsRoot, urlRoot }): Promise<Response> {
	const url = new URL(req.url)
	let filePath = join(fsRoot, relative(urlRoot, url.pathname))

	try {
		const fileInfo = await Deno.stat(filePath)

		// If directory, look for index.html
		if (fileInfo.isDirectory) {
			filePath = join(filePath, "index.html")
		}
	} catch {
		// Handle "pretty links" by appending ".html" if file not found
		filePath += ".html"
	}

	try {
		const file = await Deno.readFile(filePath)
		return new Response(file, { status: 200 })
	} catch {
		const debugInfo = Deno.inspect({
			url: url.pathname,
			filePath,
			cwd: Deno.cwd(),
		})
		return new Response(`Not Found: ${debugInfo}`, { status: 404 })
	}
}

export async function startServer({
	fsRoot = "site/",
	urlRoot = "/",
	port = 8000,
	watchPatterns = ["docs/site/", "docs/src/"],
	rebuild = () => {},
}: {
	fsRoot?: string // Directory to serve files from
	urlRoot?: string // Directory to serve files from
	port?: number // Server port
	watchPatterns?: string[] // Glob patterns to watch for changes
	rebuild?: Function
}) {
	urlRoot = join("/", urlRoot)
	const watcher = Deno.watchFs(watchPatterns)
	const connections = new Set<WebSocket>()

	const fsRootFull = resolve(fsRoot)

	// Detect file changes and notify clients
	async function watchFiles() {
		for await (const event of watcher) {
			if (event.kind === "modify" || event.kind === "create") {
				log(
					"Change detected",
					event.paths.map((path) => relative(fsRootFull, path)).join(", "),
				)
				for (const websocket of connections) {
					websocket.send("reload")
					// rebuild()
					log("Rebuilding", "site", "red")
				}
			}
		}
	}

	// WebSocket endpoint for live reload
	function handleWebSocket(req: Request): Response {
		const { socket, response } = Deno.upgradeWebSocket(req)
		socket.onopen = () => connections.add(socket)
		socket.onclose = () => connections.delete(socket)
		return response
	}

	// Start the server
	log("Serving", `from ${fsRoot} on http://localhost:${port}${urlRoot}`)
	log("Watching", `paths ${watchPatterns.join(", ")}`)
	Deno.serve({ port }, (req) => {
		if (req.headers.get("upgrade") === "websocket") {
			return handleWebSocket(req)
		}
		return handler(req, { fsRoot, urlRoot })
	})

	// Watch for file changes
	watchFiles()
}

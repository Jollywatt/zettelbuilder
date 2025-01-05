import { serve } from "https://deno.land/std@0.182.0/http/server.ts"
import {
	extname,
	join,
	relative,
} from "https://deno.land/std@0.182.0/path/mod.ts"
import { walk } from "https://deno.land/std@0.182.0/fs/mod.ts"

function log(verb, message, color = "white") {
	console.log(
		`%c${verb}%c ${message}`,
		`color: ${color}; font-weight: bold`,
		"",
	)
}

// Get the content type based on the file extension
function getContentType(filePath: string): string {
	const ext = extname(filePath)
	const contentTypes: Record<string, string> = {
		".html": "text/html",
		".css": "text/css",
		".js": "text/javascript",
		".json": "application/json",
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".svg": "image/svg+xml",
		".ico": "image/x-icon",
	}
	return contentTypes[ext] || "application/octet-stream"
}

export async function startServer({
	staticDir = "site/",
	siteRoot = "/",
	port = 8000,
	watchPatterns = ["docs/site/", "docs/src/"],
}: {
	staticDir?: string // Directory to serve files from
	siteRoot?: string // Directory to serve files from
	port?: number // Server port
	watchPatterns?: string[] // Glob patterns to watch for changes
}) {
	const watcher = Deno.watchFs(watchPatterns)
	const connections = new Set<WebSocket>()

	// Serve static files
	async function handler(req: Request): Promise<Response> {
		const url = new URL(req.url)
		let filePath = join(staticDir, relative(siteRoot, url.pathname))

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
			const contentType = getContentType(filePath)
			return new Response(file, {
				status: 200,
				headers: { "content-type": contentType },
			})
		} catch {
			return new Response("404 Not Found", { status: 404 })
		}
	}

	// Detect file changes and notify clients
	async function watchFiles() {
		for await (const event of watcher) {
			if (event.kind === "modify" || event.kind === "create") {
				log("Change detected", event.paths)
				for (const ws of connections) {
					ws.send("reload")
				}
			}
		}
	}

	// WebSocket endpoint for live reload
	function wsHandler(req: Request): Response {
		const { socket, response } = Deno.upgradeWebSocket(req)
		socket.onopen = () => connections.add(socket)
		socket.onclose = () => connections.delete(socket)
		return response
	}

	// Start the server
	log("Serving", `from ${staticDir} on http://localhost:${port}`)
	log("Watching", `paths ${watchPatterns.join(", ")}`)
	serve((req) => {
		if (req.headers.get("upgrade") === "websocket") {
			return wsHandler(req)
		}
		return handler(req)
	}, { port })

	// Watch for file changes
	watchFiles()
}

// Example usage
if (import.meta.main) {
	startServer({
		staticDir: "docs/site",
		siteRoot: "/zettelbuilder",
		port: 2020,
	})
}

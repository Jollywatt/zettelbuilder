import { extname, join, relative, resolve } from "@std/path"
import { walk } from "@std/fs"

function log(verb, message, color = "white") {
	console.log(
		`%c${verb}%c ${message}`,
		`color: ${color}; font-weight: bold`,
		"",
	)
}

function wait(millis: number) {
	return new Promise((resolve) => setTimeout(resolve, millis))
}

class BufferedCallback {
	callback: Function
	warmup: number // how long in millis after the most recent trigger to wait before callback
	cooldown: number // how long in millis after the last callback to wait before accepting more triggers

	constructor(
		callback: Function,
		{ warmup, cooldown }: { warmup: number; cooldown: number },
	) {
		this.callback = callback
		this.warmup = warmup
		this.cooldown = cooldown
	}

	waitUntil: number = 0
	buffered: number = 0
	locked = false

	trigger() {
		if (this.locked) return
		const now = new Date().getTime()
		const until = this.waitUntil
		this.waitUntil = now + this.warmup
		this.buffered++
		if (now <= until) return

		setTimeout(async () => {
			this.locked = true
			await this.callback({ buffered: this.buffered })
			await wait(this.cooldown)
			this.buffered = 0
			this.locked = false
		}, this.warmup)
	}
}

async function handleFile(
	req: Request,
	{ buildDir, urlRoot },
): Promise<Response> {
	const url = new URL(req.url)
	let filePath = join(buildDir, relative(urlRoot, url.pathname))

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
	buildDir,
	urlRoot = "/",
	port = 8000,
	watchPaths = [],
	onChange = () => {},
}: {
	buildDir: string
	urlRoot?: string
	port?: number
	watchPaths?: string[]
	onChange?: Function
}) {
	urlRoot = join("/", urlRoot)
	const buildDirFull = resolve(buildDir)

	const watcher = Deno.watchFs(watchPaths)
	const sockets = new Set<WebSocket>()

	function logStatus() {
		console.log(
			`%cServing%c at %chttp://localhost:${port}${urlRoot}`,
			"color: cyan; font-weight: bold",
			"",
			"text-decoration: underline",
		)
		log("Watching", `for changes in ${watchPaths.join(", ")}`, "cyan")
	}

	const buildCallback = new BufferedCallback(async ({ buffered }) => {
		console.clear()
		// log("Watched", `${buffered} file change${buffered == 1 ? "" : "s"}`, 'cyan')
		await onChange()
		for (const socket of sockets) socket.send("reload")
		logStatus()
	}, { warmup: 100, cooldown: 500 })

	// Detect file changes and notify clients
	async function watchFiles() {
		for await (const event of watcher) {
			buildCallback.trigger()
		}
	}

	// WebSocket endpoint for live reload
	function handleWebSocket(req: Request): Response {
		const { socket, response } = Deno.upgradeWebSocket(req)
		socket.onopen = () => {
			log("WebSocket", "connected")
			sockets.add(socket)
		}
		socket.onclose = () => sockets.delete(socket)
		return response
	}

	Deno.serve({ port }, (req) => {
		if (req.headers.get("upgrade") === "websocket") {
			return handleWebSocket(req)
		}
		return handleFile(req, { buildDir, urlRoot })
	})

	watchFiles()
	logStatus()
}

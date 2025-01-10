import { extname, join, relative, resolve } from "@std/path"
import { walk } from "@std/fs"
import { render } from "@preact/render"

const clientReloadScript = `
function openWebSocket(onopen) {
	const ws = new WebSocket("ws://"+location.host)
	ws.onopen = onopen
	ws.onmessage = (msg) => {
		if (msg.data === "reload") location.reload()
	}
	ws.onerror = (msg) => {
		document.getElementById("connection-status").style.opacity = "1"
		setTimeout(() => {
			openWebSocket(() => location.reload())
		}, 10)
	}
}
openWebSocket()
`
const ClientReloader = () => (
	<>
		<script dangerouslySetInnerHTML={{ __html: clientReloadScript }} />
		<div
			id="connection-status"
			style={{
				position: "fixed",
				top: 0,
				right: 0,
				background: "red",
				color: "white",
				padding: "10px",
				opacity: 0,
				zIndex: 100_000,
				fontFamily: "sans-serif",
				transition: "opacity 0.5s ease-in-out 0.5s",
			}}
		>
			Reconnecting...
		</div>
	</>
)

const clientReloadInjectionHTML = new TextEncoder().encode(
	render(<ClientReloader />),
)

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
	{ fsRoot, urlRoot },
): Promise<Response> {
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

	let bytes: Uint8Array
	try {
		// Try to read file
		bytes = await Deno.readFile(filePath)
	} catch (error) {
		// Send error page with debug info if reading fails
		const debugInfo = Deno.inspect({
			url: url.pathname,
			filePath,
			cwd: Deno.cwd(),
			error: error,
		})
		return new Response(`Not Found: ${debugInfo}`, { status: 404 })
	}

	if (filePath.endsWith("html")) {
		// Inject client autoreloader for HTML pages
		const combined = new Uint8Array(
			bytes.length + clientReloadInjectionHTML.length,
		)
		combined.set(bytes)
		combined.set(clientReloadInjectionHTML, bytes.length)
		return new Response(combined, {
			status: 200,
		})
	} else {
		// Return other files as-is
		return new Response(bytes, {
			status: 200,
		})
	}
}

export async function checkPort(
	port: number,
	hostname = "0.0.0.0",
): Promise<boolean> {
	try {
		const listener = await Deno.listen({ port, hostname })
		await listener.close()
		return true
	} catch {
		return false
	}
}

async function getAvailablePort(): Promise<number> {
	let port = 3000
	while (port < 4000) {
		if (await checkPort(port)) return port
		port++
	}
	throw new Error("Couldn't find a free port")
}

export async function startServer({
	fsRoot,
	urlRoot = "/",
	watchPaths = [],
	onChange = () => {},
	port = null,
}: {
	fsRoot: string
	urlRoot?: string
	watchPaths?: string[]
	onChange?: Function
	port?: number | null
}) {
	urlRoot = join("/", urlRoot)
	const fsRootFull = resolve(fsRoot)

	const watcher = Deno.watchFs(watchPaths)
	const sockets = new Set<WebSocket>()

	if (port == null) port = await getAvailablePort()

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
			log("Client", `auto-refresh waiting`, "pink")
			sockets.add(socket)
		}
		socket.onclose = () => sockets.delete(socket)
		return response
	}

	try {
		Deno.serve({ port }, (req) => {
			if (req.headers.get("upgrade") === "websocket") {
				return handleWebSocket(req)
			}
			return handleFile(req, { fsRoot, urlRoot })
		})
	} catch (error) {
		log("Failed", `to connect to port ${port}.`, "red")
		throw error
	}

	watchFiles()
	logStatus()
}

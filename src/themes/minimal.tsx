import { Note, NoteFolder, Project } from "../analyse.tsx"
import { CSS, render as renderMarkdown } from "@deno/gfm"

const base = ({ head, body }) => (
	<html>
		<head>
			<meta charSet="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			{head}
		</head>
		<body>{body}</body>
	</html>
)

const json = (obj) => <pre>{JSON.stringify(obj, null, 2)}</pre>

const indexPage = (tree: NoteFolder) =>
	base({
		head: <title>Index</title>,
		body: (
			<main>
				<h1>Index</h1>
				<p>This is the minimal theme.</p>
				<h2>Notes by folder</h2>
				{toc(tree)}
			</main>
		),
	})

const tocEntry = (note: Note) => (
	<li>
		<a style={{ fontFamily: "monospace" }} href={`${note.name}.html`}>
			[{note.name}]
		</a>
		<span style={{ fontSize: "0.8em" }}>{note.type}</span>
	</li>
)

function toc(node: NoteFolder) {
	const notenames = Object.keys(node.notes).sort()
	const foldernames = Object.keys(node.folders).sort()
	return (
		<ul>
			{notenames.map((name) => tocEntry(node.notes[name]))}
			{foldernames.map((name) => (
				<li>
					{name}
					{toc(node.folders[name])}
				</li>
			))}
		</ul>
	)
}

const header = (note) => (
	<p>
		<b>
			<a href="/">Index</a> / <span>{note.name}</span>
		</b>
	</p>
)

const defaultRenderer = (note) =>
	base({
		head: <title>{note.name}</title>,
		body: (
			<main>
				{header(note)}
				No renderer is defined for note type <code>{note.type}</code>.
				<pre>{JSON.stringify(note, null, 2)}</pre>
			</main>
		),
	})

const noteRenderers: { [noteType: string]: Function } = {}

noteRenderers["markdown"] = async function (note) {
	let md = await Deno.readTextFile(note.files.md)
	md = md
		.replace(/\(@([-\w]+)\)/g, (_, name) => `(${name}.html)`)
		.replace(/@([-\w]+)/g, (handle, name) => `[${handle}](${name}.html)`)
	const html = renderMarkdown(md)
	return base({
		head: (
			<>
				<title>{note.name}</title>
				<style>{CSS}</style>
			</>
		),
		body: (
			<>
				{header(note)}
				<pre>{md}</pre>
				<pre>{html}</pre>
				<main
					dangerouslySetInnerHTML={{ __html: html }}
					className="markdown-body"
				>
				</main>
			</>
		),
	})
}

noteRenderers["plain text"] = async function (note) {
	const txt = await Deno.readTextFile(note.files.txt)
	return base({
		head: <title>{note.name}</title>,
		body: (
			<>
				{header(note)}
				<main>
					<pre>{txt}</pre>
				</main>
			</>
		),
	})
}

export async function build(project: Project) {
	const { notes, tree } = project.analyse()
	project.renderPage("index.html", indexPage(tree))

	for (const name in notes) {
		const note: Note = notes[name]
		const renderer = noteRenderers[note.type ?? "unknown"] ?? defaultRenderer
		const html = await renderer(note)
		project.renderPage(`${name}.html`, html)
	}
}
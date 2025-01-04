import { Note, NoteFolder, Project } from "../analyse.tsx"
import { CSS, render as renderMarkdown } from "@deno/gfm"

const json = (obj) => <pre>{JSON.stringify(obj, null, 2)}</pre>

function Base({ head, children }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				{head}
			</head>
			<body>{children}</body>
		</html>
	)
}

function NotePage({ note, children, head = <></> }) {
	head = (
		<>
			<title>Notes | {note.name}</title>
			{head}
		</>
	)
	return (
		<Base head={head}>
			<NoteHeader note={note} />
			<main>{children}</main>
		</Base>
	)
}

function indexPage(tree: NoteFolder) {
	return (
		<Base head={<title>Index</title>}>
			<main>
				<h1>Index</h1>
				<p>This is the minimal theme.</p>
				<h2>Notes by folder</h2>
				{toc(tree)}
			</main>
		</Base>
	)
}

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

function NoteHeader({ note }) {
	return (
		<p>
			<b>
				<a href="/">Index</a> / <span>{note.name}</span>
			</b>
		</p>
	)
}

const defaultRenderer = (note) => (
	<NotePage note={note}>
		No renderer is defined for note type <code>{note.type}</code>.
		<pre>{JSON.stringify(note, null, 2)}</pre>
	</NotePage>
)

const noteRenderers: { [noteType: string]: Function } = {}

noteRenderers["markdown"] = (note) => {
	let md = note.files.md.content
		.replace(/\(@([-\w]+)\)/g, (_, name) => `(${name}.html)`)
		.replace(/@([-\w]+)/g, (handle, name) => `[${handle}](${name}.html)`)
	const html = renderMarkdown(md)
	return (
		<NotePage note={note} head={<style>{CSS}</style>}>
			<div
				dangerouslySetInnerHTML={{ __html: html }}
				className="markdown-body"
			/>
		</NotePage>
	)
}

noteRenderers["plain text"] = (note) => (
	<NotePage note={note}>
		<pre>{note.files.txt.content}</pre>
	</NotePage>
)

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

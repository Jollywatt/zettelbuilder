import { Note, NoteFolder } from "../analyse.tsx"
import { CSS, render as renderMarkdown } from "@deno/gfm"

const base = ({ head, body }) => (
	<html>
		<head>{head}</head>
		<body>{body}</body>
	</html>
)

const indexPage = (project) =>
	base({
		head: <title>Index</title>,
		body: (
			<main>
				<h1>Index</h1>
				<p>This is the minimal theme.</p>
				<h2>Notes by folder</h2>
				{toc(project.tree)}
			</main>
		),
	})

const tocEntry = (note: Note) => (
	<li>
		<a style={{ fontFamily: "monospace" }} href={`${note.name}.html`}>
			[{note.name}]
		</a>
		<span style={{ fontSize: "0.8em" }}>{note.kind}</span>
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

const notePage = (note) =>
	base({
		head: <title>{note.name}</title>,
		body: (
			<main>
				<h1>{note.name}</h1>
				<h2>{note.kind}</h2>
				<pre>{JSON.stringify(note, null, 2)}</pre>
			</main>
		),
	})

export async function markdownNote(note) {
	const md = await Deno.readTextFile(note.files.md)
	const html = renderMarkdown(md)
	return base({
		head: <title>{note.name}</title>,
		body: <main dangerouslySetInnerHTML={{ __html: html }}></main>,
	})
}

const defaultRenderer = (note) =>
	base({
		head: <title>{note.name}</title>,
		body: (
			<main>
				<h1>{note.name}</h1>
				No renderer is defined for notes of type <code>{note.kind}</code>.
				<pre>{JSON.stringify(note, null, 2)}</pre>
			</main>
		),
	})

export async function build(project) {
	project.renderPage("index.html", indexPage(project))

	for (const name in project.notes) {
		const note = project.notes[name]
		const renderer = project.noteRenderers[note.kind] ?? defaultRenderer
		const html = await renderer(note)
		project.renderPage(`${name}.html`, html)
	}
}

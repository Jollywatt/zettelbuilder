import { Note, NoteFolder } from "../analyse.tsx"

const base = (title, body) => (
	<html>
		<head>
			<title>Minimal | {title}</title>
		</head>
		<body>{body}</body>
	</html>
)

const indexPage = (project) =>
	base(
		`Index`,
		<>
			<h1>Index</h1>
			<p>This is the minimal theme.</p>
			<h2>Notes by folder</h2>
			{toc(project.tree)}
		</>,
	)

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
	base(
		note.name,
		<>
			<h1>{note.name}</h1>
			<h2>{note.kind}</h2>
			<pre>{JSON.stringify(note, null, 2)}</pre>
		</>,
	)

export function renderMarkdown(note) {
	return base(
		note.name,
		<>
			<h1>{note.name}</h1>
			This is a markdown note.
			<pre>{note.files.md}</pre>
		</>,
	)
}

const defaultRenderer = (note) =>
	base(
		note.name,
		<>
			<h1>{note.name}</h1>
			<h2>{note.kind}</h2>
			No renderer is defined for the note type <code>{note.kind}</code>.
			<pre>{JSON.stringify(note, null, 2)}</pre>
		</>,
	)

export function build(project) {
	project.renderPage("index.html", indexPage(project))

	for (const name in project.notes) {
		const note = project.notes[name]
		const renderer = project.noteRenderers[note.kind] ?? defaultRenderer
		project.renderPage(`${name}.html`, renderer(note))
	}
}

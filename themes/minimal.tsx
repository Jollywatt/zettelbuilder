import { Note, NoteFolder } from "../analyse.tsx"

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

const indexPage = (project) =>
	base(
		`Index`,
		<>
			<h1>Index</h1>
			<p>This is the minimal theme.</p>
			{toc(project.tree)}
		</>,
	)

const notePage = (note) =>
	base(
		note.name,
		<>
			<h1>{note.name}</h1>
			<h2>{note.kind}</h2>
			<pre>{JSON.stringify(note, null, 2)}</pre>
		</>,
	)

const base = (title, body) => (
	<html>
		<head>
			<title>Minimal | {title}</title>
		</head>
		<body>{body}</body>
	</html>
)

export default function build(project) {
	project.renderPage("index.html", indexPage(project))

	for (const note of Object.values(project.notes) as Array<Note>) {
		project.renderPage(`${note.name}.html`, notePage(note))
	}
}

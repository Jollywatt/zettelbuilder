import { Note, NoteFolder, Project } from "@jollywatt/zettelbuilder"
import { CSS, render as renderMarkdown } from "@deno/gfm"

const SiteName = () => <span>Zettelbuilder 📑</span>

function Page({ project, head, children }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				{head}
				<style>{CSS}</style>
			</head>
			<body className="markdown-body">{children}</body>
		</html>
	)
}

export function indexPage(project: Project) {
	return (
		<Page project={project} head={<title>Index</title>}>
			<main>
				<h1>
					<SiteName /> documentation
				</h1>
				<p>
					This is the documentation for Zettelbuilder, a static site generator
					for Zettelkasten notes.
				</p>
				<p>These docs were generated with Zettelbuilder.</p>
				<h2>Contents</h2>
				{toc(project.analysis.tree)}
			</main>
		</Page>
	)
}

function NoteLink({ note }: { note: Note }) {
	const sitepath = `${note.name}`
	return (
		<span>
			<a href={sitepath}>
				<code>[{note.name}]</code>
			</a>{" "}
			{note.description}
		</span>
	)
}

function NotePage({ project, note, children, head = <></> }) {
	head = (
		<>
			<title>Zettelbuilder / {note.title}</title>
			{head}
		</>
	)
	return (
		<Page project={project} head={head}>
			<NoteHeader project={project} note={note} />
			<main>{children}</main>
			{note.refs.outgoing.length
				? (
					<>
						Outgoing:
						<ul>
							{note.refs.outgoing.map((note) => (
								<li>
									<NoteLink note={note} />
								</li>
							))}
						</ul>
					</>
				)
				: null}
			{note.refs.incoming.length
				? (
					<>
						Incoming:
						<ul>
							{note.refs.incoming.map((note) => (
								<li>
									<NoteLink note={note} />
								</li>
							))}
						</ul>
					</>
				)
				: null}
		</Page>
	)
}

const tocEntry = (note: Note) => (
	<li>
		<a href={note.name}>{note.title}</a>
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
					<strong>{name}</strong>
					{toc(node.folders[name])}
				</li>
			))}
		</ul>
	)
}

function NoteHeader({ project, note }) {
	return (
		<p>
			<b>
				<a href={project.urlRoot}>
					<SiteName />
				</a>{" "}
				/ <span>{note.title}</span>
			</b>
		</p>
	)
}

export class MarkdownNote extends Note {
	static override description = "markdown"
	static override extensionCombo = ["md"]

	override getTitle() {
		const match = this.files.md.content.match(/#\s*(.*)/)
		if (match === null) return "title unknown"
		return match[1]
	}

	override extractRefs() {
		return new Set(
			this.files.md.content.matchAll(/@([-\w]+)/g).map((match) => match[1]),
		)
	}

	override render(project: Project) {
		let md = this.files.md.content
			.replace(/\(@([-\w]+)\)/g, (_, name) => `(${name}.html)`)
			.replace(/@([-\w]+)/g, (handle, name) => `[${handle}](${name}.html)`)
		const html = renderMarkdown(md)
		return (
			<NotePage project={project} note={this} head={<style>{CSS}</style>}>
				<div
					dangerouslySetInnerHTML={{ __html: html }}
					className="markdown-body"
				/>
			</NotePage>
		)
	}
}

export const noteTypes = [
	MarkdownNote,
]

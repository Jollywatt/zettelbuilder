/**
 * Hello
 * @module my-module
 */

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

function NoteLink({ note }: { note: Note }) {
	const sitepath = `${note.name}.html`
	return (
		<span>
			<a href={sitepath}>
				<code>[{note.name}]</code>
			</a>{" "}
			{note.description}
		</span>
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
			<h1>
				Note <code>[{note.name}]</code>
			</h1>
			<main>{children}</main>
			<h2>Cross references</h2>
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
		</Base>
	)
}

function indexPage(tree: NoteFolder) {
	return (
		<Base head={<title>Index</title>}>
			<main>
				<h1>📑 Index</h1>
				<p>This is the minimal theme.</p>
				<h2>Notes by folder</h2>
				{toc(tree)}
			</main>
		</Base>
	)
}

const tocEntry = (note: Note) => (
	<li>
		<a href={`${note.name}.html`}>
			<code>[{note.name}]</code>
		</a>{" "}
		<span>{note.description}</span>
		{note.refs.outgoing.length ? ", links to " : ""}
		{note.refs.outgoing.map((note) => <code>[{note.name}]</code>)}
		{note.refs.incoming.length ? ", linked from " : ""}
		{note.refs.incoming.map((note) => <code>[{note.name}]</code>)}
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

function NoteHeader({ note }) {
	return (
		<p>
			<b>
				<a href="/">Index</a> / <span>{note.name}</span>
			</b>
		</p>
	)
}

export class MarkdownNote extends Note {
	static override description = "markdown"
	static override extensionCombo = ["md"]

	override extractRefs() {
		return new Set(
			this.files.md.content.matchAll(/@([-\w]+)/g).map((match) => match[1]),
		)
	}

	override render() {
		let md = this.files.md.content
			.replace(/\(@([-\w]+)\)/g, (_, name) => `(${name}.html)`)
			.replace(/@([-\w]+)/g, (handle, name) => `[${handle}](${name}.html)`)
		const html = renderMarkdown(md)
		return (
			<NotePage note={this} head={<style>{CSS}</style>}>
				<div
					dangerouslySetInnerHTML={{ __html: html }}
					className="markdown-body"
				/>
			</NotePage>
		)
	}
}

export class PlainTextNote extends Note {
	static override extensionCombo = ["txt"]
	static override description = "plain text"

	override render() {
		return (
			<NotePage note={this}>
				<pre>{this.files.txt.content}</pre>
			</NotePage>
		)
	}
}

export class ExternalURLNote extends Note {
	static override extensionCombo = ["url"]

	override get description() {
		return `${this.url.host} link`
	}

	#url: URL | null = null
	get url(): URL {
		if (this.#url === null) {
			const match = this.files.url.content.match(/https?:.*/)
			if (match === null) {
				throw new Error(`Couldn't parse URL in ${this.files.url.path}.`)
			}
			this.#url = new URL(match[0])
		}
		return this.#url
	}

	override render() {
		return (
			<NotePage note={this}>
				<p>
					Link to <code>{this.url.href}</code>.
				</p>
				<iframe className="page" src={this.url.href}></iframe>
			</NotePage>
		)
	}
}

export class TypstNote extends Note {
	static override extensionCombo = ["typ", "pdf"]
	static override description = "typst pdf"

	override render(project: Project) {
		const pdfFileName = `${this.name}.pdf`
		Deno.copyFile(this.files.pdf.path, `${project.buildDir}/${pdfFileName}`)
		return (
			<NotePage note={this}>
				<object data={pdfFileName} type="application/pdf" />
			</NotePage>
		)
	}
}

export async function build(project: Project) {
	const { notes, tree } = project.analyse()
	project.renderPage("index.html", indexPage(tree))

	for (const name in notes) {
		const note = notes[name]
		const html = await note.render(project)
		project.renderPage(`${name}.html`, html)
	}
}

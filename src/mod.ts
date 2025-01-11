/**
 * This is the API reference for Zettelbuilder static site generator.
 *
 * The main functionality is provided by the {@link Project} class.
 * Define subclasses of {@link Note} to implement HTML renderers for each type of note.
 * @module
 */

export { Note, type NoteFolder, Project } from "./analyse.tsx"
export * as Minimal from "./themes/minimal.tsx"

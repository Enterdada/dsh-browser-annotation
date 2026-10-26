/**
 * Host half of the browser-annotation bundle.
 *
 * The feature is entirely browser-side: the Client module registers a browser
 * tab menu entry, injects an element picker into the active webview guest and
 * inserts the annotation text through the composer's public InputActions face.
 * No Host service, tool, command, route or session event is registered.
 */
export function apply() {}

<p align="center">
  <img src="dsh-browser-annotation/icon.svg" width="72" height="72" alt="dsh-browser-annotation icon">
</p>

# dsh-browser-annotation

An unofficial community plugin for **DSH Desktop** that turns the built-in right-side browser into a visual annotation tool. Pick elements directly on the page, add notes and attribute edits, and send the exact locator to the chat — the agent gets real element data instead of guessing.

> Unofficial project, not affiliated with DeepSeek. Built against DSH Desktop `0.2.1-rc.2` (Electron 44.7.0). The plugin uses private DOM markers of the shipped sidebar browser, so future DSH updates may require changes.

[中文说明](README.zh.md) · [Plugin bundle docs](dsh-browser-annotation/README.md)

## Features

- **Click-to-pick**: enter annotation mode from the composer button (or right-click the browser tab), hover/click an element; the page's own click/navigation behavior is suppressed while picking.
- **Numbered markers**: every annotation gets a numbered badge on the element; click a badge to view the note and edit/delete it.
- **Synced annotation panel**: a card above the composer lists all annotations for the active browser tab, with edit/delete/clear; changes sync both ways with page badges.
- **Precise payload**: URL, verified unique CSS selector, XPath, stable attributes, DOM, best-effort framework source hint, note, attribute/text diffs.
- **Compact chat card**: the composer holds one compact annotation chip; after sending, the transcript renders the annotations as an expandable card (the model still receives the full text).
- **Apple-style in-page UI**: automatic light/dark based on the page background with a manual ☾/☀ toggle; editable element attributes and text.
- **Client-only**: no Host services, tools, routes, network calls, or telemetry. It uses public composer/slot APIs plus the webview evaluation channel.

## Requirements

- DSH Desktop with the built-in right-side browser (Electron `<webview>`). Web-only profiles are not supported.
- DSH `>=0.2.1-rc.2 <0.3.0` (tested on `0.2.1-rc.2`, Electron 44.7.0, Windows).
- Node.js only for development checks; the installed plugin has no build step.

## Install

1. Clone:

   ```bash
   git clone https://github.com/Enterdada/dsh-browser-annotation.git
   cd dsh-browser-annotation
   ```

2. Install the bundle from the **`dsh-browser-annotation/`** subdirectory (the folder containing `package.json`) with DSH's plugin manager:
   - In a DSH session, ask the agent to run `plugin_manager` `install_bundle` with the absolute path to that subdirectory, or use your profile's local-bundle install flow.
   - Approve the operation if DSH asks.

3. Reload the DSH page if the client bundle does not hot-apply. The composer gets an **Annotate** button; the browser tab context menu gets **Annotate page element**.

4. Settings → Plugins should show **Browser Element Annotation** with the plugin icon.

The profile links to the cloned directory, so keep the path stable (or reinstall if you move it). To update: `git pull`; client changes hot-reload, Host changes need a plugin reinstall/restart. To uninstall: `plugin_manager` `remove_bundle` for `dsh-browser-annotation`; remove any un-sent annotation chips from drafts first.

## Usage

1. Open a page in the right-side browser (ideally a local dev server whose source is in the current workspace).
2. Click **Annotate** in the composer, or right-click the browser tab → **Annotate page element**.
3. Pick an element, write the change, optionally edit attributes/text, then **Add to annotation list**.
4. A numbered badge appears on the element and a **Page annotations** card appears above the composer.
5. Add more elements as needed; click badges or use the card to edit notes/delete.
6. Click **Add to chat** in the card to insert a compact annotation chip; review the draft and send. The transcript renders a compact expandable card, while the model receives the full annotation text.

Notes:

- The browser tab menu is a **right-click** menu; the built-in sidebar has no “⋯” button.
- Click outside the page, click another app area, press `Esc`, or click Annotate again to leave annotation mode.
- After changing annotations, use **Add again** and delete the previous chip manually.

## How it works

- Entry points: `conversation.input.left` (session-scoped) and `sidebar.right.tab.menu.item`.
- Target page: Electron `<webview>` located by the sidebar's tab DOM markers.
- Picker: a self-contained script injected with `webview.executeJavaScript` (closed shadow root, CSSOM styles, theme variables).
- Marker layer: a second persistent script renders numbered badges/popovers and reports edit/delete events back to the app.
- Composition: the `conversation.input.dock` card reads a client store; changes are pushed back to the marker layer.
- Send: a reference-source codec expands a compact chip into the full text; a client `userText` rule renders the transcript card. No Host services, tools, routes, or session event types are added.

## Known limitations

- Desktop only; the Web-mode iframe cannot be annotated.
- Light DOM only; cross-origin iframes are not selectable, and shadow-DOM elements degrade to their host.
- Annotations live in client memory per browser tab: page navigation/reload or app restart clears them.
- Badge/dock editing changes the note only; attribute/text diffs are captured when the annotation is created. Delete and re-annotate to change them.
- An inserted chip is a snapshot; after edits, add again and remove the old chip.
- The transcript card is client-rendered; the model receives the full marked text. If the plugin is removed, the message falls back to raw text.
- The sidebar's private DOM markers and the Electron webview API may change in future DSH/Electron releases.

## Development

```bash
# syntax
node --check dsh-browser-annotation/client.js
node --check dsh-browser-annotation/index.js

# JSON metadata
node -e "JSON.parse(require('fs').readFileSync('dsh-browser-annotation/package.json','utf8'))"

# manual fixture (Python 3)
python dev/serve-fixture.py
# open http://127.0.0.1:8123/ in the DSH side browser
```

There is no build step: the client bundle is plain JavaScript in the module-loader format; the Host half is a stub.

## Privacy and security

- Reads only the picked element's DOM attributes/text and framework runtime metadata; no cookies, Local Storage, or network requests.
- Annotation text is inserted into your own draft; review it before sending.
- Page scripts can read the injected global object; it is a collision guard, not a security boundary against a malicious page.
- Use on pages you trust.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome; screenshots/GIFs of the UI are especially helpful.

## License

[MIT](LICENSE) © 2026 Enterdada and contributors.

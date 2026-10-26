# Contributing

Thanks for helping improve this unofficial DSH plugin! DSH is a third-party product; this repository is not affiliated with DeepSeek.

## Ground rules

- Target DSH `>=0.2.1-rc.2 <0.3.0`; keep the plugin **client-only** unless there is a strong reason to add a Host capability.
- Respect the Session log: deliver annotations through the standard composer/draft APIs; do not add new Session event types.
- Do not commit secrets, personal profile paths, private page data, or screenshots containing private information.
- Contributions are accepted under the [MIT License](LICENSE).

## Development

There is no build step. The client half is plain JavaScript in the module-loader format; the Host half is a stub.

```bash
node --check dsh-browser-annotation/client.js
node --check dsh-browser-annotation/index.js
node -e "JSON.parse(require('fs').readFileSync('dsh-browser-annotation/package.json','utf8'))"
```

Manual testing:

1. Install the bundle from `dsh-browser-annotation/` with DSH's `plugin_manager` `install_bundle` (absolute path).
2. Start the fixture server: `python dev/serve-fixture.py`.
3. In a DSH Desktop session, open `http://127.0.0.1:8123/` in the right-side browser.
4. Exercise: annotate multiple elements, page markers, badge popover edit/delete, composer card edit/delete, add to chat, send, and the transcript card.
5. Report the DSH/Electron versions you tested.

UI strings live in the zh/en dictionaries inside `client.js` and the display metadata in `locale/*.json`; keep both locales complete. If you change the send format, keep the stable `⟦DSH-BROWSER-ANNOTATION⟧` markers in sync with the `userText` rule and the transcript card.

## Pull requests

- Describe the user-visible change, test steps, and known limitations.
- Keep changes focused; avoid unrelated refactors.
- Screenshots or GIFs are welcome when they contain no private data.
- If you touch the browser/webview integration, note which DSH/Electron version you verified against; these APIs are private and may change.

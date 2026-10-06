# Releasing

Push a `vscode-v<version>` (extension), `linter-v<version>` (linter) or `lsp-v<version>`
(language server) tag on `main`:

```bash
git fetch origin && git tag vscode-v1.2.3 origin/main && git push origin vscode-v1.2.3
```

npm takes `@textscene/linter` and `@textscene/lsp` from the `npm` job in
`.github/workflows/release.yml`, with no token. Each package's trusted publisher on npmjs.com
names the repository `Vortiago/textscene-inspector`, the workflow `release.yml` and the
environment `release`. npm offers that setting only for a package that already exists, so a
package's first version is published by hand with `npm publish <tarball> --access public`.

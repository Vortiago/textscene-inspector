# Releasing

Push a `vscode-v<version>` (extension), `linter-v<version>` (linter) or `lsp-v<version>`
(language server) tag on `main`:

```bash
git fetch origin && git tag vscode-v1.2.3 origin/main && git push origin vscode-v1.2.3
```

The release notes list the breaking changes and the `feat`, `fix` and `perf` commits since the
package's previous tag that touch the package or a package it bundles.
`scripts/ci/releaseNotes.mjs` writes them. `RELEASE_INPUTS` in `scripts/ci/releaseVersion.mjs`
names what each package bundles.
A commit in a tooling scope (`ci`, `devcontainer`, `githooks`, `lint`, `visual`) is left out.

To put highlights above that list, push an annotated tag. Its message goes first:

```bash
git tag -a vscode-v1.2.3 -m "Scene Tree view" -m "The tree follows the active preview." origin/main
```

npm takes `@textscene/linter` and `@textscene/lsp` from the `npm` job in
`.github/workflows/release.yml`, with no token. Each package's trusted publisher on npmjs.com
names the repository `Vortiago/textscene-inspector`, the workflow `release.yml` and the
environment `release`. npm offers that setting only for a package that already exists, so a
package's first version is published by hand with `npm publish <tarball> --access public`.

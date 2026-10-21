# Releasing

Push a `vscode-v<version>` (extension), `linter-v<version>` (linter), `lsp-v<version>`
(language server) or `tscn-v<version>` (parser) tag on `main`:

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

The VS Code Marketplace and Open VSX show the extension's `CHANGELOG.md` as its changelog. The
`release-vscode` job writes it before it packages the `.vsix`, with the notes of every `vscode-v`
tag up to the released one:

```bash
node scripts/ci/releaseNotes.mjs --changelog vscode-v1.2.3
```

The `CHANGELOG.md` in the repository is a stub. Do not commit a generated one.

npm takes `@textscene/linter`, `@textscene/lsp` and `@textscene/tscn` from the `npm` job in
`.github/workflows/release.yml`, with no token. Each package's trusted publisher on npmjs.com
names the repository `Vortiago/textscene-inspector`, the workflow `release.yml` and the
environment `release`. npm offers that setting only for a package that already exists, so a
package's first version is published by hand with `npm publish <tarball> --access public`.

`@textscene/tscn` is core's parser bundled into one file, so core stays private.
Build and pack it for the first publish, then restore the manifest:

```bash
pnpm build:tscn
cd apps/textscene-tscn && npm pkg set version=0.1.0 && pnpm pack
npm publish textscene-tscn-0.1.0.tgz --access public
git checkout package.json
```

Add the trusted publisher on npmjs.com. Push `tscn-v0.2.0` or a later tag for each release after
that.

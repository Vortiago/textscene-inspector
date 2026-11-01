# Releasing

A tag `<package>-v<major>.<minor>.<patch>` on `main` releases one package through
`.github/workflows/release.yml`. `RELEASE_TARGETS` in `scripts/ci/releaseVersion.mjs` lists the
packages: `vscode`, `linter`, `lsp`, `tscn` and `renderer`.

## Tag a release

1. Find the commits since the package's previous tag that touch it or a package it bundles.
2. Pick the version from them. A breaking change bumps the major, a `feat` the minor, and
   anything else the patch.
3. Tag `origin/main` and push the tag.

Push one tag in each `git push`. GitHub starts no workflow for a push that carries more than
three tags.

```bash
git fetch origin --tags
for t in vscode-v1.2.3 linter-v2.3.0; do git tag "$t" origin/main && git push origin "$t"; done
```

## Release notes

`scripts/ci/releaseNotes.mjs` writes the notes from the `feat`, `fix` and `perf` commits and the
breaking changes since the previous tag. It leaves out the tooling scopes (`ci`, `devcontainer`,
`githooks`, `lint`, `visual`).

An annotated tag puts its message above that list:

```bash
git tag -a vscode-v1.2.3 -m "Scene Tree view" -m "The tree follows the active preview." origin/main
```

The `release-vscode` job writes the extension's `CHANGELOG.md` from every `vscode-v` tag before
it packages the `.vsix`. The `CHANGELOG.md` in the repository is a stub. Commit no generated one.

## npm

The `npm` job publishes `@textscene/linter`, `@textscene/lsp`, `@textscene/tscn` and
`@textscene/renderer` with no token, through each package's trusted publisher on npmjs.com.

npm offers a trusted publisher only for a package that exists. To add a new npm package:

1. Run `pnpm build:<name>`.
2. In the package's directory, run `npm pkg set version=0.1.0`.
3. Run `pnpm pack`.
4. Run `npm publish <tarball> --access public`.
5. Run `git checkout package.json`.
6. On npmjs.com, add a trusted publisher: repository `Vortiago/textscene-inspector`, workflow
   `release.yml`, environment `release`.
7. Tag `<name>-v0.2.0` for the first release through CI.

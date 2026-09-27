# Releasing

Push a tag on `main`. The tag names the package and the version.

| Tag | Publishes |
| --- | --- |
| `vscode-v1.2.3` | The extension: GitHub Release, VS Code Marketplace, Open VSX |
| `linter-v1.2.3` | `@textscene/linter`: GitHub Release, npm |

```bash
git fetch origin
git tag vscode-v1.2.3 origin/main
git push origin vscode-v1.2.3
```

The run refuses a pre-release tag, and a version below the package's newest
tag. It skips a registry that already has the version, so **Re-run failed
jobs** is safe.

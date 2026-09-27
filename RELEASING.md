# Releasing

Tag `main` with `vscode-v<version>` for the extension or `linter-v<version>` for
the linter, and push the tag:

```bash
git fetch origin && git tag vscode-v1.2.3 origin/main && git push origin vscode-v1.2.3
```

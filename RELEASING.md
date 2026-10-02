# Releasing

Push a `vscode-v<version>` (extension) or `linter-v<version>` (linter) tag on `main`:

```bash
git fetch origin && git tag vscode-v1.2.3 origin/main && git push origin vscode-v1.2.3
```

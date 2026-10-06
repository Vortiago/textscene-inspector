# @textscene/lsp

`tscn-lsp` is a language server for Godot `.tscn` scenes and `.tres` resources. It gives any
Language Server Protocol (LSP) client the features of the TextScene Inspector VS Code
extension: hover, completion, quick fixes, folding, document symbols, go to definition,
document highlights and diagnostics. Each lint check cites the line of Godot source that
grounds it.

For each document, the server finds the nearest `project.godot` in the document's directory or above
it, and resolves `res://` from that directory. A scene outside every Godot project still gets hover,
completion and the file-local diagnostics.

The server reads the project again when the client reports a changed file, and each time a
document opens. A client that supports it is asked to watch every file in the workspace.

## Install

The server needs Node.js 24 or later.

```bash
npm install --global @textscene/lsp
```

The package installs one command, `tscn-lsp`. A client starts it as a child process and
speaks LSP to it over standard input and output (stdio). The server always uses stdio, so it
accepts a `--stdio` argument and ignores it.

## Client setup

Map the `tscn` language to the `.tscn` and `.tres` extensions. Start `tscn-lsp` for it.

### Neovim

```lua
vim.filetype.add({ extension = { tscn = 'tscn', tres = 'tscn' } })

vim.api.nvim_create_autocmd('FileType', {
  pattern = 'tscn',
  callback = function()
    vim.lsp.start({
      name = 'tscn-lsp',
      cmd = { 'tscn-lsp', '--stdio' },
      root_dir = vim.fs.dirname(vim.fs.find({ 'project.godot' }, { upward = true })[1]),
    })
  end,
})
```

A file outside a Godot project has no `project.godot` above it. When `find` returns
nothing, pass the document's own directory as `root_dir`.

### Helix

In `languages.toml`:

```toml
[[language]]
name = "tscn"
scope = "source.tscn"
file-types = ["tscn", "tres"]
language-servers = ["tscn-lsp"]

[language-server.tscn-lsp]
command = "tscn-lsp"
args = ["--stdio"]
```

### Zed

Zed needs a language extension that maps `.tscn` to a language id. With one installed,
add this to `settings.json`:

```json
{
  "lsp": {
    "tscn-lsp": {
      "binary": { "path": "tscn-lsp", "arguments": ["--stdio"] }
    }
  },
  "languages": {
    "TSCN": {
      "language_servers": ["tscn-lsp"]
    }
  }
}
```

### Any stdio client

Run `tscn-lsp --stdio` as a child process, and speak LSP to it over stdio.

## Build from source

From the repository root:

```bash
pnpm install
pnpm build:lsp
```

The bundle has no React and no three.js. `ARCHITECTURE.md` in the repository describes how
the server shares `@textscene/core` with the other hosts.

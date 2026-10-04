# @textscene/lsp

`tscn-lsp` is a language server for Godot `.tscn` scenes and `.tres` resources. It gives
any LSP client the features the TextScene Inspector VS Code extension provides. They are
hover, completion, quick fixes, folding, document symbols, go to definition, document
highlights and diagnostics. Every check is grounded in Godot's own source.

The server reads each document's own directory to find `project.godot`, and resolves
`res://` from the nearest project root. A scene outside every Godot project still gets
hover, completion and the file-local diagnostics.

## Install

Requires Node.js 24 or later.

```bash
npm install --global @textscene/lsp
```

The package installs one command, `tscn-lsp`. The server speaks LSP over stdio, so a
client starts it as a child process and talks to it on the standard streams.

## Client setup

Map the `tscn` language to the `.tscn` and `.tres` extensions. Start `tscn-lsp` for it.
Most clients run the server over stdio.

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

A client that starts a server over the standard streams runs `tscn-lsp --stdio` and
speaks LSP on the process's stdin and stdout.

## Build from source

From the repository root:

```bash
pnpm install
pnpm --filter @textscene/lsp build
```

The bundle has no React and no three.js. `ARCHITECTURE.md` in the repository describes how
the server shares `@textscene/core` with the other hosts.

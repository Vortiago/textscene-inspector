# UI Styles

## Editing Shared Styles

The shared UI styles are maintained in **`styles.css`** for better IDE support (syntax highlighting, autocomplete, linting).

### Workflow:

1. **Edit** `styles.css` with full CSS IDE support
2. **Run** `pnpm generate:styles` to sync changes to `styles.ts`
3. **Build** normally - `styles.ts` is auto-generated during prebuild

### How it works:

- **Source of truth**: `styles.css` (edit this file)
- **Generated file**: `styles.ts` (auto-generated, committed to git)
- **Build script**: `scripts/generate-styles.mjs` converts CSS → TS export
- **Auto-sync**: Runs automatically during `pnpm build` via prebuild hook

### Why both files?

- `styles.css` - Provides IDE support for editing (syntax highlighting, autocomplete)
- `styles.ts` - Consumed by TypeScript apps (web app and VS Code extension)

Both files are checked into git for easier diffs and to avoid build-time surprises.

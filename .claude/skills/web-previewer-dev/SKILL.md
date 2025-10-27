---
name: web-previewer-dev
description: Test and preview TSCN rendering in web browser. Use when testing rendering output, debugging visual issues, viewing .tscn files in browser, or working on the Vite web app in apps/textscene-web.
---

# Web Previewer Development

Web debugging tool: `apps/textscene-web`

## Purpose

Vite-based web app for testing and debugging the tscn-renderer library.

## Architecture

```
src/
├── main.ts           # Entry point
├── renderer.ts       # three.js scene using tscn-renderer
├── fileUpload.ts     # File upload UI
└── ui/               # UI components
```

## Implementation Pattern

```typescript
// File upload
input.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  const content = await file.text();
  await loadScene(content);
});

// Scene rendering
import { TscnParser, TscnRenderer } from 'tscn-renderer';

async function loadScene(tscnContent: string) {
  const parsed = TscnParser.parse(tscnContent);
  const scene = TscnRenderer.render(parsed);
  threeScene.add(scene);
}
```

## Workflow

```bash
cd apps/textscene-web
pnpm type-check && pnpm lint:fix && pnpm build

# Preview production build
pnpm preview  # http://localhost:4173
```

## Testing Library Changes

Always rebuild library first:
```bash
cd packages/textscene-renderer && pnpm build
cd ../../apps/textscene-web && pnpm build
```

## Development Principles

- **KISS**: Keep implementations simple, avoid over-engineering
- **DRY**: Don't repeat yourself, but avoid premature abstraction
- **Iterative**: Build working code first, refine later
- **No documentation**: Don't create README files or excessive comments - code should be self-explanatory

## Context7 Docs

- three.js: `/mrdoob/three.js`
- TypeScript: `microsoft/typescript`

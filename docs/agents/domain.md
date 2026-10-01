# Domain docs

This file tells the engineering skills how to read this repo's domain documentation
before they explore the code. The repo is single-context.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: read each ADR that touches the area you are about to work in.

## File structure

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-unified-slice-react-free-linter.md
│   └── 0002-three-separate-registries.md
├── packages/
└── apps/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a
hypothesis or a test name), use the term as `GLOSSARY.md` defines it. Do not use a
synonym that the glossary lists under _Avoid_.

A concept that the glossary does not have yet is a signal. Either you are inventing
language the project does not use, so reconsider, or the glossary has a real gap. Note
the gap for `/domain-modeling`.

## Flag ADR conflicts

When your output contradicts an existing ADR, say so. Never override it silently:

> _Contradicts ADR-0002 (three separate registries), but worth reopening because…_

# Domain docs

## Before exploring, read these

- **`GLOSSARY.md`** at the repository root.
- **`docs/adr/`**: each ADR that touches the area you work in.

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

Name a domain concept with its `GLOSSARY.md` term, never a synonym listed under _Avoid_. Note a missing concept for `/domain-modeling`.

## Flag ADR conflicts

Name the ADR your output contradicts:

> _Contradicts ADR-0002 (three separate registries), but worth reopening because…_

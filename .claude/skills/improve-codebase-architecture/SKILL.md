---
name: improve-codebase-architecture
description: Find deepening opportunities in a codebase, informed by the domain language in CONTEXT.md and the decisions in docs/adr/. Use when the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more testable and AI-navigable.
---

# Improve codebase architecture

This skill finds architectural friction and proposes **deepening opportunities**: refactors that turn shallow modules into deep ones. The aim is testability and navigability for an AI agent.

## Glossary

Use these terms exactly in every suggestion. Do not drift into "component", "service", "API" or "boundary". [LANGUAGE.md](LANGUAGE.md) has the full definitions.

- **Module**: anything with an interface and an implementation (function, class, package, slice).
- **Interface**: everything a caller must know to use the module: types, invariants, error modes, ordering, configuration. More than the type signature.
- **Implementation**: the code inside.
- **Depth**: leverage at the interface, a lot of behaviour behind a small interface. **Deep** means high leverage. **Shallow** means the interface is nearly as complex as the implementation.
- **Seam**: where an interface lives, a place where behaviour can change without an edit in that place. Use this word, not "boundary".
- **Adapter**: a concrete thing that satisfies an interface at a seam.
- **Leverage**: what callers get from depth.
- **Locality**: what maintainers get from depth: change, bugs and knowledge in one place.

Key principles ([LANGUAGE.md](LANGUAGE.md) has the full list):

- **Deletion test**: imagine you delete the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it earned its place.
- **The interface is the test surface.**
- **One adapter means a hypothetical seam. Two adapters mean a real seam.**

The project's domain model informs this skill. The domain language names good seams. The ADRs record decisions that this skill does not reopen.

## Process

### 1. Explore

1. Read the project's domain glossary and the ADRs for the area you touch.
2. Walk the codebase with the Agent tool and `subagent_type=Explore`.

Explore freely, without fixed heuristics, and note where you feel friction:

- Where does one concept need jumps between many small modules?
- Where are modules **shallow**, with an interface nearly as complex as the implementation?
- Where were pure functions extracted for testability, while the real bugs hide in how they are called (no **locality**)?
- Where do tightly coupled modules leak across their seams?
- Which parts are untested, or hard to test through their current interface?

Apply the **deletion test** to each module you suspect is shallow: does deleting it concentrate complexity, or only move it? "It concentrates" is the signal.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to the OS temp directory, so nothing lands in the repo. Take the directory from `$TMPDIR`, else `/tmp` (`%TEMP%` on Windows). Write to `<tmpdir>/architecture-review-<timestamp>.html`, so each run gets a new file. Open it for the user (`xdg-open <path>` on Linux, `open <path>` on macOS, `start <path>` on Windows) and give the absolute path.

The report uses **Tailwind from a CDN** for layout and styling, and **Mermaid from a CDN** for diagrams. Use Mermaid when the relationships are graph-shaped (call graphs, dependencies, sequences). Use hand-built divs and SVG for editorial visuals (mass diagrams, cross-sections, collapse animations). Give each candidate a **before and after visualisation**.

Each candidate is a card with:

- **Files**: the files and modules involved.
- **Problem**: why the current architecture causes friction.
- **Solution**: what changes, in plain English.
- **Benefits**: in terms of locality and leverage, and how the tests improve.
- **Before / After diagram**: side by side, drawn by hand, showing the shallowness and the deepening.
- **Recommendation strength**: `Strong`, `Worth exploring` or `Speculative`, as a badge.

End the report with a **Top recommendation** section: the candidate to do first, and why.

**Use the CONTEXT.md vocabulary for the domain and the [LANGUAGE.md](LANGUAGE.md) vocabulary for the architecture.** If `CONTEXT.md` defines "Order", write "the Order intake module", not "the FooBarHandler" or "the Order service".

**ADR conflicts**: show a candidate that contradicts an existing ADR only when the friction is real enough to reopen the ADR. Mark it in the card, for example with a warning callout: _"contradicts ADR-0007, but worth reopening because…"_. Do not list every theoretical refactor that an ADR forbids.

[HTML-REPORT.md](HTML-REPORT.md) has the HTML scaffold, the diagram patterns and the styling guidance.

Do not propose interfaces yet. When the file is written, ask the user: "Which of these would you like to explore?"

### 3. Grilling loop

When the user picks a candidate, start a grilling conversation. Walk the design tree with the user: constraints, dependencies, the shape of the deepened module, what sits behind the seam, which tests survive.

Update documents as decisions settle:

- **A deepened module named after a concept not in `CONTEXT.md`?** Add the term to `CONTEXT.md`, as `/grill-with-docs` does (see [CONTEXT-FORMAT.md](../grill-with-docs/CONTEXT-FORMAT.md)). Create the file if it does not exist.
- **A fuzzy term sharpened in the conversation?** Update `CONTEXT.md` then.
- **The user rejects the candidate with a reason that matters?** Offer an ADR: _"Want me to record this as an ADR so future architecture reviews do not re-suggest it?"_ Offer it only when a future explorer needs the reason to avoid the same suggestion. Skip a temporary reason ("not worth it right now") and an obvious one. See [ADR-FORMAT.md](../grill-with-docs/ADR-FORMAT.md).
- **Explore alternative interfaces for the deepened module?** See [INTERFACE-DESIGN.md](INTERFACE-DESIGN.md).

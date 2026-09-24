---
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
---

<what-to-do>

Interview me about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree and resolve the dependencies between decisions one at a time. Give your recommended answer to each question.

Ask one question at a time, and wait for my answer before the next.

If the codebase can answer a question, explore the codebase instead of asking.

</what-to-do>

<supporting-info>

## Domain documentation

While you explore the codebase, look for the existing documentation.

### File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts, and the map points to each one:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

Create a file only when you have something to write in it. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it for the first ADR.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with `CONTEXT.md`, say so at once: "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses a vague or overloaded term, propose a precise one: "You say 'account'. Do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

Test domain relationships with specific scenarios. Invent edge cases that make the user state the boundaries between concepts precisely.

### Cross-reference with code

When the user states how something works, check whether the code agrees. Show a contradiction: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update CONTEXT.md at once

When a term is resolved, update `CONTEXT.md` then, not in a batch later. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` holds no implementation details. It is a glossary, not a spec, a scratch pad or a record of implementation decisions.

### Offer ADRs sparingly

Offer an ADR only when all three are true:

1. **Hard to reverse**: a later change of mind costs something real.
2. **Surprising without context**: a future reader asks why it is done this way.
3. **The result of a real trade-off**: there were real options, and you chose one for specific reasons.

If one of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

</supporting-info>

# ADR format

ADRs live in `docs/adr/` with sequential numbers: `0001-slug.md`, `0002-slug.md`, and so on. To number a new ADR, find the highest number in `docs/adr/` and add one.

Create `docs/adr/` only when you write the first ADR.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

One paragraph is a complete ADR. Its value is the record that a decision was made, and why.

## Optional sections

Add these only when they add value:

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`): for a decision that someone may revisit.
- **Considered Options**: only when the rejected options are worth remembering.
- **Consequences**: only for downstream effects that are not obvious.

## When to offer an ADR

All three must be true:

1. **Hard to reverse**: a later change of mind costs something real.
2. **Surprising without context**: a future reader looks at the code and asks why it is done this way.
3. **The result of a real trade-off**: there were real options, and you chose one for specific reasons.

If a decision is easy to reverse, you can reverse it later. If it is not surprising, nobody asks why. If there was no real option, there is nothing to record.

### What qualifies

- **Architectural shape.** "We use a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate through domain events, not synchronous HTTP."
- **Technology choices with lock-in.** Database, message bus, auth provider, deployment target. Only the ones that take a quarter to replace, not every library.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." An explicit no is as valuable as a yes.
- **Deliberate deviations from the obvious path.** "We use manual SQL instead of an ORM because X." Anything where a reasonable reader assumes the opposite. The ADR stops the next engineer from "fixing" a deliberate choice.
- **Constraints not visible in the code.** "We cannot use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected options when the reason is not obvious.** If you chose REST over GraphQL for subtle reasons, record it, or someone proposes GraphQL again.

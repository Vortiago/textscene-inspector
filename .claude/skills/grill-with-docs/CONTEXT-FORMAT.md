# CONTEXT.md format

## Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

## Rules

- **Choose one word.** When several words exist for one concept, pick the best one and list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences. Define what the term is, not what it does.
- **Include only terms specific to this project.** A general programming concept (timeouts, error types, utility patterns) does not belong, even if the project uses it a lot.
- **Group terms under subheadings** when natural clusters appear. A flat list is correct for one cohesive area.

## Single and multiple contexts

**Single context (most repos):** one `CONTEXT.md` at the repo root.

**Multiple contexts:** a `CONTEXT-MAP.md` at the repo root lists the contexts, where they live and how they relate:

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) — receives and tracks customer orders
- [Billing](./src/billing/CONTEXT.md) — generates invoices and processes payments
- [Fulfillment](./src/fulfillment/CONTEXT.md) — manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

To find the structure:

- If `CONTEXT-MAP.md` exists, read it to find the contexts.
- If only a root `CONTEXT.md` exists, there is one context.
- If neither exists, create a root `CONTEXT.md` when the first term is resolved.

With multiple contexts, find the one the current topic belongs to. If it is unclear, ask.

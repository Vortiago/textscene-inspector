# Interface design

When the user wants to explore alternative interfaces for a chosen deepening candidate, use this pattern of parallel sub-agents. It follows "Design It Twice" (Ousterhout): your first idea is rarely the best.

It uses the vocabulary in [LANGUAGE.md](LANGUAGE.md): **module**, **interface**, **seam**, **adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before you spawn sub-agents, explain the problem space of the chosen candidate to the user:

- The constraints that any new interface must satisfy.
- The dependencies it relies on, and their category (see [DEEPENING.md](DEEPENING.md)).
- A rough code sketch that makes the constraints concrete. It is an illustration, not a proposal.

Show this to the user, then go on to step 2 at once. The user reads while the sub-agents work.

### 2. Spawn sub-agents

Spawn 3 or more sub-agents in parallel with the Agent tool. Each produces a **radically different** interface for the deepened module.

Give each sub-agent its own technical brief: file paths, coupling details, the dependency category from [DEEPENING.md](DEEPENING.md), and what sits behind the seam. The brief is separate from the explanation in step 1. Give each agent a different design constraint:

- Agent 1: "Minimise the interface: aim for 1–3 entry points max. Maximise leverage per entry point."
- Agent 2: "Maximise flexibility: support many use cases and extension."
- Agent 3: "Optimise for the most common caller: make the default case trivial."
- Agent 4 (if applicable): "Design around ports & adapters for cross-seam dependencies."

Put the [LANGUAGE.md](LANGUAGE.md) vocabulary and the CONTEXT.md vocabulary in each brief, so each sub-agent uses the architecture language and the project's domain language.

Each sub-agent returns:

1. The interface: types, methods, parameters, invariants, ordering and error modes.
2. A usage example for callers.
3. What the implementation hides behind the seam.
4. The dependency strategy and adapters (see [DEEPENING.md](DEEPENING.md)).
5. The trade-offs: where leverage is high and where it is thin.

### 3. Present and compare

Present the designs one at a time, then compare them in prose. Contrast them by **depth** (leverage at the interface), **locality** (where change concentrates) and **seam placement**.

Then give your recommendation: the strongest design and why. If parts of different designs combine well, propose a hybrid. Take a clear position: the user wants a strong opinion, not a menu.

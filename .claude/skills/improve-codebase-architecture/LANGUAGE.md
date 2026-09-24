# Language

This is the vocabulary for every suggestion this skill makes. Use these terms exactly. Do not substitute "component", "service", "API" or "boundary": consistent language is the purpose.

## Terms

**Module**
Anything with an interface and an implementation. The term applies at every scale: a function, a class, a package or a slice across tiers.
_Avoid_: unit, component, service.

**Interface**
Everything a caller must know to use the module correctly: the type signature, and also the invariants, ordering constraints, error modes, required configuration and performance characteristics.
_Avoid_: API, signature (too narrow: those name only the type-level surface).

**Implementation**
The code inside a module. It differs from an **Adapter**: a small adapter can have a large implementation (a Postgres repo), and a large adapter a small one (an in-memory fake). Say "adapter" when the seam is the topic, and "implementation" otherwise.

**Depth**
Leverage at the interface: the behaviour a caller (or test) can exercise per unit of interface it must learn. A module is **deep** when a lot of behaviour sits behind a small interface. A module is **shallow** when the interface is nearly as complex as the implementation.

**Seam** _(from Michael Feathers)_
A place where you can alter behaviour without editing in that place: the *location* of a module's interface. Where to put the seam is a design decision of its own, separate from what goes behind it.
_Avoid_: boundary (overloaded with DDD's bounded context).

**Adapter**
A concrete thing that satisfies an interface at a seam. The term describes a *role* (the slot it fills), not its content.

**Leverage**
What callers get from depth: more capability per unit of interface they must learn. One implementation pays back across N call sites and M tests.

**Locality**
What maintainers get from depth: change, bugs, knowledge and verification concentrate in one place instead of spreading across callers. A fix in one place fixes every caller.

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be built from small, mockable, swappable parts that are not part of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface.
- **The deletion test.** Imagine you delete the module. If complexity vanishes, the module hid nothing (it was a pass-through). If complexity reappears across N callers, the module earned its place.
- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test *past* the interface, the module probably has the wrong shape.
- **One adapter means a hypothetical seam. Two adapters mean a real one.** Do not add a seam unless something varies across it.

## Relationships

- A **Module** has exactly one **Interface** (the surface it presents to callers and tests).
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.

## Rejected framings

- **Depth as the ratio of implementation lines to interface lines** (Ousterhout): it rewards a padded implementation. This skill uses depth as leverage.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods**: too narrow. Here the interface includes every fact a caller must know.
- **"Boundary"**: overloaded with DDD's bounded context. Say **seam** or **interface**.

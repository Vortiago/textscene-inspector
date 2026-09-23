# Deepening

This file says how to deepen a cluster of shallow modules safely, given its dependencies. It uses the vocabulary in [LANGUAGE.md](LANGUAGE.md): **module**, **interface**, **seam**, **adapter**.

## Dependency categories

Classify the dependencies of each candidate. The category decides how you test the deepened module across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. You can always deepen it: merge the modules and test through the new interface. It needs no adapter.

### 2. Local-substitutable

Dependencies with a local test stand-in (PGLite for Postgres, an in-memory filesystem). You can deepen it if the stand-in exists. The tests run the deepened module with the stand-in. The seam is internal, with no port at the module's external interface.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (microservices, internal APIs). Define a **port** (interface) at the seam. The deep module owns the logic, and the transport arrives as an injected **adapter**. Tests use an in-memory adapter. Production uses an HTTP, gRPC or queue adapter.

Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it is deployed across a network."*

### 4. True external (Mock)

Third-party services you do not control (Stripe, Twilio, and so on). The deepened module takes the external dependency as an injected port, and tests provide a mock adapter.

## Seam discipline

- **One adapter means a hypothetical seam. Two adapters mean a real one.** Do not add a port unless at least two adapters are justified (usually production and test). A seam with one adapter is only indirection.
- **Internal seams and external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Do not expose an internal seam through the interface because tests use it.

## Testing: replace, do not layer

- When tests at the deepened module's interface exist, the old unit tests on the shallow modules are waste. Delete them.
- Write new tests at the deepened module's interface. The **interface is the test surface**.
- Tests assert observable outcomes through the interface, not internal state.
- Tests survive internal refactors, because they describe behaviour, not implementation. A test that must change when the implementation changes tests past the interface.

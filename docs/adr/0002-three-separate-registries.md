# Keep three separate type registries; reject a unified one

NodeRegistry (parser domain), NodeComponentRegistry (3D render domain), and ControlComponentRegistry (2D render domain) stay distinct, sharing only a generic `createTypeRegistry<T>()` implementation. They are all keyed by the same `typeName` string, which makes them look like duplication worth merging.

We reject the merge: a single registry holding a `component` field would force the linter bundle to import the module carrying React/THREE, breaking the React-free linter boundary (ADR-0001). The multiplicity is the mechanism that keeps the three domains independently bundleable, not accidental duplication — the only real shallowness was repeated `Map.register/get` boilerplate, removed by the shared `createTypeRegistry`.

Recorded because a future reader will reasonably ask "why three registries for the same keys?" and try to consolidate them, reintroducing React into the linter.

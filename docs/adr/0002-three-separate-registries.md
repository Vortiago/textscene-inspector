# Keep three separate type registries; reject a unified one

NodeRegistry (parser domain), NodeComponentRegistry (3D render domain), and ControlComponentRegistry (2D render domain) stay distinct. They are all keyed by the same `typeName` string, which makes them look like duplication worth merging. The two render registries share a generic `createTypeRegistry<T>()`. NodeRegistry keeps a bespoke `Map` because its entry is a record (parser, optional `typeGuard`, `propertyFormatter`), not a bare value.

We reject the merge. A single registry holding a `component` field would force the linter bundle to import the module carrying React and THREE, breaking the React-free linter boundary (ADR-0001). The multiplicity is the mechanism that keeps the three domains independently bundleable, not accidental duplication. The repeated `Map.register/get` boilerplate in the two render registries was the only real shallowness, and the shared `createTypeRegistry` removed it.

Recorded because a future reader will reasonably ask "why three registries for the same keys?" and try to consolidate them, reintroducing React into the linter.

# Keep three separate type registries; reject a unified one

NodeRegistry (parser domain), NodeComponentRegistry (3D render domain) and ControlComponentRegistry (2D render domain) stay distinct, although the same `typeName` string keys all three. The two render registries share a generic `createTypeRegistry<T>()`. NodeRegistry keeps its own `Map`, because its entry is a record (parser, optional `typeGuard`, `propertyFormatter`), not a bare value.

Rejected: one merged registry. A single registry with a `component` field forces the linter bundle to import the module that carries React and THREE. That breaks the React-free linter boundary (ADR-0001). The three registries are the mechanism that keeps the three domains independently bundleable, not accidental duplication. Do not merge them: a merge puts React back into the linter.

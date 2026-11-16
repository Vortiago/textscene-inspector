const WEAK_REFERENCE = 'the next utility slice ports the WeakRef object weakref makes';
const EDITOR_STATE = 'the answer is a counter or an object id of the running editor';
const INTERNED_ADDRESS =
  'StringName::operator< compares the addresses of two interned texts (string_name.h:97), which differ by run';

/** Each refused case's id and the class of what it throws. */
export const REFUSED_CASES = {};

/** The comparisons of two distinct non-empty StringNames, which the port refuses wherever the set has one. */
export const INTERNED_COMPARISON = { refusal: 'UnportableComparison', reason: INTERNED_ADDRESS };

/** The utility functions the port refuses wherever the set calls them, with the reason. */
export const REFUSED_UTILITIES = {
  weakref: { refusal: 'UnportedExpression', reason: WEAK_REFERENCE },
  rid_allocate_id: { refusal: 'UnportableUtility', reason: EDITOR_STATE },
};

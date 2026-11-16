const SERIALISERS = 'the next utility slice ports the marshalls';
const WEAK_REFERENCE = 'the next utility slice ports the WeakRef object weakref makes';
const EDITOR_STATE = 'the answer is a counter or an object id of the running editor';
const MEMBERS = 'the methods and members slice ports the index';
const INTERNED_ADDRESS =
  'StringName::operator< compares the addresses of two interned texts (string_name.h:97), which differ by run';

/** Each refused case's id and the class of what it throws. */
export const REFUSED_CASES = {
  'parser 53 "[1][0]"': { refusal: 'UnportedExpression', reason: MEMBERS },
  'parser 55 "\\"a\\".b"': { refusal: 'UnportedExpression', reason: MEMBERS },
  'parser 59 "(1).x"': { refusal: 'UnportedExpression', reason: MEMBERS },
};

/** The comparisons of two distinct non-empty StringNames, which the port refuses wherever the set has one. */
export const INTERNED_COMPARISON = { refusal: 'UnportableComparison', reason: INTERNED_ADDRESS };

const unported = { refusal: 'UnportedExpression', reason: SERIALISERS };

/** The utility functions the port refuses wherever the set calls them, with the reason. */
export const REFUSED_UTILITIES = {
  var_to_bytes: unported,
  bytes_to_var: unported,
  var_to_bytes_with_objects: unported,
  bytes_to_var_with_objects: unported,
  weakref: { refusal: 'UnportedExpression', reason: WEAK_REFERENCE },
  rid_allocate_id: { refusal: 'UnportableUtility', reason: EDITOR_STATE },
};

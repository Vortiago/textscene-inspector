const UTILITY_FUNCTIONS = 'the utility functions slice ports the call';
const MEMBERS = 'the methods and members slice ports the index';
const INTERNED_ADDRESS =
  'StringName::operator< compares the addresses of two interned texts (string_name.h:97), which differ by run';

/** Each refused case's id and the class of what it throws. */
export const REFUSED_CASES = {
  'identifier 15 "abs(-1)"': { refusal: 'UnportedExpression', reason: UTILITY_FUNCTIONS },
  'parser 53 "[1][0]"': { refusal: 'UnportedExpression', reason: MEMBERS },
  'parser 55 "\\"a\\".b"': { refusal: 'UnportedExpression', reason: MEMBERS },
  'parser 59 "(1).x"': { refusal: 'UnportedExpression', reason: MEMBERS },
  'parser 69 "max(1)"': { refusal: 'UnportedExpression', reason: UTILITY_FUNCTIONS },
  'parser 70 "print(1)"': { refusal: 'UnportedExpression', reason: UTILITY_FUNCTIONS },
};

/** The comparisons of two distinct non-empty StringNames, which the port refuses wherever the set has one. */
export const INTERNED_COMPARISON = { refusal: 'UnportableComparison', reason: INTERNED_ADDRESS };

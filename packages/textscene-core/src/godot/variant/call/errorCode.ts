/** The `Error` codes a builtin method returns as an int (core/error/error_list.h). */
export const ERROR_CODE = {
  OK: 0n,
  ERR_UNCONFIGURED: 3n,
  ERR_LOCKED: 23n,
  ERR_INVALID_PARAMETER: 31n,
} as const;

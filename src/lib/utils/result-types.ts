// Defines a standard way to return results from actions/operations

/**
 * Represents an error encountered during an action.
 */
export type ActionError = {
  error: string; // The primary error message
  details?: unknown; // Optional field for additional error context (e.g., caught exception)
  stack?: string; // Optional stack trace
};

/**
 * Represents the outcome of an operation, which can be either success or failure.
 * TSuccess: The type of data returned on success.
 * TError: The type of error returned on failure.
 */
export type Result<TSuccess, TError> =
  | { success: true; data: TSuccess }
  | { success: false; error: TError };

/**
 * Creates a success Result object.
 * @param data The data associated with the successful outcome.
 */
export const success = <TSuccess, TError>(data: TSuccess): Result<TSuccess, TError> => ({
  success: true,
  data,
});

/**
 * Creates a failure Result object.
 * @param error The error associated with the failed outcome.
 */
export const failure = <TSuccess, TError>(error: TError): Result<TSuccess, TError> => ({
  success: false,
  error,
});

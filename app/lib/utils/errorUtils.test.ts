import { describe, it, expect } from 'vitest';
import { extractZodErrors } from 'app/lib/utils/errorUtils';
import { success, failure, type Result, type ActionError } from 'app/lib/utils/result-types';
import { ZodError } from 'zod';

describe('errorUtils', () => {
  describe('extractZodErrors', () => {
    it('should extract error messages from ZodError', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['name'],
          message: 'Expected string, received number',
        },
        {
          code: 'too_small',
          minimum: 1,
          inclusive: true,
          path: ['email'],
          message: 'String must contain at least 1 character(s)',
          origin: 'value',
        },
      ]);

      const result = extractZodErrors(zodError);

      expect(result).toBe(
        'name: Expected string, received number, email: String must contain at least 1 character(s)'
      );
    });

    it('should handle nested path errors', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['user', 'profile', 'name'],
          message: 'Expected string, received number',
        },
      ]);

      const result = extractZodErrors(zodError);

      expect(result).toBe('user.profile.name: Expected string, received number');
    });

    it('should handle empty errors array', () => {
      const zodError = new ZodError([]);

      const result = extractZodErrors(zodError);

      expect(result).toBe('');
    });
  });
});

describe('result-types', () => {
  describe('success', () => {
    it('should create a success result', () => {
      const data = { id: 1, name: 'test' };
      const result = success(data);

      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'test' },
      });
    });

    it('should preserve the data type', () => {
      const data = 'test string';
      const result: Result<string, ActionError> = success(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test string');
      }
    });
  });

  describe('failure', () => {
    it('should create a failure result', () => {
      const error: ActionError = { error: 'Test error' };
      const result = failure(error);

      expect(result).toEqual({
        success: false,
        error: { error: 'Test error' },
      });
    });

    it('should preserve the error type', () => {
      const error: ActionError = { error: 'Test error', details: 'details' };
      const result: Result<string, ActionError> = failure(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toBe('Test error');
        expect(result.error.details).toBe('details');
      }
    });
  });

  describe('Result type', () => {
    it('should work with type guards', () => {
      const successResult: Result<string, ActionError> = success('test');
      const failureResult: Result<string, ActionError> = failure({ error: 'test' });

      if (successResult.success) {
        expect(successResult.data).toBe('test');
      }

      if (!failureResult.success) {
        expect(failureResult.error.error).toBe('test');
      }
    });
  });
});

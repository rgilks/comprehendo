import { describe, it, expect } from 'vitest';
import { GET, POST } from './route';

describe('Auth Route Handlers', () => {
  it('should export GET and POST handlers', () => {
    expect(GET).toBeDefined();
    expect(POST).toBeDefined();
  });
});

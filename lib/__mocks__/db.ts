import { vi } from 'vitest';

// Create the mock database object
const mockDbInstance = {
  prepare: vi.fn().mockReturnThis(),
  get: vi.fn(),
  run: vi.fn(),
  // Add any other methods/properties used by the code under test if necessary
};

// Mock the default export of the original db module
export default mockDbInstance;

// Optional: If the original module also has named exports you need to mock,
// export them here as well.
// export const someNamedExport = vi.fn();

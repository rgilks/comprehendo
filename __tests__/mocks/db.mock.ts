// Mock for the database
const mockExec = jest.fn();
const mockPrepare = jest.fn(() => ({
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
}));

const mockDb = {
  exec: mockExec,
  prepare: mockPrepare,
  pragma: jest.fn(),
};

// Export both the mock functions and the mock db object
export default mockDb;
export { mockExec, mockPrepare };

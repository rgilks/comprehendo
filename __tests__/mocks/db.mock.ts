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

export default mockDb;
export { mockExec, mockPrepare };

/**
 * Database mocking utilities for tests
 */

/**
 * Creates a mock database with customizable behavior
 */
export const createMockDb = () => {
  const mockExec = jest.fn();
  const mockPrepare = jest.fn((query) => ({
    get: jest.fn().mockReturnValue(null),
    run: jest.fn(),
    all: jest.fn().mockReturnValue([]),
  }));

  return {
    __esModule: true,
    default: {
      exec: mockExec,
      prepare: mockPrepare,
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    },
  };
};

/**
 * Creates a customized db.prepare implementation for specific test scenarios
 */
export const createPrepareImplementation = (behaviors: Record<string, any>) => {
  return (query: string) => {
    // Loop through behaviors and find matching query
    for (const [queryPart, behavior] of Object.entries(behaviors)) {
      if (query.includes(queryPart)) {
        return behavior;
      }
    }

    // Default behavior
    return {
      get: jest.fn().mockReturnValue(null),
      run: jest.fn(),
      all: jest.fn().mockReturnValue([]),
    };
  };
};

/**
 * Setup behavior for db.prepare to return cached content
 */
export const setupCachedContentMock = (cachedContent: any) => {
  return createPrepareImplementation({
    'FROM generated_content': {
      get: jest.fn().mockReturnValue(cachedContent),
      run: jest.fn(),
      all: jest.fn(),
    },
  });
};

/**
 * Setup behavior for db.prepare to return an authenticated user
 */
export const setupAuthenticatedUserMock = (mockUser: any) => {
  return createPrepareImplementation({
    'FROM users': {
      get: jest.fn().mockReturnValue(mockUser),
      run: jest.fn(),
      all: jest.fn(),
    },
  });
};

export const createMockDb = () => {
  const mockExec = jest.fn();
  const mockPrepare = jest.fn(() => ({
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

export const createPrepareImplementation = (behaviors: Record<string, any>) => {
  return (query: string) => {
    for (const [queryPart, behavior] of Object.entries(behaviors)) {
      if (query.includes(queryPart)) {
        return behavior;
      }
    }

    return {
      get: jest.fn().mockReturnValue(null),
      run: jest.fn(),
      all: jest.fn().mockReturnValue([]),
    };
  };
};

export const setupCachedContentMock = (cachedContent: any) => {
  return createPrepareImplementation({
    'FROM generated_content': {
      get: jest.fn().mockReturnValue(cachedContent),
      run: jest.fn(),
      all: jest.fn(),
    },
  });
};

export const setupAuthenticatedUserMock = (mockUser: any) => {
  return createPrepareImplementation({
    'FROM users': {
      get: jest.fn().mockReturnValue(mockUser),
      run: jest.fn(),
      all: jest.fn(),
    },
  });
};

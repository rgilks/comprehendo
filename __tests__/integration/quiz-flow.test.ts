import { NextRequest } from '../mocks/next-mocks';
import {
  setupTestLogging,
  setupTestEnvironment,
  createChatRequest,
  expectSuccessResponse,
  setupAuthenticatedSession,
  createMockModelConfig,
  createMockOpenAIClient,
} from '../helpers';

// Allow logs during tests for debugging
const restoreLogging = setupTestLogging(true);

// Make OpenAI API key available
const restoreEnv = setupTestEnvironment();

// Pre-mock db before importing anything to prevent exec error
jest.mock('../../lib/db', () => {
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
});

// Mock the OpenAI constructor
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => createMockOpenAIClient()),
}));

// Mock modelConfig to use our OpenAI mock
jest.mock('../../lib/modelConfig', () => ({
  getActiveModel: () => createMockModelConfig('openai'),
  getOpenAIClient: () => createMockOpenAIClient(),
  getGoogleAIClient: () => ({}),
}));

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

// Import mocked db
import db from '../../lib/db';

// Import route modules after mocking dependencies
import { POST } from '../../app/api/chat/route';

describe('Chat API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original environment
    restoreEnv();
    restoreLogging();
  });

  it('completes the full flow from request to AI response', async () => {
    try {
      // Create request using helper
      const req = createChatRequest();

      const response = await POST(req);

      // Validate response using helper
      const jsonData = await expectSuccessResponse(response);
      expect(jsonData.result).toBeDefined();

      // Verify database operations
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO rate_limits'));
      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO generated_content')
      );
    } catch (error) {
      console.error('Test failed with error:', error);
      throw error;
    }
  });

  it('handles authenticated user requests', async () => {
    // Setup authenticated session
    const mockUser = setupAuthenticatedSession();

    // Setup specific mocks for this test
    (db.prepare as jest.Mock).mockImplementation((query) => {
      if (query.includes('SELECT') && query.includes('users')) {
        return {
          get: jest.fn().mockReturnValue({ id: mockUser.id }),
          run: jest.fn(),
          all: jest.fn(),
        };
      }
      return {
        get: jest.fn().mockReturnValue(null),
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
      };
    });

    // Create request using helper
    const req = createChatRequest();

    const response = await POST(req);

    // Validate response using helper
    const jsonData = await expectSuccessResponse(response);
    expect(jsonData.result).toBeDefined();

    // Verify user data was accessed
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM users'));
  });
});

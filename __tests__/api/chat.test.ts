import { NextRequest } from '../mocks/next-mocks';
import {
  setupTestLogging,
  setupTestEnvironment,
  createChatRequest,
  expectSuccessResponse,
  expectErrorResponse,
  setupCachedContentMock,
  setupAuthenticatedSession,
  createMockModelConfig,
  defaultTestResponse,
  createMockOpenAIClient,
  createMockGoogleAIClient,
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

// Create a variable for the modelConfig mock so we can change it between tests
let mockActiveModel = createMockModelConfig('openai');

// Mock OpenAI constructor
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => createMockOpenAIClient()),
}));

// Mock modelConfig to use our OpenAI mock
jest.mock('../../lib/modelConfig', () => ({
  getActiveModel: jest.fn().mockImplementation(() => mockActiveModel),
  getOpenAIClient: jest.fn().mockImplementation(() => createMockOpenAIClient()),
  getGoogleAIClient: jest.fn().mockImplementation(() => createMockGoogleAIClient()),
}));

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

// Import mocked db
import db from '../../lib/db';

// Import route modules after mocking dependencies
import { POST as chatHandler } from '../../app/api/chat/route';
import * as modelConfig from '../../lib/modelConfig';

describe('Chat API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveModel = createMockModelConfig('openai');
  });

  afterAll(() => {
    // Restore original environment
    restoreEnv();
    restoreLogging();
  });

  it('returns cached content if available', async () => {
    // Setup cached content
    const cachedContent = {
      id: 1,
      content: JSON.stringify({
        paragraph: 'Cached content',
        question: 'Is this cached?',
        options: {
          A: 'Yes',
          B: 'No',
          C: 'Maybe',
          D: 'Unknown',
        },
        correctAnswer: 'A',
        explanations: {
          A: 'Correct',
          B: 'Incorrect',
          C: 'Incorrect',
          D: 'Incorrect',
        },
        relevantText: 'Cached content',
        topic: 'Cached Topic',
      }),
      created_at: new Date().toISOString(),
    };

    // Setup mocks for this specific test
    (db.prepare as jest.Mock).mockImplementation(setupCachedContentMock(cachedContent));

    // Create request using helper
    const req = createChatRequest();

    // For debugging
    const response = await chatHandler(req);

    // Validate response using helper
    const jsonData = await expectSuccessResponse(response);
    expect(jsonData.result).toBeDefined();
  });

  it('handles missing prompt', async () => {
    // Create request with empty prompt
    const req = createChatRequest({ prompt: '' });

    const response = await chatHandler(req);

    // Validate error response
    const jsonData = await expectErrorResponse(response, 400);
    expect(jsonData.error).toBe('Prompt is required');
  });

  it('generates content using OpenAI provider', async () => {
    // Setup standard OpenAI config
    mockActiveModel = createMockModelConfig('openai');

    // Create request
    const req = createChatRequest();

    const response = await chatHandler(req);

    // Validate success
    const jsonData = await expectSuccessResponse(response);
    expect(jsonData.result).toBeDefined();

    // Check that OpenAI client was used
    expect(modelConfig.getOpenAIClient).toHaveBeenCalled();
  });

  it('generates content using Google AI provider', async () => {
    // Set active model to Google
    mockActiveModel = createMockModelConfig('google');

    // Create request
    const req = createChatRequest();

    const response = await chatHandler(req);

    // Validate success
    const jsonData = await expectSuccessResponse(response);
    expect(jsonData.result).toBeDefined();

    // Check that Google AI client was used
    expect(modelConfig.getGoogleAIClient).toHaveBeenCalled();
  });

  it('handles authenticated user', async () => {
    // Setup authenticated session
    const mockUser = setupAuthenticatedSession();

    // Setup db to return user info
    (db.prepare as jest.Mock).mockImplementation((query) => {
      if (query.includes('SELECT id FROM users')) {
        return {
          get: jest.fn().mockReturnValue({ id: mockUser.id }),
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }
      return {
        get: jest.fn().mockReturnValue(null),
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
      };
    });

    // Create request
    const req = createChatRequest();

    const response = await chatHandler(req);

    // Validate success
    const jsonData = await expectSuccessResponse(response);
    expect(jsonData.result).toBeDefined();

    // Check that user ID was passed to stats
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO usage_stats'));
  });
});

import {
  setupTestLogging,
  setupTestEnvironment,
  createChatRequest,
  expectSuccessResponse,
  expectErrorResponse,
  setupAuthenticatedSession,
  createMockModelConfig,
  defaultTestResponse,
} from '../helpers';

const restoreLogging = setupTestLogging(true);

const restoreEnv = setupTestEnvironment();

let mockOpenAIClientInstance: any;
let mockGoogleAIClientInstance: any;
let mockActiveModel = createMockModelConfig('openai');

jest.mock('../../lib/modelConfig');

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => mockOpenAIClientInstance),
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => mockGoogleAIClientInstance),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

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

import db from '../../lib/db';
import * as modelConfig from '../../lib/modelConfig';
import { POST as chatRouteHandler } from '../../app/api/chat/route';

describe('Chat API - [/api/chat]', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockOpenAIChatCompletion = {
      choices: [{ message: { content: JSON.stringify(defaultTestResponse) } }],
    };
    mockOpenAIClientInstance = {
      chat: { completions: { create: jest.fn().mockResolvedValue(mockOpenAIChatCompletion) } },
    };

    const mockGoogleAIContentResult = {
      response: { text: jest.fn().mockReturnValue(JSON.stringify(defaultTestResponse)) },
    };
    const mockGoogleAIModel = {
      generateContent: jest.fn().mockResolvedValue(mockGoogleAIContentResult),
    };
    mockGoogleAIClientInstance = {
      getGenerativeModel: jest.fn().mockReturnValue(mockGoogleAIModel),
    };

    mockActiveModel = createMockModelConfig('openai');
    (modelConfig.getActiveModel as jest.Mock).mockReturnValue(mockActiveModel);
    (modelConfig.getOpenAIClient as jest.Mock).mockReturnValue(mockOpenAIClientInstance);
    (modelConfig.getGoogleAIClient as jest.Mock).mockReturnValue(mockGoogleAIClientInstance);

    (require('next-auth').getServerSession as jest.Mock).mockResolvedValue(null);

    const mockDbGet = jest.fn().mockReturnValue(null);
    const mockDbRun = jest.fn();
    (db.prepare as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM users')) {
        return { get: jest.fn().mockReturnValue(null) };
      }
      if (sql.includes('SELECT requests, updated_at FROM rate_limits')) {
        return { get: mockDbGet };
      }
      if (sql.includes('UPDATE rate_limits SET updated_at')) {
        return { run: mockDbRun };
      }
      if (sql.includes('INSERT INTO rate_limits')) {
        return { run: mockDbRun };
      }
      if (sql.includes('SELECT content, created_at FROM generated_content')) {
        return { get: mockDbGet };
      }
      return { get: mockDbGet, run: mockDbRun, all: jest.fn().mockReturnValue([]) };
    });
  });

  afterAll(() => {
    restoreEnv();
    restoreLogging();
  });

  it('returns cached content if available', async () => {
    const cachedResult = {
      content: JSON.stringify({ paragraph: 'Cached paragraph from DB' }),
      created_at: new Date().toISOString(),
    };
    (db.prepare as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('SELECT content, created_at FROM generated_content')) {
        return { get: jest.fn().mockReturnValue(cachedResult) };
      }
      if (sql.includes('SELECT id FROM users')) return { get: jest.fn().mockReturnValue(null) };
      if (sql.includes('rate_limits'))
        return { get: jest.fn().mockReturnValue(null), run: jest.fn() };
      return { get: jest.fn().mockReturnValue(null), run: jest.fn() };
    });

    const req = createChatRequest({
      prompt: 'Generate a paragraph in English CEFR level B1',
      seed: 1,
    });

    const response = await chatRouteHandler(req as unknown as Request);

    const jsonData = await expectSuccessResponse(response);
    expect(jsonData.result).toBeDefined();

    const parsedResult = JSON.parse(jsonData.result);
    expect(parsedResult.paragraph).toBe('Cached paragraph from DB');
  });

  it('handles missing prompt', async () => {
    const req = createChatRequest({ prompt: '' });

    const response = await chatRouteHandler(req as unknown as Request);

    const jsonData = await expectErrorResponse(response, 400);
    expect(jsonData.error).toBe('Invalid request body');
    expect(jsonData.issues).toBeDefined();
    expect(jsonData.issues.prompt).toBeDefined();
    expect(jsonData.issues.prompt).toContain('Prompt is required');
  });

  it('generates content using OpenAI provider', async () => {
    mockActiveModel = createMockModelConfig('openai');
    (modelConfig.getActiveModel as jest.Mock).mockReturnValue(mockActiveModel);
    (db.prepare as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('SELECT content, created_at FROM generated_content'))
        return { get: jest.fn().mockReturnValue(null) };
      if (sql.includes('rate_limits'))
        return { get: jest.fn().mockReturnValue(null), run: jest.fn() };
      if (sql.includes('SELECT id FROM users')) return { get: jest.fn().mockReturnValue(null) };
      return { get: jest.fn().mockReturnValue(null), run: jest.fn() };
    });

    const req = createChatRequest();

    const response = await chatRouteHandler(req as unknown as Request);

    const jsonData = await expectSuccessResponse(response);
    expect(jsonData.result).toBeDefined();
    expect(modelConfig.getOpenAIClient).toHaveBeenCalled();
    expect(mockOpenAIClientInstance.chat.completions.create).toHaveBeenCalled();

    const parsedResult = JSON.parse(jsonData.result);
    expect(parsedResult.paragraph).toBe(defaultTestResponse.paragraph);
  });

  it('generates content using Google AI provider', async () => {
    mockActiveModel = createMockModelConfig('google');
    (modelConfig.getActiveModel as jest.Mock).mockReturnValue(mockActiveModel);
    (db.prepare as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('SELECT content, created_at FROM generated_content'))
        return { get: jest.fn().mockReturnValue(null) };
      if (sql.includes('rate_limits'))
        return { get: jest.fn().mockReturnValue(null), run: jest.fn() };
      if (sql.includes('SELECT id FROM users')) return { get: jest.fn().mockReturnValue(null) };
      return { get: jest.fn().mockReturnValue(null), run: jest.fn() };
    });

    const req = createChatRequest();

    const response = await chatRouteHandler(req as unknown as Request);

    const jsonData = await expectSuccessResponse(response);
    expect(jsonData.result).toBeDefined();
    expect(modelConfig.getGoogleAIClient).toHaveBeenCalled();
    expect(mockGoogleAIClientInstance.getGenerativeModel().generateContent).toHaveBeenCalled();

    const parsedResult = JSON.parse(jsonData.result);
    expect(parsedResult.paragraph).toBe(defaultTestResponse.paragraph);
  });

  it('handles authenticated user', async () => {
    setupAuthenticatedSession();

    mockActiveModel = createMockModelConfig('openai');
    (modelConfig.getActiveModel as jest.Mock).mockReturnValue(mockActiveModel);

    const req = createChatRequest();

    const response = await chatRouteHandler(req as unknown as Request);

    const jsonData = await expectSuccessResponse(response);
    expect(jsonData.result).toBeDefined();
    expect(require('next-auth').getServerSession).toHaveBeenCalled();
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM users'));

    const parsedResult = JSON.parse(jsonData.result);
    expect(parsedResult.paragraph).toBe(defaultTestResponse.paragraph);
  });

  it('returns error if rate limit exceeded', async () => {
    const now = Date.now();
    const recentTimestamps = Array(MAX_REQUESTS_PER_HOUR).fill(now - 1000);
    const rateLimitRecord = {
      requests: JSON.stringify(recentTimestamps),
      updated_at: new Date().toISOString(),
    };
    (db.prepare as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('SELECT requests, updated_at FROM rate_limits')) {
        return { get: jest.fn().mockReturnValue(rateLimitRecord) };
      }
      if (sql.includes('UPDATE rate_limits SET updated_at')) return { run: jest.fn() };
      if (sql.includes('SELECT id FROM users')) return { get: jest.fn().mockReturnValue(null) };
      return { get: jest.fn().mockReturnValue(null), run: jest.fn() };
    });

    const req = createChatRequest();

    const response = await chatRouteHandler(req as unknown as Request);

    const jsonData = await expectErrorResponse(response, 429);
    expect(jsonData.error).toMatch(/Rate limit exceeded/i);
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('SELECT requests, updated_at FROM rate_limits')
    );
    expect(db.prepare).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO rate_limits'));
    expect(modelConfig.getActiveModel).not.toHaveBeenCalled();
  });
});

const MAX_REQUESTS_PER_HOUR = 100;

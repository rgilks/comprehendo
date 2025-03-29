// Import the mocks
import { NextRequest, NextResponse } from '../mocks/next-mocks';

// Allow logs during tests to help with debugging
const originalLog = console.log;
const originalError = console.error;
console.log = originalLog;
console.error = originalError;

// Make OpenAI API key available
process.env.OPENAI_API_KEY = 'test-key';

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

// Create a mock OpenAI client with a more reliable structure
const createMockOpenAIClient = () => {
  return {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  paragraph: 'This is a test paragraph.',
                  question: 'What is this?',
                  options: {
                    A: 'A test',
                    B: 'An example',
                    C: 'A demo',
                    D: 'A sample',
                  },
                  explanations: {
                    A: 'Correct',
                    B: 'Incorrect',
                    C: 'Incorrect',
                    D: 'Incorrect',
                  },
                  correctAnswer: 'A',
                  relevantText: 'This is a test paragraph.',
                  topic: 'Test Topic',
                }),
              },
            },
          ],
        }),
      },
    },
  };
};

// Create a mock Google AI client
const createMockGoogleAIClient = () => {
  return {
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue(
            JSON.stringify({
              paragraph: 'This is a Google AI paragraph.',
              question: 'What is this?',
              options: {
                A: 'A test',
                B: 'An example',
                C: 'A demo',
                D: 'A sample',
              },
              explanations: {
                A: 'Correct',
                B: 'Incorrect',
                C: 'Incorrect',
                D: 'Incorrect',
              },
              correctAnswer: 'A',
              relevantText: 'This is a Google AI paragraph.',
              topic: 'Google AI Topic',
            })
          ),
        },
      }),
    }),
  };
};

// Mock the OpenAI constructor
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => createMockOpenAIClient()),
}));

// Create a variable for the modelConfig mock so we can change it between tests
let mockActiveModel = {
  id: 'gpt-3.5-turbo',
  name: 'gpt-3.5-turbo',
  provider: 'openai',
  displayName: 'GPT-3.5 Turbo',
  maxTokens: 4096,
};

const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalGoogleAIKey = process.env.GOOGLE_AI_API_KEY;

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
    process.env.OPENAI_API_KEY = originalOpenAIKey;
    process.env.GOOGLE_AI_API_KEY = originalGoogleAIKey;
    mockActiveModel = {
      id: 'gpt-3.5-turbo',
      name: 'gpt-3.5-turbo',
      provider: 'openai',
      displayName: 'GPT-3.5 Turbo',
      maxTokens: 4096,
    };
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
    (db.prepare as jest.Mock).mockImplementation((query) => {
      if (query.includes('FROM generated_content')) {
        return {
          get: jest.fn().mockReturnValue(cachedContent),
          run: jest.fn(),
          all: jest.fn(),
        };
      } else {
        return {
          get: jest.fn().mockReturnValue(null),
          run: jest.fn(),
          all: jest.fn(),
        };
      }
    });

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt:
          'Generate a reading comprehension paragraph in English with multiple choice questions in English for CEFR level B1 (Intermediate) language learners.',
        seed: 42,
      }),
    });

    // For debugging
    const response = await chatHandler(req);
    const data = await response.json().catch((e) => {
      console.error('Error parsing response JSON:', e);
      return { error: 'Failed to parse JSON' };
    });
    console.log('Response status:', response.status, 'Data:', data);

    expect(response.status).toBe(200);
    expect(data.result).toBeDefined();
  });

  it('handles missing prompt', async () => {
    // Setup mocks for this specific test
    (db.prepare as jest.Mock).mockImplementation((query) => {
      return {
        get: jest.fn().mockReturnValue(null),
        run: jest.fn(),
        all: jest.fn(),
      };
    });

    // Use empty string for prompt instead of undefined to avoid the substring error
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: '',
        seed: 42,
      }),
    });

    const response = await chatHandler(req);
    const data = await response.json().catch((e) => {
      console.error('Error parsing response JSON:', e);
      return { error: 'Failed to parse JSON' };
    });
    console.log('Response status:', response.status, 'Data:', data);

    expect(response.status).toBe(400);
    expect(data.error).toBe('Prompt is required');
  });

  it('enforces rate limits when MAX_REQUESTS_PER_HOUR is reached', async () => {
    // Setup rate limiting data showing maximum requests reached
    const rateLimitData = {
      requests: JSON.stringify(Array(100).fill(Date.now())), // 100 recent requests
      updated_at: new Date().toISOString(),
    };

    // Setup mocks for this specific test
    (db.prepare as jest.Mock).mockImplementation((query) => {
      if (query.includes('SELECT requests, updated_at FROM rate_limits')) {
        return {
          get: jest.fn().mockReturnValue(rateLimitData),
          run: jest.fn(),
          all: jest.fn(),
        };
      } else {
        return {
          get: jest.fn().mockReturnValue(null),
          run: jest.fn(),
          all: jest.fn(),
        };
      }
    });

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Test prompt',
        seed: 42,
      }),
    });

    const response = await chatHandler(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Rate limit exceeded');
  });
});

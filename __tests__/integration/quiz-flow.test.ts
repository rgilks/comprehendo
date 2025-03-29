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

// Mock the OpenAI constructor
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => createMockOpenAIClient()),
}));

// Mock modelConfig to use our OpenAI mock
jest.mock('../../lib/modelConfig', () => ({
  getActiveModel: () => ({
    id: 'gpt-3.5-turbo',
    name: 'gpt-3.5-turbo',
    provider: 'openai',
    displayName: 'GPT-3.5 Turbo',
    maxTokens: 4096,
  }),
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
import * as modelConfig from '../../lib/modelConfig';

describe('Chat API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes the full flow from request to AI response', async () => {
    try {
      // Setup specific mocks for this test
      (db.prepare as jest.Mock).mockImplementation((query) => {
        // Create a separate mock object for each query
        return {
          get: jest.fn().mockReturnValue(null),
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
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

      const response = await POST(req);

      // Log the response status for debugging
      console.log(`Response status: ${response.status}`);

      const jsonData = await response.json().catch((e) => {
        console.error('Error parsing response JSON:', e);
        return { error: 'Failed to parse JSON' };
      });
      console.log('Response data:', jsonData);

      expect(response.status).toBe(200);
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
    // Mock user lookup in database
    const mockUser = {
      id: '123',
      name: 'Test User',
      email: 'test@example.com',
    };

    // Setup authenticated session
    require('next-auth').getServerSession.mockResolvedValue({
      user: mockUser,
    });

    // Setup specific mocks for this test
    (db.prepare as jest.Mock).mockImplementation((query) => {
      if (query.includes('SELECT') && query.includes('users')) {
        return {
          get: jest.fn().mockReturnValue(mockUser),
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

    const response = await POST(req);
    const data = await response.json().catch((e) => {
      console.error('Error parsing response JSON:', e);
      return { error: 'Failed to parse JSON' };
    });
    console.log('Response status:', response.status, 'Data:', data);

    expect(response.status).toBe(200);
    expect(data.result).toBeDefined();

    // Verify user data was accessed
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM users'));
  });
});

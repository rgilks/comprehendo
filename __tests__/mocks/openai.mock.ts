const mockCreateCompletion = jest.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: JSON.stringify({
          paragraph: 'Sample paragraph for testing',
          question: 'Test question?',
          options: {
            A: 'Option A',
            B: 'Option B',
            C: 'Option C',
            D: 'Option D',
          },
          explanations: {
            A: 'Explanation A',
            B: 'Explanation B',
            C: 'Explanation C',
            D: 'Explanation D',
          },
          correctAnswer: 'B',
          relevantText: 'Sample relevant text',
          topic: 'Test topic',
        }),
      },
    },
  ],
});

export const mockOpenAIClient = {
  chat: {
    completions: {
      create: mockCreateCompletion,
    },
  },
};

export default mockOpenAIClient;

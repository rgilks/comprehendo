// Mock Google AI client
const mockGenerateContent = jest.fn().mockResolvedValue({
  response: {
    text: () =>
      JSON.stringify({
        paragraph: "Sample Google AI paragraph for testing",
        question: "Test Google AI question?",
        options: {
          A: "Google Option A",
          B: "Google Option B",
          C: "Google Option C",
          D: "Google Option D",
        },
        explanations: {
          A: "Google Explanation A",
          B: "Google Explanation B",
          C: "Google Explanation C",
          D: "Google Explanation D",
        },
        correctAnswer: "C",
        relevantText: "Sample Google AI relevant text",
        topic: "Google AI test topic",
      }),
  },
});

export const mockGoogleGenerativeModel = {
  generateContent: mockGenerateContent,
};

export const mockGoogleAIClient = {
  getGenerativeModel: jest.fn(() => mockGoogleGenerativeModel),
};

export default mockGoogleAIClient;

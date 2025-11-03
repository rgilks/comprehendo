let togetherAIApiKey: string | null = null;

export const getTogetherAIApiKey = (): string => {
  if (togetherAIApiKey) {
    return togetherAIApiKey;
  }

  const apiKey = process.env['TOGETHER_AI_API_KEY'];

  if (!apiKey) {
    const errorMsg =
      '[TogetherAI Client] CRITICAL: TOGETHER_AI_API_KEY environment variable is not set. Cannot initialize client.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log('[TogetherAI Client] Initializing Together AI client...');
  togetherAIApiKey = apiKey;
  return togetherAIApiKey;
};


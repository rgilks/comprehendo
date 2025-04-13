describe('Word Cleaning Regex', () => {
  const cleaningRegex = /[^\p{L}\p{N}\s]/gu;

  const cleanWord = (word: string): string => {
    return word.replace(cleaningRegex, '');
  };

  test('should keep basic English words', () => {
    expect(cleanWord('Hello')).toBe('Hello');
  });

  test('should remove punctuation from the end', () => {
    expect(cleanWord('world!')).toBe('world');
  });

  test('should remove punctuation from the beginning', () => {
    expect(cleanWord('.word')).toBe('word');
  });

  test('should remove punctuation from the middle', () => {
    expect(cleanWord('wo-rld')).toBe('world');
  });

  test('should keep numbers', () => {
    expect(cleanWord('word123')).toBe('word123');
  });

  test('should keep leading/trailing whitespace', () => {
    expect(cleanWord(' spaced ')).toBe(' spaced ');
  });

  test('should keep internal whitespace', () => {
    expect(cleanWord('two words')).toBe('two words');
  });

  test('should keep accented characters', () => {
    expect(cleanWord('Résumé')).toBe('Résumé');
  });

  test('should keep characters from other scripts (e.g., Chinese)', () => {
    expect(cleanWord('你好')).toBe('你好');
  });

  test('should return an empty string if only punctuation', () => {
    expect(cleanWord(',.?!')).toBe('');
  });

  test('should return an empty string for an empty input', () => {
    expect(cleanWord('')).toBe('');
  });

  test('should handle the specific case "Yo" correctly', () => {
    expect(cleanWord('Yo')).toBe('Yo');
  });

  test('should handle a mix of allowed and disallowed characters', () => {
    expect(cleanWord('Hello, 世界 123!')).toBe('Hello 世界 123');
  });

  test('should handle symbols', () => {
    expect(cleanWord('test$#@symbol')).toBe('testsymbol');
  });
});

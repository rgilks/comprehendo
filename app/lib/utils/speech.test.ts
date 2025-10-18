import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPlatformInfo, filterAndFormatVoices } from 'app/lib/utils/speech';

// Mock navigator
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  userAgentData: undefined,
};

const mockSpeechSynthesis = {
  getVoices: vi.fn(),
};

const mockVoices = [
  {
    voiceURI: 'Microsoft David Desktop - English (United States)',
    name: 'Microsoft David Desktop - English (United States)',
    lang: 'en-US',
  },
  {
    voiceURI: 'Google US English',
    name: 'Google US English',
    lang: 'en-US',
  },
  {
    voiceURI: 'Samantha',
    name: 'Samantha (Enhanced)',
    lang: 'en-US',
  },
];

describe('speech utils', () => {
  beforeEach(() => {
    // Mock global objects
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
    });

    Object.defineProperty(global, 'window', {
      value: {
        speechSynthesis: mockSpeechSynthesis,
      },
      writable: true,
    });

    mockSpeechSynthesis.getVoices.mockReturnValue(mockVoices);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPlatformInfo', () => {
    it('should detect Windows platform from user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          userAgentData: undefined,
        },
        writable: true,
      });

      const result = getPlatformInfo();

      expect(result.isWindows).toBe(true);
      expect(result.isIOS).toBe(false);
      expect(result.isMac).toBe(false);
      expect(result.platformString).toContain('WINDOWS');
    });

    it('should detect iOS platform from user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
          userAgentData: undefined,
        },
        writable: true,
      });

      const result = getPlatformInfo();

      expect(result.isIOS).toBe(true);
      expect(result.isWindows).toBe(false);
      expect(result.isMac).toBe(false);
    });

    it('should detect Mac platform from user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          userAgentData: undefined,
        },
        writable: true,
      });

      const result = getPlatformInfo();

      expect(result.isMac).toBe(true);
      expect(result.isIOS).toBe(false);
      expect(result.isWindows).toBe(false);
    });

    it('should use userAgentData when available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          userAgentData: {
            platform: 'Windows',
          },
        },
        writable: true,
      });

      const result = getPlatformInfo();

      expect(result.isWindows).toBe(true);
      expect(result.platformString).toBe('WINDOWS');
    });
  });

  describe('filterAndFormatVoices', () => {
    it('should return empty array when window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      });

      const result = filterAndFormatVoices('en');

      expect(result).toEqual([]);
    });

    it('should filter voices by language for English', () => {
      const result = filterAndFormatVoices('en');

      expect(result).toHaveLength(3);
      expect(result.every((voice) => voice.displayName)).toBe(true);
    });

    it('should handle iOS voice name formatting', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
          userAgentData: undefined,
        },
        writable: true,
      });

      const iosVoices = [
        {
          voiceURI: 'Samantha',
          name: 'Samantha (Enhanced)',
          lang: 'en-US',
        },
      ];

      mockSpeechSynthesis.getVoices.mockReturnValue(iosVoices);

      const result = filterAndFormatVoices('en');

      expect(result[0].displayName).toBe('Samantha');
    });
  });
});

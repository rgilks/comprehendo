import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPlatformInfo, filterAndFormatVoices } from './speech';
import { SPEECH_LANGUAGES } from '@/lib/domain/language';
import type { Language } from '@/lib/domain/language';

// Mock SpeechSynthesisVoice
const createMockVoice = (
  name: string,
  lang: string,
  voiceURI: string,
  isDefault: boolean = false
): SpeechSynthesisVoice =>
  ({
    name,
    lang,
    voiceURI,
    default: isDefault,
    localService: true,
  }) as SpeechSynthesisVoice;

const mockVoices: SpeechSynthesisVoice[] = [
  createMockVoice('Microsoft David - English (United States)', 'en-US', 'uri-david-us'),
  createMockVoice('Microsoft Zira - English (United States)', 'en-US', 'uri-zira-us'),
  createMockVoice('Google UK English Female', 'en-GB', 'uri-google-uk-f'),
  createMockVoice('Google UK English Male', 'en-GB', 'uri-google-uk-m'),
  createMockVoice('Samantha', 'en-US', 'uri-samantha'), // Common iOS/Mac voice
  createMockVoice('Alex', 'en-US', 'uri-alex'), // Common Mac voice
  createMockVoice('Tessa', 'en-ZA', 'uri-tessa'),
  createMockVoice('Kyoko', 'ja-JP', 'uri-kyoko'),
  createMockVoice('Google Deutsch', 'de-DE', 'uri-google-de'),
  createMockVoice('Anna', 'de-DE', 'uri-anna'), // Common iOS/Mac voice
  createMockVoice('Anna (Erweitert)', 'de-DE', 'uri-anna-erw'), // This should NOT be filtered by the Mac regex
  createMockVoice('Microsoft Hedda - German (Germany)', 'de-DE', 'uri-hedda-de'),
  createMockVoice('Duplicate Name', 'en-US', 'uri-duplicate-1'),
  createMockVoice('Duplicate Name', 'en-GB', 'uri-duplicate-2'),
];

// Mock navigator properties
const originalNavigator = Object.assign({}, global.navigator);
const originalWindow = Object.assign({}, global.window);

const mockNavigator = (platform?: string, userAgent?: string) => {
  Object.defineProperty(global.navigator, 'userAgentData', {
    value: platform ? { platform } : undefined,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(global.navigator, 'userAgent', {
    value: userAgent || '',
    configurable: true,
    writable: true,
  });
};

const mockSpeechSynthesis = (voices: SpeechSynthesisVoice[] | null) => {
  Object.defineProperty(global.window, 'speechSynthesis', {
    value: {
      getVoices: vi.fn().mockReturnValue(voices || []),
    },
    configurable: true,
    writable: true,
  });
};

describe('speech utilities', () => {
  beforeEach(() => {
    mockNavigator();
    mockSpeechSynthesis(mockVoices);
  });

  afterEach(() => {
    // Restore original objects after each test, checking for existence
    if ('userAgentData' in originalNavigator) {
      Object.defineProperty(global.navigator, 'userAgentData', {
        value: originalNavigator.userAgentData,
        configurable: true,
        writable: true,
      });
    } else {
      // If it didn't exist initially, ensure it's removed or undefined
      Object.defineProperty(global.navigator, 'userAgentData', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }
    Object.defineProperty(global.navigator, 'userAgent', {
      value: originalNavigator.userAgent,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global.window, 'speechSynthesis', {
      value: originalWindow.speechSynthesis,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  describe('getPlatformInfo', () => {
    it('should detect iOS using userAgentData', () => {
      mockNavigator('iOS');
      const info = getPlatformInfo();
      expect(info.isIOS).toBe(true);
      expect(info.isMac).toBe(false);
      expect(info.isWindows).toBe(false);
      expect(info.platformString).toBe('IOS');
    });

    it('should detect macOS using userAgentData', () => {
      mockNavigator('macOS');
      const info = getPlatformInfo();
      expect(info.isIOS).toBe(false);
      expect(info.isMac).toBe(true);
      expect(info.isWindows).toBe(false);
      expect(info.platformString).toBe('MACOS');
    });

    it('should detect Windows using userAgentData', () => {
      mockNavigator('Windows');
      const info = getPlatformInfo();
      expect(info.isIOS).toBe(false);
      expect(info.isMac).toBe(false);
      expect(info.isWindows).toBe(true);
      expect(info.platformString).toBe('WINDOWS');
    });

    it('should detect iOS using userAgent fallback', () => {
      mockNavigator(
        undefined,
        'Mozilla/5.0 (iPhone; CPU iPhone OS 13_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1'
      );
      const info = getPlatformInfo();
      expect(info.isIOS).toBe(true);
      expect(info.isMac).toBe(true);
      expect(info.isWindows).toBe(false);
    });

    it('should detect iPadOS using userAgent fallback', () => {
      mockNavigator(
        undefined,
        'Mozilla/5.0 (iPad; CPU OS 13_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Mobile/15E148 Safari/604.1'
      );
      const info = getPlatformInfo();
      expect(info.isIOS).toBe(true); // iPadOS is detected as iOS
      expect(info.isMac).toBe(true);
      expect(info.isWindows).toBe(false);
    });

    it('should detect macOS using userAgent fallback', () => {
      mockNavigator(
        undefined,
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
      );
      const info = getPlatformInfo();
      expect(info.isIOS).toBe(false);
      expect(info.isMac).toBe(true);
      expect(info.isWindows).toBe(false);
    });

    it('should detect Windows using userAgent fallback', () => {
      mockNavigator(
        undefined,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
      );
      const info = getPlatformInfo();
      expect(info.isIOS).toBe(false);
      expect(info.isMac).toBe(false);
      expect(info.isWindows).toBe(true);
    });

    it('should handle unknown platform using userAgent fallback', () => {
      mockNavigator(
        undefined,
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
      );
      const info = getPlatformInfo();
      expect(info.isIOS).toBe(false);
      expect(info.isMac).toBe(false);
      expect(info.isWindows).toBe(false);
      expect(info.platformString).toContain('LINUX');
    });
  });

  describe('filterAndFormatVoices', () => {
    it('should return empty array if window is undefined', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Purposefully deleting window for test
      delete global.window;
      expect(filterAndFormatVoices('en')).toEqual([]);
      global.window = originalWindow;
    });

    it('should return empty array if getVoices returns null', () => {
      mockSpeechSynthesis(null);
      mockNavigator('Windows');
      expect(filterAndFormatVoices('en')).toEqual([]);
    });

    it('should filter voices for English (en) on Windows', () => {
      mockNavigator('Windows');
      const voices = filterAndFormatVoices('en');
      expect(voices).toEqual([
        { uri: 'uri-david-us', displayName: 'David' },
        { uri: 'uri-zira-us', displayName: 'Zira' },
        { uri: 'uri-google-uk-f', displayName: 'Google UK English Female' },
        { uri: 'uri-google-uk-m', displayName: 'Google UK English Male' },
        { uri: 'uri-samantha', displayName: 'Samantha' },
        { uri: 'uri-alex', displayName: 'Alex' },
        { uri: 'uri-tessa', displayName: 'Tessa' },
        { uri: 'uri-duplicate-1', displayName: 'Duplicate Name' },
      ]);
    });

    it('should filter voices for German (de) on Windows', () => {
      mockNavigator('Windows');
      const voices = filterAndFormatVoices('de');
      expect(voices).toEqual([
        { uri: 'uri-google-de', displayName: 'Google Deutsch' },
        { uri: 'uri-anna', displayName: 'Anna' },
        { uri: 'uri-anna-erw', displayName: 'Anna (Erweitert)' },
        { uri: 'uri-hedda-de', displayName: 'Hedda' },
      ]);
    });

    it('should filter voices for English (en) on macOS', () => {
      mockNavigator('macOS');
      const voices = filterAndFormatVoices('en');
      // Mac doesn't strip 'Microsoft' and only filters specific double-paren names
      expect(voices).toEqual([
        { uri: 'uri-david-us', displayName: 'Microsoft David - English (United States)' },
        { uri: 'uri-zira-us', displayName: 'Microsoft Zira - English (United States)' },
        { uri: 'uri-google-uk-f', displayName: 'Google UK English Female' },
        { uri: 'uri-google-uk-m', displayName: 'Google UK English Male' },
        { uri: 'uri-samantha', displayName: 'Samantha' },
        { uri: 'uri-alex', displayName: 'Alex' },
        { uri: 'uri-tessa', displayName: 'Tessa' },
        { uri: 'uri-duplicate-1', displayName: 'Duplicate Name' },
      ]);
    });

    it('should filter voices for German (de) on macOS', () => {
      mockNavigator('macOS');
      const voices = filterAndFormatVoices('de');
      // The regex /\s\(.*\s\(.*\)\)$/ doesn't match 'Anna (Erweitert)', so it's included.
      // 'Microsoft' prefix is not stripped on Mac.
      expect(voices).toEqual([
        { uri: 'uri-google-de', displayName: 'Google Deutsch' },
        { uri: 'uri-anna', displayName: 'Anna' },
        { uri: 'uri-anna-erw', displayName: 'Anna (Erweitert)' },
        { uri: 'uri-hedda-de', displayName: 'Microsoft Hedda - German (Germany)' },
      ]);
    });

    it('should filter voices for English (en) on iOS', () => {
      mockNavigator('iOS');
      const lang: Language = 'en';
      const speechLang = SPEECH_LANGUAGES[lang]; // 'en-US'
      // Simulate iOS only returning exact language matches
      const iosVoices = mockVoices.filter((v) => v.lang === speechLang);
      mockSpeechSynthesis(iosVoices);

      const voices = filterAndFormatVoices(lang);
      expect(voices).toEqual([
        { uri: 'uri-david-us', displayName: 'Microsoft David - English' },
        { uri: 'uri-zira-us', displayName: 'Microsoft Zira - English' },
        { uri: 'uri-samantha', displayName: 'Samantha' },
        { uri: 'uri-alex', displayName: 'Alex' },
        { uri: 'uri-duplicate-1', displayName: 'Duplicate Name' },
      ]);
      // Note: iOS specific name formatting might be different, the test simulates the code's logic
    });

    it('should filter voices for German (de) on iOS', () => {
      mockNavigator('iOS');
      const lang: Language = 'de';
      const speechLang = SPEECH_LANGUAGES[lang]; // 'de-DE'
      // Simulate iOS only returning exact language matches
      const iosVoices = mockVoices.filter((v) => v.lang === speechLang);
      mockSpeechSynthesis(iosVoices);

      const voices = filterAndFormatVoices(lang);
      // iOS strips trailing parens. Deduplication removes the second 'Anna'.
      expect(voices).toEqual([
        { uri: 'uri-google-de', displayName: 'Google Deutsch' },
        { uri: 'uri-anna', displayName: 'Anna' }, // First Anna wins deduplication
        { uri: 'uri-hedda-de', displayName: 'Microsoft Hedda - German' },
      ]);
    });

    it('should handle languages with no available voices', () => {
      mockNavigator('Windows');
      const voices = filterAndFormatVoices('fr');
      expect(voices).toEqual([]);
    });

    it('should correctly deduplicate voices based on display name', () => {
      mockNavigator('Windows');
      const voicesWithDuplicates = [
        ...mockVoices,
        createMockVoice(
          'Microsoft David - English (United States)',
          'en-US',
          'uri-david-duplicate'
        ), // Duplicate name after stripping MS
        createMockVoice('Anna', 'de-DE', 'uri-anna-duplicate'), // Duplicate existing name
      ];
      mockSpeechSynthesis(voicesWithDuplicates);

      const enVoices = filterAndFormatVoices('en');
      expect(enVoices.filter((v) => v.displayName === 'David')).toHaveLength(1);
      expect(enVoices.filter((v) => v.displayName === 'David')[0].uri).toBe('uri-david-us');

      const deVoices = filterAndFormatVoices('de');
      expect(deVoices.filter((v) => v.displayName === 'Anna')).toHaveLength(1);
      expect(deVoices.filter((v) => v.displayName === 'Anna')[0].uri).toBe('uri-anna');
    });
  });
});

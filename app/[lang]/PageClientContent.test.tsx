import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { type Language } from '@/contexts/LanguageContext';
import { type i18n as I18nInstanceType } from 'i18next';
import { type ComponentType } from 'react';

// Define mocks first
const MockLanguageProvider = vi.fn(({ children }) => <>{children}</>);
const mockT = vi.fn((key) => key);
const mockChangeLanguage = vi.fn().mockResolvedValue(undefined as never);
const mockHasResourceBundle = vi.fn<(lng: string, ns: string) => boolean>();
const mockAddResourceBundle = vi.fn();
const mockI18n = {
  language: 'en',
  changeLanguage: mockChangeLanguage,
  hasResourceBundle: mockHasResourceBundle,
  addResourceBundle: mockAddResourceBundle,
  isInitialized: true,
} as unknown as I18nInstanceType;

// Use vi.doMock (not hoisted)
vi.doMock('@/contexts/LanguageContext', () => ({
  LanguageProvider: MockLanguageProvider,
}));
vi.doMock('./HomeContent', () => ({
  default: () => <div data-testid="home-content">HomeContent</div>,
}));
vi.doMock('react-i18next', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-i18next')>();
  return {
    ...original,
    useTranslation: () => ({ t: mockT }),
    I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
vi.doMock('../i18n.client', () => ({
  default: mockI18n,
}));

// Use a dynamic import for the component AFTER doMock calls
let PageClientContent: ComponentType<any>;

describe('PageClientContent', () => {
  // Dynamically import the component before tests run
  beforeAll(async () => {
    const module = await import('./PageClientContent');
    PageClientContent = module.default;
  });

  const initialLanguage: Language = 'en';
  const initialI18nStore = {
    en: {
      translation: { testKey: 'testValue' },
      anotherNs: { anotherKey: 'anotherValue' },
    },
    fr: {
      translation: { testKey: 'valeurTest' },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockI18n.language = 'en';
    mockHasResourceBundle.mockReturnValue(false);
    mockChangeLanguage.mockResolvedValue(undefined as never);
  });

  it('should render HomeContent', () => {
    render(
      <PageClientContent initialLanguage={initialLanguage} initialI18nStore={initialI18nStore} />
    );
    expect(screen.getByTestId('home-content')).toBeInTheDocument();
  });

  it('should initialize LanguageProvider with initialLanguage', () => {
    render(<PageClientContent initialLanguage="fr" initialI18nStore={initialI18nStore} />);
    expect(MockLanguageProvider).toHaveBeenCalledWith(
      expect.objectContaining({ initialLanguage: 'fr' }),
      undefined
    );
  });

  it('should load initial i18n resources for the initial language', () => {
    mockHasResourceBundle.mockReturnValue(false);
    render(
      <PageClientContent initialLanguage={initialLanguage} initialI18nStore={initialI18nStore} />
    );

    expect(mockHasResourceBundle).toHaveBeenCalledWith('en', 'translation');
    expect(mockAddResourceBundle).toHaveBeenCalledWith(
      'en',
      'translation',
      initialI18nStore.en.translation,
      true,
      true
    );

    expect(mockHasResourceBundle).toHaveBeenCalledWith('en', 'anotherNs');
    expect(mockAddResourceBundle).toHaveBeenCalledWith(
      'en',
      'anotherNs',
      initialI18nStore.en.anotherNs,
      true,
      true
    );

    expect(mockAddResourceBundle).not.toHaveBeenCalledWith(
      'fr',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('should not load i18n resources if they already exist', () => {
    mockHasResourceBundle.mockReturnValue(true);
    render(
      <PageClientContent initialLanguage={initialLanguage} initialI18nStore={initialI18nStore} />
    );
    expect(mockAddResourceBundle).not.toHaveBeenCalled();
  });

  it('should change i18n language if initialLanguage is different', async () => {
    mockI18n.language = 'en';
    const newInitialLanguage: Language = 'fr';

    render(
      <PageClientContent initialLanguage={newInitialLanguage} initialI18nStore={initialI18nStore} />
    );

    await act(async () => {});

    expect(mockChangeLanguage).toHaveBeenCalledWith(newInitialLanguage);
  });

  it('should not change i18n language if initialLanguage is the same', async () => {
    mockI18n.language = 'en';

    render(
      <PageClientContent initialLanguage={initialLanguage} initialI18nStore={initialI18nStore} />
    );

    await act(async () => {});

    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });
});

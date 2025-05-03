import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Page, { generateMetadata, generateStaticParams } from './page';
import { LANGUAGES, type Language } from '@/lib/domain/language';
import { notFound } from 'next/navigation';
import { initServerI18n } from '../i18n';
import PageClientContent from './PageClientContent';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('../i18n', () => ({
  initServerI18n: vi.fn(),
}));

vi.mock('./PageClientContent', () => ({
  default: vi.fn(({ initialLanguage, initialI18nStore }) => (
    <div data-testid="mock-client-content">
      <span data-testid="lang-prop">{initialLanguage}</span>
      <span data-testid="store-prop">{JSON.stringify(initialI18nStore)}</span>
    </div>
  )),
}));

describe('app/[lang]/page.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMetadata', () => {
    it('should return correct metadata', () => {
      const metadata = generateMetadata();
      expect(metadata).toEqual({
        title: 'Comprehendo',
        description: 'An AI-powered language learning tool',
      });
    });
  });

  describe('generateStaticParams', () => {
    it('should generate params for all defined languages', () => {
      const params = generateStaticParams();
      const expectedLangs = Object.keys(LANGUAGES);
      expect(params).toHaveLength(expectedLangs.length);
      expect(params).toEqual(
        expectedLangs.map((lang) => ({
          lang,
        }))
      );
    });
  });

  describe('Page Component', () => {
    it('should call notFound for invalid language', async () => {
      const invalidLang = 'xx';
      const params = Promise.resolve({ lang: invalidLang }) as unknown as Promise<{
        lang: Language;
      }>;

      await expect(Page({ params })).rejects.toThrow('NEXT_NOT_FOUND');

      expect(notFound).toHaveBeenCalledTimes(1);
      expect(initServerI18n).not.toHaveBeenCalled();
      expect(PageClientContent).not.toHaveBeenCalled();
    });

    it('should initialize i18n and render PageClientContent for valid language', async () => {
      const validLang = 'en' as Language;
      const params = Promise.resolve({ lang: validLang });
      const mockI18nStore = { common: { testKey: 'testValue' } };
      const mockI18nInstance = {
        store: { data: mockI18nStore },
      };

      (initServerI18n as Mock).mockResolvedValue(mockI18nInstance);

      const PageComponent = await Page({ params });
      render(PageComponent);

      expect(notFound).not.toHaveBeenCalled();
      expect(initServerI18n).toHaveBeenCalledTimes(1);
      expect(initServerI18n).toHaveBeenCalledWith(validLang, ['common', 'exercise']);

      await waitFor(() => {
        expect(PageClientContent).toHaveBeenCalledTimes(1);
        expect(PageClientContent).toHaveBeenCalledWith(
          {
            initialLanguage: validLang,
            initialI18nStore: mockI18nStore,
          },
          undefined
        );
      });

      expect(screen.getByTestId('lang-prop')).toHaveTextContent(validLang);
      expect(screen.getByTestId('store-prop')).toHaveTextContent(JSON.stringify(mockI18nStore));
    });

    it('should handle another valid language correctly', async () => {
      const validLang = 'es' as Language; // Example: Spanish
      const params = Promise.resolve({ lang: validLang });
      const mockI18nStore = { common: { hola: 'mundo' } };
      const mockI18nInstance = {
        store: { data: mockI18nStore },
      };

      (initServerI18n as Mock).mockResolvedValue(mockI18nInstance);

      const PageComponent = await Page({ params });
      render(PageComponent);

      expect(notFound).not.toHaveBeenCalled();
      expect(initServerI18n).toHaveBeenCalledWith(validLang, ['common', 'exercise']);
      await waitFor(() => {
        expect(PageClientContent).toHaveBeenCalledWith(
          {
            initialLanguage: validLang,
            initialI18nStore: mockI18nStore,
          },
          undefined
        );
      });
      expect(screen.getByTestId('lang-prop')).toHaveTextContent(validLang);
      expect(screen.getByTestId('store-prop')).toHaveTextContent(JSON.stringify(mockI18nStore));
    });

    it('should handle errors from initServerI18n', async () => {
      const validLang = 'en' as Language;
      const params = Promise.resolve({ lang: validLang });
      const i18nError = new Error('Failed to load i18n resources');

      (initServerI18n as Mock).mockRejectedValueOnce(i18nError);

      await expect(Page({ params })).rejects.toThrow(i18nError);

      expect(initServerI18n).toHaveBeenCalledTimes(1);
      expect(initServerI18n).toHaveBeenCalledWith(validLang, ['common', 'exercise']);
      expect(notFound).not.toHaveBeenCalled();
      expect(PageClientContent).not.toHaveBeenCalled();
    });
  });
});

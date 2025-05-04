import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLanguage } from './useLanguage';
import type { Language } from '@/lib/domain/language';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/some/path',
}));

const mockSetLanguage = vi.fn();
const mockLanguages = { en: 'English', fr: 'Français' };

vi.mock('../store/textGeneratorStore', () => ({
  __esModule: true,
  default: (selector: any) =>
    selector({
      language: 'en',
      setLanguage: mockSetLanguage,
      languages: mockLanguages,
    }),
}));

describe('useLanguage', () => {
  beforeEach(() => {
    mockSetLanguage.mockClear();
  });

  it('returns language, setLanguage, and languages', () => {
    const { result } = renderHook(() => useLanguage());
    expect(result.current.language).toBe('en');
    expect(typeof result.current.setLanguage).toBe('function');
    expect(result.current.languages).toBe(mockLanguages);
  });

  it('calls setLanguage with correct args', async () => {
    const { result } = renderHook(() => useLanguage());
    await act(async () => {
      await result.current.setLanguage('fr' as Language);
    });
    expect(mockSetLanguage).toHaveBeenCalledWith('fr', expect.any(Object), '/en/some/path');
  });
});

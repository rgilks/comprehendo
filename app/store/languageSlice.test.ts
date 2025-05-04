import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createLanguageSlice, type LanguageSlice } from './languageSlice';
import type { Language } from '@/lib/domain/language';
import { vi } from 'vitest';
import type { TextGeneratorState } from './textGeneratorStore';

global.window = Object.create(window);
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload, search: '?foo=bar' },
  writable: true,
});

vi.mock('../i18n.client', () => ({
  __esModule: true,
  default: { changeLanguage: vi.fn() },
}));
import i18n from '../i18n.client';

const minimalTextGeneratorState: Omit<TextGeneratorState, keyof LanguageSlice> = {} as any;
type Store = TextGeneratorState;
const createStore = () =>
  create<Store>()(
    immer((...a) => ({ ...minimalTextGeneratorState, ...createLanguageSlice(...a) }))
  );

describe('languageSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (i18n.changeLanguage as any).mockResolvedValue(undefined);
  });

  it('initializes with default language and languages', () => {
    const store = createStore();
    expect(store.getState().language).toBe('en');
    expect(store.getState().languages).toBeDefined();
  });

  it('setLanguage updates language and calls i18n', async () => {
    const store = createStore();
    await store.getState().setLanguage('fr' as Language, undefined, '/en/page');
    expect(store.getState().language).toBe('fr');
    expect(i18n.changeLanguage).toHaveBeenCalledWith('fr');
  });

  it('setLanguage does not update if language is the same', async () => {
    const store = createStore();
    await store.getState().setLanguage('en' as Language, undefined, '/en/page');
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
  });

  it('reloads page if i18n.changeLanguage throws', async () => {
    (i18n.changeLanguage as any).mockRejectedValue(new Error('fail'));
    const store = createStore();
    await store.getState().setLanguage('fr' as Language, undefined, '/en/page');
    expect(mockReload).toHaveBeenCalled();
  });

  it('router.push is called with new path if router is provided', async () => {
    const push = vi.fn();
    const router = { push };
    const store = createStore();
    await store.getState().setLanguage('fr' as Language, router, '/en/page');
    expect(push).toHaveBeenCalledWith('/fr/page?foo=bar');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { i18n as I18nInstance } from 'i18next';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

describe('i18n.client', () => {
  let i18n: I18nInstance;
  let i18nConfig: typeof import('@/lib/domain/i18nConfig').i18nConfig;

  beforeEach(async () => {
    vi.resetModules();
    ({ i18nConfig } = await import('@/lib/domain/i18nConfig'));
    i18n = (await import('./i18n.client')).default;
  });

  it('should be an i18next instance', () => {
    expect(i18n).toHaveProperty('init');
    expect(i18n).toHaveProperty('use');
    expect(i18n).toHaveProperty('t');
  });

  it('should use initReactI18next', () => {
    expect(i18n.options).toBeDefined();
  });

  it('should initialize with config', () => {
    expect(i18n.options.lng).toBe(i18nConfig.lng);
    expect(i18n.options.ns).toEqual(i18nConfig.ns);
  });
});

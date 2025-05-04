import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createUISlice, UISlice } from './uiSlice';
import type { StateCreator } from 'zustand';

interface MockTextGeneratorState extends UISlice {}

const createMockUISlice: StateCreator<
  MockTextGeneratorState,
  [['zustand/immer', never]],
  [],
  UISlice
> = (...args: [any, any, any?]) => createUISlice(...args);

describe('uiSlice', () => {
  let store: ReturnType<typeof setupStore>;

  const setupStore = () =>
    create<MockTextGeneratorState>()(
      immer((...args: [any, any, any?]) => ({
        ...createMockUISlice(...args),
      }))
    );

  beforeEach(() => {
    store = setupStore();
  });

  it('should have initial state', () => {
    expect(store.getState().showLoginPrompt).toBe(true);
    expect(store.getState().showContent).toBe(false);
    expect(store.getState().showQuestionSection).toBe(false);
    expect(store.getState().showExplanation).toBe(false);
  });

  it('setShowLoginPrompt updates showLoginPrompt', () => {
    store.getState().setShowLoginPrompt(false);
    expect(store.getState().showLoginPrompt).toBe(false);
    store.getState().setShowLoginPrompt(true);
    expect(store.getState().showLoginPrompt).toBe(true);
  });

  it('setShowContent updates showContent', () => {
    store.getState().setShowContent(true);
    expect(store.getState().showContent).toBe(true);
    store.getState().setShowContent(false);
    expect(store.getState().showContent).toBe(false);
  });

  it('setShowQuestionSection updates showQuestionSection', () => {
    store.getState().setShowQuestionSection(true);
    expect(store.getState().showQuestionSection).toBe(true);
    store.getState().setShowQuestionSection(false);
    expect(store.getState().showQuestionSection).toBe(false);
  });

  it('setShowExplanation updates showExplanation', () => {
    store.getState().setShowExplanation(true);
    expect(store.getState().showExplanation).toBe(true);
    store.getState().setShowExplanation(false);
    expect(store.getState().showExplanation).toBe(false);
  });
});

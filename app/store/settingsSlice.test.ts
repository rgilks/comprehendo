import { act } from 'react';
import { useTextGeneratorStore } from './textGeneratorStore';
import { vi } from 'vitest';

describe('settingsSlice', () => {
  beforeEach(() => {
    useTextGeneratorStore.setState({
      passageLanguage: 'en',
      generatedPassageLanguage: null,
      generatedQuestionLanguage: null,
      cefrLevel: 'A1',
    });
  });

  it('should have initial state', () => {
    const state = useTextGeneratorStore.getState();
    expect(state.passageLanguage).toBe('en');
    expect(state.generatedPassageLanguage).toBeNull();
    expect(state.generatedQuestionLanguage).toBeNull();
    expect(state.cefrLevel).toBe('A1');
  });

  it('should set generatedPassageLanguage', () => {
    act(() => {
      useTextGeneratorStore.getState().setGeneratedPassageLanguage('fr');
    });
    expect(useTextGeneratorStore.getState().generatedPassageLanguage).toBe('fr');
    act(() => {
      useTextGeneratorStore.getState().setGeneratedPassageLanguage(null);
    });
    expect(useTextGeneratorStore.getState().generatedPassageLanguage).toBeNull();
  });

  it('should set generatedQuestionLanguage', () => {
    act(() => {
      useTextGeneratorStore.getState().setGeneratedQuestionLanguage('de');
    });
    expect(useTextGeneratorStore.getState().generatedQuestionLanguage).toBe('de');
    act(() => {
      useTextGeneratorStore.getState().setGeneratedQuestionLanguage(null);
    });
    expect(useTextGeneratorStore.getState().generatedQuestionLanguage).toBeNull();
  });

  it('should set cefrLevel', () => {
    act(() => {
      useTextGeneratorStore.getState().setCefrLevel('B2');
    });
    expect(useTextGeneratorStore.getState().cefrLevel).toBe('B2');
  });

  it('should set passageLanguage and reset generatedPassageLanguage', () => {
    useTextGeneratorStore.setState({
      passageLanguage: 'fr',
      generatedPassageLanguage: 'fr',
    });
    const stopPassageSpeech = vi.fn();
    const fetchProgress = vi.fn();
    useTextGeneratorStore.setState({ stopPassageSpeech, fetchProgress });
    act(() => {
      useTextGeneratorStore.getState().setPassageLanguage('es');
    });
    expect(useTextGeneratorStore.getState().passageLanguage).toBe('es');
    expect(useTextGeneratorStore.getState().generatedPassageLanguage).toBeNull();
    expect(stopPassageSpeech).toHaveBeenCalled();
    expect(fetchProgress).toHaveBeenCalled();
  });
});

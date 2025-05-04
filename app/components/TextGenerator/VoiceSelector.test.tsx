import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceSelector from './VoiceSelector';
import type { VoiceInfo } from '@/lib/domain/schemas';

describe('VoiceSelector', () => {
  const t = (key: string) => key;
  const setSelectedVoiceURI = vi.fn();
  const voices: VoiceInfo[] = [
    { uri: 'voice1', displayName: 'Voice 1' },
    { uri: 'voice2', displayName: 'Voice 2' },
  ];

  it('renders nothing if no voices', () => {
    const { container } = render(
      <VoiceSelector
        availableVoices={[]}
        selectedVoiceURI={null}
        setSelectedVoiceURI={setSelectedVoiceURI}
        t={t}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders single voice as label', () => {
    render(
      <VoiceSelector
        availableVoices={[voices[0]]}
        selectedVoiceURI={voices[0].uri}
        setSelectedVoiceURI={setSelectedVoiceURI}
        t={t}
      />
    );
    expect(screen.getByText('Voice 1')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders select for multiple voices', () => {
    render(
      <VoiceSelector
        availableVoices={voices}
        selectedVoiceURI={voices[1].uri}
        setSelectedVoiceURI={setSelectedVoiceURI}
        t={t}
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Voice 1')).toBeInTheDocument();
    expect(screen.getByText('Voice 2')).toBeInTheDocument();
  });

  it('calls setSelectedVoiceURI on change', () => {
    render(
      <VoiceSelector
        availableVoices={voices}
        selectedVoiceURI={voices[0].uri}
        setSelectedVoiceURI={setSelectedVoiceURI}
        t={t}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: voices[1].uri } });
    expect(setSelectedVoiceURI).toHaveBeenCalledWith(voices[1].uri);
  });
});

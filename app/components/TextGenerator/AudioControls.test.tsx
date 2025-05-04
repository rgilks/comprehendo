import React from 'react';
import { render, screen } from '@testing-library/react';
import AudioControls from './AudioControls';
import useTextGeneratorStore from '@/store/textGeneratorStore';

vi.mock('@/store/textGeneratorStore');
vi.mock('./PlayPauseButton', () => ({
  default: (props: any) => <div data-testid="play-pause" {...props} />,
}));
vi.mock('./VolumeSlider', () => ({
  default: (props: any) => <div data-testid="volume-slider" {...props} />,
}));
vi.mock('./VoiceSelector', () => ({
  default: (props: any) => <div data-testid="voice-selector" {...props} />,
}));

describe('AudioControls', () => {
  const baseStore = {
    isSpeechSupported: true,
    isSpeakingPassage: false,
    isPaused: false,
    volume: 0.5,
    handlePlayPause: vi.fn(),
    setVolumeLevel: vi.fn(),
    availableVoices: [
      { uri: 'voice1', displayName: 'Voice 1' },
      { uri: 'voice2', displayName: 'Voice 2' },
    ],
    selectedVoiceURI: 'voice1',
    setSelectedVoiceURI: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing if speech is not supported', () => {
    (useTextGeneratorStore as any).mockReturnValue({ ...baseStore, isSpeechSupported: false });
    const { container } = render(<AudioControls />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing if no voices are available', () => {
    (useTextGeneratorStore as any).mockReturnValue({ ...baseStore, availableVoices: [] });
    const { container } = render(<AudioControls />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all controls when supported and voices available', () => {
    (useTextGeneratorStore as any).mockReturnValue(baseStore);
    render(<AudioControls />);
    expect(screen.getByTestId('play-pause')).toBeInTheDocument();
    expect(screen.getByTestId('volume-slider')).toBeInTheDocument();
    expect(screen.getByTestId('voice-selector')).toBeInTheDocument();
  });
});

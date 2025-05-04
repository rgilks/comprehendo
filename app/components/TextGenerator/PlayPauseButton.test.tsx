import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayPauseButton from './PlayPauseButton';

describe('PlayPauseButton', () => {
  const t = (key: string) => key;
  const handlePlayPause = vi.fn();

  it('shows play icon when not speaking', () => {
    render(
      <PlayPauseButton
        isSpeakingPassage={false}
        isPaused={false}
        handlePlayPause={handlePlayPause}
        t={t}
      />
    );
    expect(screen.getByTitle('common.play')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows pause icon when speaking and not paused', () => {
    render(
      <PlayPauseButton
        isSpeakingPassage={true}
        isPaused={false}
        handlePlayPause={handlePlayPause}
        t={t}
      />
    );
    expect(screen.getByTitle('common.pause')).toBeInTheDocument();
  });

  it('shows play icon when paused', () => {
    render(
      <PlayPauseButton
        isSpeakingPassage={true}
        isPaused={true}
        handlePlayPause={handlePlayPause}
        t={t}
      />
    );
    expect(screen.getByTitle('common.play')).toBeInTheDocument();
  });

  it('calls handlePlayPause on click', () => {
    render(
      <PlayPauseButton
        isSpeakingPassage={false}
        isPaused={false}
        handlePlayPause={handlePlayPause}
        t={t}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handlePlayPause).toHaveBeenCalled();
  });
});

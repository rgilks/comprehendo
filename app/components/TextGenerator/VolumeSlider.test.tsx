import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VolumeSlider from './VolumeSlider';

describe('VolumeSlider', () => {
  const t = (key: string) => key;
  const setVolumeLevel = vi.fn();

  it('renders the slider with correct value', () => {
    render(<VolumeSlider volume={0.7} setVolumeLevel={setVolumeLevel} t={t} />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue('0.7');
  });

  it('calls setVolumeLevel on change', () => {
    render(<VolumeSlider volume={0.5} setVolumeLevel={setVolumeLevel} t={t} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.9' } });
    expect(setVolumeLevel).toHaveBeenCalledWith(0.9);
  });
});

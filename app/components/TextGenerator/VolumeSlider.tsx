import { SpeakerWaveIcon } from '@heroicons/react/24/solid';
import React from 'react';

type VolumeSliderProps = {
  volume: number;
  setVolumeLevel: (v: number) => void;
  t: (key: string) => string;
};

const VolumeSlider = ({ volume, setVolumeLevel, t }: VolumeSliderProps) => (
  <div className="flex items-center space-x-2">
    <SpeakerWaveIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
    <input
      type="range"
      min="0"
      max="1"
      step="0.1"
      value={volume}
      onChange={(e) => {
        setVolumeLevel(parseFloat(e.target.value));
      }}
      className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      title={t('common.volume')}
    />
  </div>
);

export default VolumeSlider;

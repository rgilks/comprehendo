'use client';

import React from 'react';
import {
  PlayIcon as HeroPlayIcon,
  PauseIcon as HeroPauseIcon,
  StopIcon as HeroStopIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/solid';
import useTextGeneratorStore from '../../store/textGeneratorStore';
import { useTranslation } from 'react-i18next';

const AudioControls = () => {
  const { t } = useTranslation('common');
  const {
    isSpeechSupported,
    isSpeakingPassage,
    isPaused,
    volume,
    handlePlayPause,
    handleStop,
    setVolumeLevel,
  } = useTextGeneratorStore();

  if (!isSpeechSupported) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handlePlayPause}
        title={isSpeakingPassage && !isPaused ? t('common.pause') : t('common.play')}
        className="flex items-center justify-center p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors disabled:opacity-50"
      >
        {isSpeakingPassage && !isPaused ? (
          <HeroPauseIcon className="w-4 h-4" />
        ) : (
          <HeroPlayIcon className="w-4 h-4" />
        )}
      </button>

      {isSpeakingPassage && (
        <button
          onClick={handleStop}
          title={t('common.stop')}
          className="flex items-center justify-center p-2 bg-red-600 text-white rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
        >
          <HeroStopIcon className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center space-x-2 bg-gray-700 rounded-full px-3 py-1">
        <SpeakerWaveIcon className="w-4 h-4 text-gray-300" aria-hidden="true" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
          className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          title={t('common.volume')}
        />
      </div>
    </div>
  );
};

export default AudioControls;

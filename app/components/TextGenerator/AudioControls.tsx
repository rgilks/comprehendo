'use client';

import React from 'react';
import { SpeakerWaveIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/solid';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import { useTranslation } from 'react-i18next';

const AudioControls = () => {
  const { t } = useTranslation('common');
  const {
    isSpeechSupported,
    isSpeakingPassage,
    isPaused,
    volume,
    handlePlayPause,
    setVolumeLevel,
  } = useTextGeneratorStore();

  if (!isSpeechSupported) {
    return null;
  }

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={handlePlayPause}
        title={isSpeakingPassage && !isPaused ? t('common.pause') : t('common.play')}
        className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
      >
        {isSpeakingPassage && !isPaused ? (
          <PauseIcon className="w-5 h-5" />
        ) : (
          <PlayIcon className="w-5 h-5" />
        )}
      </button>

      <div className="flex items-center space-x-2">
        <SpeakerWaveIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
          className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          title={t('common.volume')}
        />
      </div>
    </div>
  );
};

export default AudioControls;

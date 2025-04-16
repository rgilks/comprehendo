'use client';

import React, { useEffect, useState } from 'react';
import {
  SpeakerWaveIcon,
  PlayIcon,
  PauseIcon,
  ChevronDownIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/solid';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import { useTranslation } from 'react-i18next';
import VoiceInfoModal from './VoiceInfoModal';

const AudioControls = () => {
  const { t } = useTranslation('common');
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const {
    isSpeechSupported,
    isSpeakingPassage,
    isPaused,
    volume,
    handlePlayPause,
    setVolumeLevel,
    availableVoices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    passageLanguage,
    _updateAvailableVoices,
  } = useTextGeneratorStore();

  useEffect(() => {
    if (passageLanguage && isSpeechSupported) {
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          _updateAvailableVoices(passageLanguage);
        };
      } else {
        _updateAvailableVoices(passageLanguage);
      }
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [passageLanguage, _updateAvailableVoices, isSpeechSupported]);

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

      {availableVoices && availableVoices.length > 0 && (
        <div className="flex items-center space-x-1">
          <div className="relative">
            <select
              value={selectedVoiceURI || ''}
              onChange={(e) => setSelectedVoiceURI(e.target.value)}
              className="appearance-none w-full bg-gray-700 border border-gray-600 text-white py-2 pl-3 pr-8 rounded leading-tight focus:outline-none focus:bg-gray-600 focus:border-gray-500 text-sm cursor-pointer"
              title={t('common.selectVoice')}
            >
              {availableVoices.map((voice) => (
                <option key={voice.uri} value={voice.uri}>
                  {voice.displayName}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
              <ChevronDownIcon className="w-4 h-4" />
            </div>
          </div>
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="text-gray-400 hover:text-blue-400 transition-colors p-1"
            title={t('voiceInfo.tooltip')}
          >
            <InformationCircleIcon className="w-5 h-5" />
          </button>
        </div>
      )}
      <VoiceInfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
    </div>
  );
};

export default AudioControls;

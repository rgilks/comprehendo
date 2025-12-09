'use client';

import useTextGeneratorStore from 'app/store/textGeneratorStore';
import { useTranslation } from 'react-i18next';
import PlayPauseButton from './PlayPauseButton';
import VolumeSlider from './VolumeSlider';
import VoiceSelector from './VoiceSelector';

const AudioControls = () => {
  const { t } = useTranslation('common');
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
  } = useTextGeneratorStore();

  if (!isSpeechSupported) return null;
  if (availableVoices.length === 0) return null;

  return (
    <div className="flex items-center space-x-3 relative z-[90]">
      <PlayPauseButton
        isSpeakingPassage={isSpeakingPassage}
        isPaused={isPaused}
        handlePlayPause={handlePlayPause}
        t={t}
      />
      <VolumeSlider volume={volume} setVolumeLevel={setVolumeLevel} t={t} />
      <VoiceSelector
        availableVoices={availableVoices}
        selectedVoiceURI={selectedVoiceURI}
        setSelectedVoiceURI={setSelectedVoiceURI}
        t={t}
      />
    </div>
  );
};

export default AudioControls;

import { ChevronDownIcon } from '@heroicons/react/24/solid';
import React from 'react';
import type { VoiceInfo } from 'app/domain/schemas';

type VoiceSelectorProps = {
  availableVoices: VoiceInfo[];
  selectedVoiceURI: string | null;
  setSelectedVoiceURI: (uri: string) => void;
  t: (key: string) => string;
};

const VoiceSelector = ({
  availableVoices,
  selectedVoiceURI,
  setSelectedVoiceURI,
  t,
}: VoiceSelectorProps) => {
  if (availableVoices.length === 0) return null;
  if (availableVoices.length === 1 && availableVoices[0]) {
    return (
      <div
        className="flex items-center bg-gray-700 border border-gray-600 text-white py-2 px-3 rounded text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]"
        title={availableVoices[0].displayName}
      >
        {availableVoices[0].displayName}
      </div>
    );
  }
  return (
    <div className="relative">
      <select
        data-testid="voice-select"
        value={selectedVoiceURI || ''}
        onChange={(e) => {
          setSelectedVoiceURI(e.target.value);
        }}
        className="appearance-none w-full bg-gray-700 border border-gray-600 text-white py-2 pl-3 pr-8 rounded leading-tight focus:outline-none focus:bg-gray-600 focus:border-gray-500 text-sm cursor-pointer max-w-[150px] truncate"
        title={t('common.selectVoice')}
      >
        {availableVoices.map((voice) => (
          <option key={voice.uri} value={voice.uri} title={voice.displayName}>
            {voice.displayName}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
        <ChevronDownIcon className="w-4 h-4" />
      </div>
    </div>
  );
};

export default VoiceSelector;

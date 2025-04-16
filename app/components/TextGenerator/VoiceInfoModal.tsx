'use client';

import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

interface VoiceInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VoiceInfoModal: React.FC<VoiceInfoModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('common');

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={onClose} // Close on overlay click
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-info-title"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg text-white border border-gray-700"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="voice-info-title" className="text-xl font-semibold text-blue-400">
            {t('voiceInfo.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={t('common.close')}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <p>{t('voiceInfo.intro')}</p>

          <div>
            <h3 className="font-semibold text-green-400 mb-1">{t('voiceInfo.macos.title')}</h3>
            <p className="pl-2 text-gray-300">{t('voiceInfo.macos.path')}</p>
          </div>

          <div>
            <h3 className="font-semibold text-green-400 mb-1">{t('voiceInfo.windows.title')}</h3>
            <p className="pl-2 text-gray-300">{t('voiceInfo.windows.path')}</p>
          </div>

          <div>
            <h3 className="font-semibold text-green-400 mb-1">{t('voiceInfo.ios.title')}</h3>
            <p className="pl-2 text-gray-300">{t('voiceInfo.ios.path')}</p>
          </div>

          <div>
            <h3 className="font-semibold text-green-400 mb-1">{t('voiceInfo.android.title')}</h3>
            <p className="text-xs text-gray-400 mb-1">{t('voiceInfo.android.note')}</p>
            <p className="pl-2 text-gray-300">{t('voiceInfo.android.path')}</p>
          </div>

          <p className="mt-4 pt-4 border-t border-gray-700 text-gray-300">
            {t('voiceInfo.qualityNote')}
          </p>

          <p className="mt-2 text-gray-400">{t('voiceInfo.restartNote')}</p>
        </div>
      </div>
    </div>
  );
};

export default VoiceInfoModal;

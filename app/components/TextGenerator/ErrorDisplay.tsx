'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import { sanitizeText } from 'app/lib/utils/sanitization';

const ErrorDisplay = () => {
  const { t } = useTranslation('common');
  const { error } = useTextGeneratorStore();

  if (!error) {
    return null;
  }

  return (
    <div
      className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative mb-6 shadow-md"
      role="alert"
      data-testid="error-display"
    >
      <strong className="font-bold">{t('common.errorPrefix')}</strong>
      <span className="block sm:inline ml-2">{sanitizeText(error)}</span>
    </div>
  );
};

export default ErrorDisplay;

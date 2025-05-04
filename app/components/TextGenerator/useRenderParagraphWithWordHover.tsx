import React from 'react';
import TranslatableWord from './TranslatableWord';
import { type Language } from '@/lib/domain/language';

type Params = {
  currentWordIndex: number | null;
  isSpeakingPassage: boolean;
  relevantTextRange: { start: number; end: number } | null;
  actualQuestionLanguage: Language;
};

const useRenderParagraphWithWordHover = ({
  currentWordIndex,
  isSpeakingPassage,
  relevantTextRange,
  actualQuestionLanguage,
}: Params) => {
  return React.useCallback(
    (paragraph: string, lang: Language) => {
      const words = paragraph.split(/(\s+)/);
      let currentPos = 0;
      return words.map((segment, index) => {
        const segmentStart = currentPos;
        const segmentEnd = currentPos + segment.length;
        currentPos = segmentEnd;

        if (/^\s+$/.test(segment)) {
          return <span key={index}>{segment}</span>;
        }

        const wordIndex = words.slice(0, index + 1).filter((s) => !/^\s+$/.test(s)).length - 1;
        const isCurrent =
          currentWordIndex !== null && currentWordIndex === wordIndex && isSpeakingPassage;

        const isRelevant =
          relevantTextRange !== null &&
          segmentEnd > relevantTextRange.start &&
          segmentStart < relevantTextRange.end;

        return (
          <TranslatableWord
            key={index}
            word={segment}
            fromLang={lang}
            toLang={actualQuestionLanguage}
            isCurrentWord={isCurrent}
            isRelevant={isRelevant}
          />
        );
      });
    },
    [currentWordIndex, isSpeakingPassage, relevantTextRange, actualQuestionLanguage]
  );
};

export default useRenderParagraphWithWordHover;

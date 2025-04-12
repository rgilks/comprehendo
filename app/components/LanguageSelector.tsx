'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/contexts/LanguageContext';
import AnimateTransition from '@/components/AnimateTransition';

const LanguageSelector = () => {
  const { language, setLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (lang: Language) => {
    void setLanguage(lang);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block text-left z-30" ref={dropdownRef}>
      <div className="flex items-center space-x-1 md:space-x-2">
        <label
          htmlFor="language-select-button"
          className="text-xs md:text-sm text-gray-400 hidden xs:inline"
        >
          Language:
        </label>
        <button
          id="language-select-button"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-transparent text-white text-xs md:text-sm border border-gray-600 rounded-md px-2 py-1 md:px-3 md:py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-500 hover:border-gray-500 transition-colors cursor-pointer inline-flex justify-between items-center w-auto min-w-[80px] md:min-w-[100px]"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          {languages[language]}
          <svg
            className={`-mr-1 ml-1 md:ml-2 h-3 w-3 md:h-4 md:w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <AnimateTransition
        show={isOpen}
        type="slide-down"
        className="origin-top-left absolute left-0 top-full mt-2 w-auto min-w-[100px] z-50"
        unmountOnExit
      >
        <div
          className="rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="menu-button"
        >
          <div className="py-1" role="none">
            {(Object.keys(languages) as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => handleSelect(lang)}
                className={`${language === lang ? 'bg-gray-700 text-white' : 'text-gray-300'} block w-full px-4 py-2 text-sm text-left hover:bg-gray-600 hover:text-white transition-colors`}
                role="menuitem"
              >
                {languages[lang]}
              </button>
            ))}
          </div>
        </div>
      </AnimateTransition>
    </div>
  );
};

export default LanguageSelector;

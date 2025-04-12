'use client';

import { useEffect, useRef, ReactNode } from 'react';
import AnimateTransition from './AnimateTransition';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
}

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  showCloseButton = true,
}: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <AnimateTransition
        show={isOpen}
        type="fade-in"
        className="fixed inset-0 bg-black/50"
        unmountOnExit
      >
        <div></div>
      </AnimateTransition>
      <AnimateTransition
        show={isOpen}
        type="scale-up"
        className={`${maxWidth} w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-10`}
        unmountOnExit
      >
        <div ref={modalRef}>
          {title && (
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-medium text-white">{title}</h3>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
          <div className="p-6">{children}</div>
        </div>
      </AnimateTransition>
    </div>
  );
};

export default Modal;

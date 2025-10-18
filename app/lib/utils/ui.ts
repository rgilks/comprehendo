export interface UIState {
  showCreditsInfo: boolean;
  showInstruction: boolean;
}

export interface UIClickHandlers {
  handleCreditsClick: () => void;
  handleCloseInstruction: () => void;
}

export const createUIClickHandlers = (
  setShowCreditsInfo: React.Dispatch<React.SetStateAction<boolean>>,
  setShowInstruction: (show: boolean) => void
): UIClickHandlers => {
  return {
    handleCreditsClick: () => {
      setShowCreditsInfo((prev: boolean) => !prev);
    },
    handleCloseInstruction: () => {
      setShowInstruction(false);
    },
  };
};

export const shouldCloseCreditsInfo = (event: MouseEvent, showCreditsInfo: boolean): boolean => {
  if (!showCreditsInfo) return false;

  const target = event.target as HTMLElement;
  return (
    !target.closest('[data-testid="hover-credits-display"]') &&
    !target.closest('.credits-info-panel')
  );
};

export const createScrollToContentHandler = (
  contentContainerRef: React.RefObject<HTMLDivElement>
) => {
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };
};

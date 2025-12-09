import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';

type PlayPauseButtonProps = {
  isSpeakingPassage: boolean;
  isPaused: boolean;
  handlePlayPause: () => void;
  t: (key: string) => string;
};

const PlayPauseButton = ({
  isSpeakingPassage,
  isPaused,
  handlePlayPause,
  t,
}: PlayPauseButtonProps) => (
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
);

export default PlayPauseButton;

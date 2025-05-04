import { render, screen, fireEvent } from '@testing-library/react';
import VoiceInfoModal from './VoiceInfoModal';
import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('VoiceInfoModal', () => {
  it('does not render when isOpen is false', () => {
    render(<VoiceInfoModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders when isOpen is true', () => {
    render(<VoiceInfoModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('voiceInfo.title')).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<VoiceInfoModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<VoiceInfoModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when modal content is clicked', () => {
    const onClose = vi.fn();
    render(<VoiceInfoModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('voiceInfo.title'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

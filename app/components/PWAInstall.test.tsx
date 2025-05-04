import { render, screen, fireEvent, act } from '@testing-library/react';
import PWAInstall from './PWAInstall';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

global.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as unknown as typeof window.matchMedia;

type ListenerFn = (event?: any) => void;

describe('PWAInstall', () => {
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;
  let listeners: Record<string, ListenerFn[]>;

  beforeEach(() => {
    listeners = {};
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;
    window.addEventListener = (event: string, cb: EventListenerOrEventListenerObject) => {
      listeners[event] = [];
      listeners[event].push(cb as ListenerFn);
    };
    window.removeEventListener = (event: string, cb: EventListenerOrEventListenerObject) => {
      listeners[event] = listeners[event].filter((fn: ListenerFn) => fn !== cb);
    };
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    vi.clearAllMocks();
  });

  it('shows install button when beforeinstallprompt is fired', () => {
    render(<PWAInstall />);
    act(() => {
      listeners['beforeinstallprompt'][0]({
        preventDefault: () => {},
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
    });
    expect(screen.getByText('pwa.installPrompt')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('pwa.installButton');
  });

  it('calls prompt and hides button after install', async () => {
    render(<PWAInstall />);
    let promptCalled = false;
    act(() => {
      listeners['beforeinstallprompt'][0]({
        preventDefault: () => {},
        prompt: () => {
          promptCalled = true;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
    });
    const btn = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(promptCalled).toBe(true);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides button when appinstalled is fired', () => {
    render(<PWAInstall />);
    act(() => {
      listeners['beforeinstallprompt'][0]({
        preventDefault: () => {},
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
    });
    expect(screen.getByRole('button')).toBeInTheDocument();
    act(() => {
      listeners['appinstalled'][0]();
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not show button in standalone mode', () => {
    (global.matchMedia as any).mockReturnValueOnce({ matches: true });
    render(<PWAInstall />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('uses translation keys', () => {
    render(<PWAInstall />);
    act(() => {
      listeners['beforeinstallprompt'][0]({
        preventDefault: () => {},
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
    });
    expect(screen.getByText('pwa.installPrompt')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('pwa.installButton');
  });
});

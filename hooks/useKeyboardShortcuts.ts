// Keyboard shortcuts hook
import { useEffect } from 'react';

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: () => void;
    description: string;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[], enabled = true) => {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Don't trigger if typing in an input
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            for (const shortcut of shortcuts) {
                const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                               event.code.toLowerCase() === shortcut.key.toLowerCase();

                const modifiersMatch =
                    (!shortcut.ctrl || event.ctrlKey || event.metaKey) &&
                    (!shortcut.shift || event.shiftKey) &&
                    (!shortcut.alt || event.altKey) &&
                    (shortcut.ctrl === undefined || shortcut.ctrl === (event.ctrlKey || event.metaKey)) &&
                    (shortcut.shift === undefined || shortcut.shift === event.shiftKey) &&
                    (shortcut.alt === undefined || shortcut.alt === event.altKey);

                if (keyMatch && modifiersMatch) {
                    event.preventDefault();
                    shortcut.handler();
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts, enabled]);
};

export const STANDARD_SHORTCUTS = {
    PLAY_PAUSE: { key: ' ', description: 'Play/Pause' },
    SKIP_FORWARD: { key: 'ArrowRight', description: 'Skip forward 10s' },
    SKIP_BACKWARD: { key: 'ArrowLeft', description: 'Skip backward 10s' },
    NEXT_CHAPTER: { key: 'n', description: 'Next chapter' },
    PREVIOUS_CHAPTER: { key: 'p', description: 'Previous chapter' },
    INCREASE_SPEED: { key: ']', description: 'Increase playback speed' },
    DECREASE_SPEED: { key: '[', description: 'Decrease playback speed' },
    TOGGLE_VIEW: { key: 'v', description: 'Toggle oscilloscope/spectrogram' },
    HELP: { key: '?', shift: true, description: 'Show keyboard shortcuts' },
};

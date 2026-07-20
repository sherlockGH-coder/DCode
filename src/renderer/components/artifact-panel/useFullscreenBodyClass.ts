import { useEffect, type Dispatch, type SetStateAction } from 'react';

export function useFullscreenBodyClass(
  fullscreen: boolean,
  setFullscreen: Dispatch<SetStateAction<boolean>>,
): void {
  useEffect(() => {
    if (!fullscreen) {
      document.body.classList.remove('artifact-fullscreen');
      return;
    }
    document.body.classList.add('artifact-fullscreen');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('artifact-fullscreen');
    };
  }, [fullscreen, setFullscreen]);
}

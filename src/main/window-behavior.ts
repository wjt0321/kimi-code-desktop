import { join } from 'node:path';

import type { ResolvedTheme } from '../shared/contracts';

export interface WindowCloseEvent {
  preventDefault(): void;
}

export function createCloseRequestController(requestConfirmation: () => void, close: () => void): {
  handleClose(event: WindowCloseEvent): void;
  confirmClose(): void;
} {
  let confirmed = false;
  return {
    handleClose(event) {
      if (confirmed) return;
      event.preventDefault();
      requestConfirmation();
    },
    confirmClose() {
      if (confirmed) return;
      confirmed = true;
      close();
    },
  };
}

export function resolveWindowIconPath(isPackaged: boolean, resourcesPath: string, currentDir: string): string {
  return isPackaged
    ? join(resourcesPath, 'kimi-code.ico')
    : join(currentDir, '../../build/kimi-code.ico');
}


export function resolveWindowTheme(theme: ResolvedTheme): {
  backgroundColor: string;
  overlayColor: string;
  symbolColor: string;
} {
  return theme === 'light'
    ? { backgroundColor: '#f2f1ed', overlayColor: '#ebeae6', symbolColor: '#4f5561' }
    : { backgroundColor: '#101216', overlayColor: '#0f1014', symbolColor: '#9da3b0' };
}

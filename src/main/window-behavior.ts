import { join } from 'node:path';

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

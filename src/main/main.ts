import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  ApprovalDecisionRequestSchema,
  CreateTaskRequestSchema,
  PromptRequestSchema,
  QuestionDismissRequestSchema,
  QuestionResponseRequestSchema,
  RenameSessionRequestSchema,
  SessionIdSchema,
  TaskWatchRequestSchema,
  WorkspaceRootRequestSchema,
} from '../shared/contracts';
import { discoverKimiCli, validateKimiCli } from './cli/cli-discovery';
import { createReviewIpcHandlers, createSessionIpcHandlers, DesktopController } from './ipc';
import { isTrustedNavigation } from './navigation-guard';
import { createChildProcessFactory } from './server/child-process-factory';
import { KimiCapabilityService } from './server/capability-service';
import { KimiDesktopClient } from './server/kimi-client';
import { LiveTaskFeed } from './server/live-task-feed';
import { KimiServerLifecycle } from './server/server-lifecycle';
import { createRuntimeShutdown } from './runtime-shutdown';
import { createCloseRequestController, resolveWindowIconPath } from './window-behavior';

const currentDir = dirname(fileURLToPath(import.meta.url));

export function createMainWindow(onClosed?: () => void): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#101216',
    icon: resolveWindowIconPath(app.isPackaged, process.resourcesPath, currentDir),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f1014',
      symbolColor: '#9da3b0',
      height: 36,
    },
    webPreferences: {
      preload: join(currentDir, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
    ?? pathToFileURL(join(currentDir, '../renderer/index.html')).toString();

  window.once('ready-to-show', () => window.show());
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`Preload failed at ${preloadPath}: ${error.message}`);
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigation(url, rendererUrl)) event.preventDefault();
  });
  const closeController = createCloseRequestController(
    () => window.webContents.send('desktop:close-requested'),
    () => window.close(),
  );
  const confirmClose = (event: Electron.IpcMainEvent) => {
    if (event.sender === window.webContents) closeController.confirmClose();
  };
  ipcMain.on('desktop:confirm-close', confirmClose);
  window.on('close', closeController.handleClose);
  window.on('closed', () => {
    ipcMain.off('desktop:confirm-close', confirmClose);
    if (BrowserWindow.getAllWindows().length === 0) onClosed?.();
  });
  void window.loadURL(rendererUrl);

  return window;
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Unable to allocate a local port.'));
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function registerIpc(controller: DesktopController, client: KimiDesktopClient): void {
  const sessionHandlers = createSessionIpcHandlers(client);
  const reviewHandlers = createReviewIpcHandlers({
    exists: existsSync,
    reveal: (path) => shell.showItemInFolder(path),
    copy: (text) => clipboard.writeText(text),
  });
  ipcMain.handle('desktop:status', () => controller.status());
  ipcMain.handle('desktop:capabilities', () => controller.capabilitySnapshot());
  ipcMain.handle('desktop:refresh-capabilities', () => controller.refreshCapabilities());
  ipcMain.handle('desktop:refresh-cli', () => controller.refreshCli());
  ipcMain.handle('desktop:start-server', () => controller.startServer());
  ipcMain.handle('desktop:stop-server', () => controller.stopServer());
  ipcMain.handle('desktop:list-workspaces', () => client.listWorkspaces());
  ipcMain.handle('desktop:choose-workspace-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择工作区文件夹',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle('desktop:create-workspace', (_event, input: unknown) => {
    const request = WorkspaceRootRequestSchema.parse(input);
    return client.createWorkspace(request.root);
  });
  ipcMain.handle('desktop:list-sessions', () => client.listSessions());
  ipcMain.handle('desktop:list-archived-sessions', () => sessionHandlers.listArchived());
  ipcMain.handle('desktop:get-session-runtime', (_event, sessionId: unknown) => sessionHandlers.getRuntime(sessionId));
  ipcMain.handle('desktop:update-session-runtime', (_event, input: unknown) => sessionHandlers.updateRuntime(input));
  ipcMain.handle('desktop:compact-session', (_event, input: unknown) => sessionHandlers.compact(input));
  ipcMain.handle('desktop:undo-session', (_event, input: unknown) => sessionHandlers.undo(input));
  ipcMain.handle('desktop:fork-session', (_event, input: unknown) => sessionHandlers.fork(input));
  ipcMain.handle('desktop:restore-session', (_event, input: unknown) => sessionHandlers.restore(input));
  ipcMain.handle('desktop:reveal-path', (_event, input: unknown) => reviewHandlers.reveal(input));
  ipcMain.handle('desktop:copy-text', (_event, input: unknown) => reviewHandlers.copy(input));
  ipcMain.handle('desktop:list-models', () => client.listModels());
  ipcMain.handle('desktop:rename-session', (_event, input: unknown) => {
    const request = RenameSessionRequestSchema.parse(input);
    return client.renameSession(request.sessionId, request.title);
  });
  ipcMain.handle('desktop:archive-session', (_event, sessionId: unknown) => client.archiveSession(SessionIdSchema.parse(sessionId)));
  ipcMain.handle('desktop:get-task-snapshot', (_event, sessionId: unknown) => client.getTaskSnapshot(SessionIdSchema.parse(sessionId)));
  ipcMain.handle('desktop:watch-task', (_event, input: unknown) => {
    const request = TaskWatchRequestSchema.parse(input);
    return controller.watchTask(request.sessionId, request.agentId);
  });
  ipcMain.handle('desktop:unwatch-task', (_event, sessionId: unknown) => controller.unwatchTask(sessionId === undefined ? undefined : SessionIdSchema.parse(sessionId)));
  ipcMain.handle('desktop:list-messages', (_event, sessionId: unknown) => client.listMessages(SessionIdSchema.parse(sessionId)));
  ipcMain.handle('desktop:submit-prompt', (_event, input: unknown) => {
    const prompt = PromptRequestSchema.parse(input);
    return client.submitPrompt(prompt.sessionId, prompt.text, prompt.model);
  });
  ipcMain.handle('desktop:abort-session', (_event, sessionId: unknown) => client.abort(SessionIdSchema.parse(sessionId)));
  ipcMain.handle('desktop:create-task', async (_event, input: unknown) => {
    if (input !== undefined) return client.createTask(CreateTaskRequestSchema.parse(input));
    const result = await dialog.showOpenDialog({
      title: '选择任务文件夹',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return client.createSession(result.filePaths[0]);
  });
  ipcMain.handle('desktop:respond-approval', (_event, input: unknown) => client.respondApproval(ApprovalDecisionRequestSchema.parse(input)));
  ipcMain.handle('desktop:respond-question', (_event, input: unknown) => client.respondQuestion(QuestionResponseRequestSchema.parse(input)));
  ipcMain.handle('desktop:dismiss-question', (_event, input: unknown) => client.dismissQuestion(QuestionDismissRequestSchema.parse(input)));
  ipcMain.handle('desktop:choose-cli-executable', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Kimi CLI launcher', extensions: ['cmd', 'exe'] }],
    });
    if (result.canceled || !result.filePaths[0]) return controller.status();
    return controller.chooseCliExecutable(result.filePaths[0]);
  });
  controller.onStatus((status) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('desktop:status-changed', status);
  });
  controller.onCapabilities((snapshot) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('desktop:capabilities-changed', snapshot);
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('io.github.wjt0321.kimi-code-desktop');
  Menu.setApplicationMenu(null);
  const lifecycle = new KimiServerLifecycle({ childFactory: createChildProcessFactory(), portProvider: getAvailablePort });
  const capabilities = new KimiCapabilityService({
    desktopVersion: app.getVersion(),
    request: (path, init) => lifecycle.request(path, init),
  });
  const feed = new LiveTaskFeed({ openSocket: () => lifecycle.openEventSocket() });
  const controller = new DesktopController({
    discover: discoverKimiCli,
    validate: validateKimiCli,
    lifecycle,
    feed,
    capabilities,
  });
  registerIpc(controller, new KimiDesktopClient(lifecycle));
  controller.onTaskEvent((event) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('desktop:task-event', event);
  });
  const shutdown = createRuntimeShutdown(feed, lifecycle);
  const closeRuntime = () => shutdown();
  createMainWindow(closeRuntime);
  await controller.refreshCli();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(closeRuntime);
  });

  app.on('before-quit', shutdown);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

import type { DesktopSession, DesktopWorkspace } from '../../shared/contracts';

export function workspaceIdForSession(
  session: DesktopSession,
  workspaces: readonly DesktopWorkspace[],
): string | undefined {
  if (session.workspaceId && workspaces.some((workspace) => workspace.id === session.workspaceId)) return session.workspaceId;
  return workspaces.find((workspace) => workspace.root === session.cwd)?.id;
}

export function sessionsForWorkspace(
  workspace: DesktopWorkspace,
  sessions: readonly DesktopSession[],
): DesktopSession[] {
  return sessions.filter((session) => session.workspaceId === workspace.id || (session.workspaceId === undefined && session.cwd === workspace.root));
}

export function mergeSessions(current: readonly DesktopSession[], incoming: readonly DesktopSession[]): DesktopSession[] {
  const byId = new Map(current.map((session) => [session.id, session]));
  for (const session of incoming) byId.set(session.id, session);
  return [...byId.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function resolveNavigation(
  workspaces: readonly DesktopWorkspace[],
  sessions: readonly DesktopSession[],
  preferredWorkspaceId?: string,
  preferredSessionId?: string,
): { workspaceId?: string; sessionId?: string } {
  const preferredSession = sessions.find((session) => session.id === preferredSessionId);
  if (preferredSession) {
    return {
      workspaceId: workspaceIdForSession(preferredSession, workspaces) ?? preferredWorkspaceId ?? workspaces[0]?.id,
      sessionId: preferredSession.id,
    };
  }
  const workspaceId = preferredWorkspaceId && workspaces.some((workspace) => workspace.id === preferredWorkspaceId)
    ? preferredWorkspaceId
    : workspaces[0]?.id;
  if (!workspaceId) return {};
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const sessionId = workspace ? sessionsForWorkspace(workspace, sessions)[0]?.id : undefined;
  return { workspaceId, sessionId };
}

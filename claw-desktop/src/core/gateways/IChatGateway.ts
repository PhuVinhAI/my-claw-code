// IChatGateway - Port (Interface)
import { StreamEvent, PermissionRequest, Session, SessionMetadata, WorkMode } from '../entities';

export type UnsubscribeFn = () => void;

export interface IChatGateway {
  // Commands
  sendPrompt(text: string): Promise<void>;
  answerPermission(requestId: string, allow: boolean): Promise<void>;
  loadSession(sessionId: string, workMode: string, workspacePath: string | null): Promise<void>;
  saveSession(sessionId: string): Promise<void>;
  getSession(): Promise<Session>;
  cancelPrompt(): Promise<void>;
  getModel(): Promise<string>;
  sendToolInput(toolUseId: string, input: string): Promise<void>; // Send stdin to interactive tool

  // Session CRUD
  listSessions(): Promise<SessionMetadata[]>;
  deleteSession(sessionId: string, workMode: string, workspacePath: string | null): Promise<void>;
  renameSession(sessionId: string, title: string, workMode: string, workspacePath: string | null): Promise<void>;
  newSession(): Promise<string>;
  getCurrentSessionId(): Promise<string | null>;

  // Work Mode
  getWorkMode(): Promise<WorkMode>;
  setWorkMode(mode: WorkMode, workspacePath?: string): Promise<void>;
  getWorkspacePath(): Promise<string | null>;
  setSelectedTools(tools: string[]): Promise<void>; // Set selected tools for Normal mode

  // Events
  onStreamEvent(callback: (event: StreamEvent) => void): UnsubscribeFn;
  onPermissionRequest(callback: (request: PermissionRequest) => void): UnsubscribeFn;
}

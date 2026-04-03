// IChatGateway - Port (Interface)
import { StreamEvent, PermissionRequest, Session, SessionMetadata } from '../entities';

export type UnsubscribeFn = () => void;

export interface IChatGateway {
  // Commands
  sendPrompt(text: string): Promise<void>;
  answerPermission(requestId: string, allow: boolean): Promise<void>;
  loadSession(sessionId: string): Promise<void>;
  saveSession(sessionId: string): Promise<void>;
  getSession(): Promise<Session>;
  cancelPrompt(): Promise<void>;
  getModel(): Promise<string>;
  sendToolInput(toolUseId: string, input: string): Promise<void>; // Send stdin to interactive tool

  // Session CRUD
  listSessions(): Promise<SessionMetadata[]>;
  deleteSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, title: string): Promise<void>;
  newSession(): Promise<string>;
  getCurrentSessionId(): Promise<string | null>;

  // Events
  onStreamEvent(callback: (event: StreamEvent) => void): UnsubscribeFn;
  onPermissionRequest(callback: (request: PermissionRequest) => void): UnsubscribeFn;
}

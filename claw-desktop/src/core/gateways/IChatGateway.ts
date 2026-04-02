// IChatGateway - Port (Interface)
import { StreamEvent, PermissionRequest, Session } from '../entities';

export type UnsubscribeFn = () => void;

export interface IChatGateway {
  // Commands
  sendPrompt(text: string): Promise<void>;
  answerPermission(requestId: string, allow: boolean): Promise<void>;
  loadSession(sessionId: string): Promise<void>;
  saveSession(sessionId: string): Promise<void>;
  getSession(): Promise<Session>;

  // Events
  onStreamEvent(callback: (event: StreamEvent) => void): UnsubscribeFn;
  onPermissionRequest(callback: (request: PermissionRequest) => void): UnsubscribeFn;
}

// TauriChatGateway - Adapter implementing IChatGateway
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { IChatGateway, UnsubscribeFn } from '../../core/gateways';
import { StreamEvent, PermissionRequest, Session, SessionMetadata } from '../../core/entities';

export class TauriChatGateway implements IChatGateway {
  async sendPrompt(text: string): Promise<void> {
    await invoke('send_prompt', { text });
  }

  async answerPermission(requestId: string, allow: boolean): Promise<void> {
    await invoke('answer_permission', { requestId, allow });
  }

  async loadSession(sessionId: string, workMode: string, workspacePath: string | null): Promise<void> {
    await invoke('load_session', { sessionId, workMode, workspacePath });
  }

  async saveSession(sessionId: string): Promise<void> {
    await invoke('save_session', { sessionId });
  }

  async getSession(): Promise<Session> {
    return await invoke('get_session');
  }

  async cancelPrompt(): Promise<void> {
    await invoke('cancel_prompt');
  }

  async sendToolInput(toolUseId: string, input: string): Promise<void> {
    await invoke('send_tool_input', { toolUseId, input });
  }

  async cancelToolExecution(toolUseId: string): Promise<void> {
    await invoke('cancel_tool_execution', { toolUseId });
  }

  async detachToolExecution(toolUseId: string): Promise<void> {
    await invoke('detach_tool_execution', { toolUseId });
  }

  onStreamEvent(callback: (event: StreamEvent) => void): UnsubscribeFn {
    let unlisten: UnlistenFn | null = null;

    listen<StreamEvent>('stream_event', (event) => {
      callback(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }

  onPermissionRequest(callback: (request: PermissionRequest) => void): UnsubscribeFn {
    let unlisten: UnlistenFn | null = null;

    listen<PermissionRequest>('permission_requested', (event) => {
      callback(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }

  async listSessions(): Promise<SessionMetadata[]> {
    return await invoke('list_sessions');
  }

  async deleteSession(sessionId: string, workMode: string, workspacePath: string | null): Promise<void> {
    await invoke('delete_session', { sessionId, workMode, workspacePath });
  }

  async renameSession(sessionId: string, title: string, workMode: string, workspacePath: string | null): Promise<void> {
    await invoke('rename_session', { sessionId, title, workMode, workspacePath });
  }

  async newSession(): Promise<string> {
    return await invoke('new_session');
  }

  async getCurrentSessionId(): Promise<string | null> {
    return await invoke('get_current_session_id');
  }

  async getWorkMode(): Promise<import('../../core/entities').WorkMode> {
    return await invoke('get_work_mode');
  }

  async setWorkMode(mode: import('../../core/entities').WorkMode, workspacePath?: string): Promise<void> {
    await invoke('set_work_mode', { mode, workspacePath: workspacePath || null });
  }

  async getWorkspacePath(): Promise<string | null> {
    return await invoke('get_workspace_path');
  }

  async setSelectedTools(tools: string[]): Promise<void> {
    await invoke('set_selected_tools', { tools });
  }
}

// TauriChatGateway - Adapter implementing IChatGateway
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { IChatGateway, UnsubscribeFn } from '../../core/gateways';
import { StreamEvent, PermissionRequest, Session } from '../../core/entities';

export class TauriChatGateway implements IChatGateway {
  async sendPrompt(text: string): Promise<void> {
    await invoke('send_prompt', { text });
  }

  async answerPermission(requestId: string, allow: boolean): Promise<void> {
    await invoke('answer_permission', { requestId, allow });
  }

  async loadSession(sessionId: string): Promise<void> {
    await invoke('load_session', { sessionId });
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

  async getModel(): Promise<string> {
    return await invoke('get_model');
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
}

// Chat State Machine - Strict FSM
import { PermissionRequest } from '../core/entities';

export type ChatMachineState =
  | { status: 'IDLE' }
  | { status: 'GENERATING' }
  | { status: 'TOOL_EXECUTING'; toolName: string; toolInput: string }
  | { status: 'AWAITING_PERMISSION'; request: PermissionRequest };

export type ChatEvent =
  | { type: 'USER_SENT_PROMPT'; text: string }
  | { type: 'STREAM_TEXT_DELTA'; delta: string }
  | { type: 'STREAM_TOOL_USE'; toolName: string; toolInput: string }
  | { type: 'STREAM_TOOL_RESULT' }
  | { type: 'PERMISSION_REQUESTED'; request: PermissionRequest }
  | { type: 'PERMISSION_ANSWERED'; allow: boolean }
  | { type: 'MESSAGE_STOP' }
  | { type: 'USER_CANCELLED' } // User explicitly cancelled (Stop button)
  | { type: 'ERROR'; message: string };

export function chatReducer(
  state: ChatMachineState,
  event: ChatEvent
): ChatMachineState {
  // USER_CANCELLED always goes to IDLE from any state
  if (event.type === 'USER_CANCELLED') {
    return { status: 'IDLE' };
  }
  
  switch (state.status) {
    case 'IDLE':
      if (event.type === 'USER_SENT_PROMPT') {
        return { status: 'GENERATING' };
      }
      // Bỏ qua an toàn các event sinh ra muộn/lệch pha thay vì crash app
      return state;

    case 'GENERATING':
      if (event.type === 'STREAM_TOOL_USE') {
        return {
          status: 'TOOL_EXECUTING',
          toolName: event.toolName,
          toolInput: event.toolInput,
        };
      }
      if (event.type === 'MESSAGE_STOP' || event.type === 'ERROR') {
        return { status: 'IDLE' };
      }
      // Text delta không thay đổi state
      return state;

    case 'TOOL_EXECUTING':
      if (event.type === 'PERMISSION_REQUESTED') {
        return { status: 'AWAITING_PERMISSION', request: event.request };
      }
      if (event.type === 'STREAM_TOOL_RESULT') {
        return { status: 'GENERATING' };
      }
      if (event.type === 'MESSAGE_STOP') {
        // BỎ QUA! Sự kiện stop stream của LLM trước khi tool chạy xong, không được phép chuyển về IDLE.
        return state;
      }
      if (event.type === 'ERROR') {
        return { status: 'IDLE' };
      }
      return state;

    case 'AWAITING_PERMISSION':
      if (event.type === 'PERMISSION_ANSWERED') {
        return { status: 'GENERATING' };
      }
      return state;

    default:
      return state;
  }
}

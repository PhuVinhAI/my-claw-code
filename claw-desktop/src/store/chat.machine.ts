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
  | { type: 'PERMISSION_REQUESTED'; request: PermissionRequest }
  | { type: 'PERMISSION_ANSWERED'; allow: boolean }
  | { type: 'MESSAGE_STOP' }
  | { type: 'ERROR'; message: string };

export function chatReducer(
  state: ChatMachineState,
  event: ChatEvent
): ChatMachineState {
  switch (state.status) {
    case 'IDLE':
      if (event.type === 'USER_SENT_PROMPT') {
        return { status: 'GENERATING' };
      }
      throw new Error(`Invalid transition: IDLE + ${event.type}`);

    case 'GENERATING':
      if (event.type === 'STREAM_TOOL_USE') {
        return {
          status: 'TOOL_EXECUTING',
          toolName: event.toolName,
          toolInput: event.toolInput,
        };
      }
      if (event.type === 'MESSAGE_STOP') {
        return { status: 'IDLE' };
      }
      if (event.type === 'ERROR') {
        return { status: 'IDLE' };
      }
      // Text delta không thay đổi state
      return state;

    case 'TOOL_EXECUTING':
      if (event.type === 'PERMISSION_REQUESTED') {
        return { status: 'AWAITING_PERMISSION', request: event.request };
      }
      if (event.type === 'MESSAGE_STOP') {
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

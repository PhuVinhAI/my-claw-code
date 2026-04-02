// Zustand Store với FSM
import { create } from 'zustand';
import { IChatGateway } from '../core/gateways';
import { Message, StreamEvent } from '../core/entities';
import { ChatMachineState, ChatEvent, chatReducer } from './chat.machine';
import { TauriChatGateway } from '../adapters/tauri';

interface ChatStore {
  // State
  state: ChatMachineState;
  messages: Message[];
  currentAssistantText: string;
  gateway: IChatGateway;

  // Actions
  dispatch: (event: ChatEvent) => void;
  sendPrompt: (text: string) => Promise<void>;
  answerPermission: (allow: boolean) => Promise<void>;
  
  // Internal
  appendTextDelta: (delta: string) => void;
  flushAssistantMessage: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  state: { status: 'IDLE' },
  messages: [],
  currentAssistantText: '',
  gateway: new TauriChatGateway(),

  dispatch: (event) => {
    set((prev) => ({
      state: chatReducer(prev.state, event),
    }));
  },

  sendPrompt: async (text) => {
    const { gateway, dispatch } = get();
    
    // Add user message
    set((prev) => ({
      messages: [
        ...prev.messages,
        {
          role: 'user',
          blocks: [{ type: 'text', text }],
        },
      ],
    }));

    dispatch({ type: 'USER_SENT_PROMPT', text });
    
    try {
      await gateway.sendPrompt(text);
    } catch (error) {
      dispatch({ type: 'ERROR', message: String(error) });
    }
  },

  answerPermission: async (allow) => {
    const { gateway, dispatch, state } = get();
    if (state.status !== 'AWAITING_PERMISSION') return;

    await gateway.answerPermission(state.request.request_id, allow);
    dispatch({ type: 'PERMISSION_ANSWERED', allow });
  },

  appendTextDelta: (delta) => {
    set((prev) => ({
      currentAssistantText: prev.currentAssistantText + delta,
    }));
  },

  flushAssistantMessage: () => {
    const { currentAssistantText } = get();
    if (!currentAssistantText) return;

    set((prev) => ({
      messages: [
        ...prev.messages,
        {
          role: 'assistant',
          blocks: [{ type: 'text', text: currentAssistantText }],
        },
      ],
      currentAssistantText: '',
    }));
  },
}));

// Initialize listeners
export function initializeChatStore() {
  const { gateway, dispatch, appendTextDelta, flushAssistantMessage } =
    useChatStore.getState();

  gateway.onStreamEvent((event: StreamEvent) => {
    switch (event.type) {
      case 'text_delta':
        appendTextDelta(event.delta);
        dispatch({ type: 'STREAM_TEXT_DELTA', delta: event.delta });
        break;
      case 'tool_use':
        // Flush current text before tool use
        flushAssistantMessage();
        // Add tool use block
        useChatStore.setState((prev) => ({
          messages: [
            ...prev.messages,
            {
              role: 'assistant',
              blocks: [
                {
                  type: 'tool_use',
                  id: event.id,
                  name: event.name,
                  input: event.input,
                },
              ],
            },
          ],
        }));
        dispatch({
          type: 'STREAM_TOOL_USE',
          toolName: event.name,
          toolInput: event.input,
        });
        break;
      case 'tool_result':
        // Add tool result block
        useChatStore.setState((prev) => ({
          messages: [
            ...prev.messages,
            {
              role: 'assistant',
              blocks: [
                {
                  type: 'tool_result',
                  tool_use_id: event.tool_use_id,
                  output: event.output,
                  is_error: event.is_error,
                },
              ],
            },
          ],
        }));
        break;
      case 'message_stop':
        flushAssistantMessage();
        dispatch({ type: 'MESSAGE_STOP' });
        break;
      case 'error':
        dispatch({ type: 'ERROR', message: event.message });
        break;
    }
  });

  gateway.onPermissionRequest((request) => {
    dispatch({ type: 'PERMISSION_REQUESTED', request });
  });
}

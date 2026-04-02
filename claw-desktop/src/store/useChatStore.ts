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
  model: string;

  // Actions
  dispatch: (event: ChatEvent) => void;
  sendPrompt: (text: string) => Promise<void>;
  answerPermission: (allow: boolean) => Promise<void>;
  stopGeneration: () => Promise<void>;
  fetchModel: () => Promise<void>;

  // Internal
  appendTextDelta: (delta: string) => void;
  flushAssistantMessage: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  state: { status: 'IDLE' },
  messages: [],
  currentAssistantText: '',
  gateway: new TauriChatGateway(),
  model: "Đang tải...",

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

  fetchModel: async () => {
    const { gateway } = get();
    try {
      const model = await gateway.getModel();
      set({ model });
    } catch (e) {
      console.error("Failed to load model from Rust:", e);
    }
  },

  stopGeneration: async () => {
    const { gateway, dispatch, flushAssistantMessage } = get();
    try {
      await gateway.cancelPrompt(); // Ra lệnh cho Rust ngừng chạy
    } catch (e) {
      console.error("Failed to cancel backend prompt:", e);
    }
    // Update local UI
    flushAssistantMessage();
    dispatch({ type: 'MESSAGE_STOP' });
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
  const store = useChatStore.getState();
  const { gateway, dispatch, appendTextDelta, flushAssistantMessage } = store;

  store.fetchModel();

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
        // Find the message with matching tool_use and add result to it
        useChatStore.setState((prev) => {
          const messages = [...prev.messages];

          // Find the message containing the tool_use with matching id
          for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message.role === 'assistant') {
              const toolUseBlock = message.blocks.find(
                (b) => b.type === 'tool_use' && b.id === event.tool_use_id
              );

              if (toolUseBlock && toolUseBlock.type === 'tool_use') {
                // Add tool_result block to the same message
                messages[i] = {
                  ...message,
                  blocks: [
                    ...message.blocks,
                    {
                      type: 'tool_result',
                      tool_use_id: event.tool_use_id,
                      tool_name: toolUseBlock.name, // Copy tool name from tool_use
                      output: event.output,
                      is_error: event.is_error,
                    },
                  ],
                };
                break;
              }
            }
          }

          return { messages };
        });
        dispatch({ type: 'STREAM_TOOL_RESULT' });
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

// Zustand Store với FSM
import { create } from 'zustand';
import { IChatGateway } from '../core/gateways';
import { Message, StreamEvent, SessionMetadata, WorkMode } from '../core/entities';
import { ChatMachineState, ChatEvent, chatReducer } from './chat.machine';
import { TauriChatGateway } from '../adapters/tauri';
import { parseThinkingTags } from '../lib/parseThinking';

interface ChatStore {
  // State
  state: ChatMachineState;
  messages: Message[];
  currentAssistantText: string;
  gateway: IChatGateway;
  detachedTools: Set<string>; // Track detached tool IDs

  // Session Management
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  isLoadingSessions: boolean;

  // Work Mode
  workMode: WorkMode;
  workspacePath: string | null;
  selectedTools: string[]; // Normal mode: user-selected tools
  recentWorkspaces: string[];

  // Actions
  dispatch: (event: ChatEvent) => void;
  sendPrompt: (text: string) => Promise<void>;
  answerPermission: (allow: boolean) => Promise<void>;
  stopGeneration: () => Promise<void>;
  sendToolInput: (toolUseId: string, input: string) => Promise<void>; // Send stdin to tool
  cancelToolExecution: (toolUseId: string) => Promise<void>; // Cancel specific tool execution
  detachToolExecution: (toolUseId: string) => Promise<void>; // Detach tool - let it run but return current output

  // Session Actions
  loadSessions: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  autoSaveCurrentSession: () => Promise<void>;

  // Work Mode Actions
  fetchWorkMode: () => Promise<void>;
  setWorkMode: (mode: WorkMode, workspacePath?: string) => Promise<void>;
  setSelectedTools: (tools: string[]) => Promise<void>; // Set selected tools for Normal mode
  addRecentWorkspace: (path: string) => void;

  // Internal
  appendTextDelta: (delta: string) => void;
  flushAssistantMessage: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  state: { status: 'IDLE' },
  messages: [],
  currentAssistantText: '',
  gateway: new TauriChatGateway(),
  detachedTools: new Set(),
  sessions: [],
  currentSessionId: null,
  isLoadingSessions: false,
  workMode: 'normal',
  workspacePath: null,
  selectedTools: JSON.parse(localStorage.getItem('claw_selected_tools') || '[]'), // Load từ localStorage
  recentWorkspaces: JSON.parse(localStorage.getItem('claw_recent_workspaces') || '[]'),

  addRecentWorkspace: (path: string) => {
    set((prev) => {
      const filtered = prev.recentWorkspaces.filter(p => p !== path);
      const updated = [path, ...filtered].slice(0, 5); // Giữ tối đa 5 lịch sử
      localStorage.setItem('claw_recent_workspaces', JSON.stringify(updated));
      return { recentWorkspaces: updated };
    });
  },

  dispatch: (event) => {
    set((prev) => ({
      state: chatReducer(prev.state, event),
    }));
  },

  sendPrompt: async (text) => {
    const { gateway, dispatch, currentSessionId } = get();

    console.log('[STORE] sendPrompt called with text:', text.substring(0, 50) + '...');

    // Create new session ONLY if none exists AND this is the first message
    if (!currentSessionId) {
      // Generate new session ID
      const newSessionId = await gateway.newSession();
      set({ currentSessionId: newSessionId });
      console.log('[STORE] Created new session on first message:', newSessionId);
    }

    // Add user message to UI
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
      console.log('[STORE] Calling gateway.sendPrompt...');
      await gateway.sendPrompt(text);
      console.log('[STORE] gateway.sendPrompt completed');
    } catch (error) {
      console.error('[STORE] Error sending prompt:', error);
      dispatch({ type: 'ERROR', message: String(error) });
    }
  },

  answerPermission: async (allow) => {
    const { gateway, dispatch, state } = get();
    if (state.status !== 'AWAITING_PERMISSION') return;

    await gateway.answerPermission(state.request.request_id, allow);
    dispatch({ type: 'PERMISSION_ANSWERED', allow });
  },

  stopGeneration: async () => {
    const { gateway, dispatch, flushAssistantMessage } = get();
    
    console.log('[STORE] stopGeneration called - updating UI first');
    
    // Update UI FIRST (immediate feedback) - use USER_CANCELLED to force IDLE
    flushAssistantMessage();
    dispatch({ type: 'USER_CANCELLED' });
    console.log('[STORE] UI state updated to IDLE');
    
    // Then cancel backend (kill all running tools)
    try {
      await gateway.cancelPrompt();
      console.log('[STORE] Backend cancelled successfully');
    } catch (e) {
      console.error("[STORE] Failed to cancel backend prompt:", e);
    }
  },

  sendToolInput: async (toolUseId: string, input: string) => {
    const { gateway } = get();
    try {
      await gateway.sendToolInput(toolUseId, input);
    } catch (e) {
      console.error("Failed to send tool input:", e);
    }
  },

  cancelToolExecution: async (toolUseId: string) => {
    const { gateway } = get();
    try {
      await gateway.cancelToolExecution(toolUseId);
    } catch (e) {
      console.error("Failed to cancel tool execution:", e);
    }
  },

  detachToolExecution: async (toolUseId: string) => {
    const { gateway } = get();
    try {
      await gateway.detachToolExecution(toolUseId);
      // Mark tool as detached
      set((prev) => ({
        detachedTools: new Set([...prev.detachedTools, toolUseId])
      }));
    } catch (e) {
      console.error("Failed to detach tool execution:", e);
    }
  },

  appendTextDelta: (delta) => {
    set((prev) => ({
      currentAssistantText: prev.currentAssistantText + delta,
    }));
  },

  flushAssistantMessage: () => {
    const { currentAssistantText } = get();
    if (!currentAssistantText) return;

    // Parse thinking tags from text
    const parsed = parseThinkingTags(currentAssistantText);

    // Convert parsed blocks to ContentBlocks
    const contentBlocks = parsed.blocks.map((block) => {
      if (block.type === 'thinking') {
        return {
          type: 'thinking' as const,
          thinking: block.content,
          id: `thinking-${Date.now()}-${Math.random()}`,
        };
      } else {
        return {
          type: 'text' as const,
          text: block.content,
        };
      }
    });

    // Only add message if there are blocks
    if (contentBlocks.length > 0) {
      set((prev) => ({
        messages: [
          ...prev.messages,
          {
            role: 'assistant',
            blocks: contentBlocks,
          },
        ],
        currentAssistantText: '',
      }));
    } else {
      set({ currentAssistantText: '' });
    }
  },

  // Session Management Actions
  loadSessions: async () => {
    const { gateway } = get();
    set({ isLoadingSessions: true });
    try {
      // Backend đã filter sessions theo mode hiện tại
      const sessions = await gateway.listSessions();
      set({ sessions, isLoadingSessions: false });
    } catch (error) {
      console.error('Failed to load sessions:', error);
      set({ isLoadingSessions: false });
    }
  },

  switchSession: async (sessionId: string) => {
    const { gateway, autoSaveCurrentSession, currentSessionId, sessions } = get();
    
    // Don't switch if already on this session
    if (currentSessionId === sessionId) return;
    
    try {
      // Auto-save current session before switching
      await autoSaveCurrentSession();

      // Find session metadata to get work context
      const sessionMeta = sessions.find(s => s.id === sessionId);
      const workMode = sessionMeta?.work_mode || 'normal';
      const workspacePath = sessionMeta?.workspace_path || null;

      // Load new session from backend with work context
      await gateway.loadSession(sessionId, workMode, workspacePath);
      
      // Get the loaded session
      const session = await gateway.getSession();

      console.log('[SWITCH SESSION] Loaded messages:', session.messages);
      console.log('[SWITCH SESSION] First assistant message modelName:', 
        session.messages.find(m => m.role === 'assistant')?.modelName);

      // Merge tool messages into assistant messages
      const mergedMessages: Message[] = [];
      for (let i = 0; i < session.messages.length; i++) {
        const msg = session.messages[i];
        
        if (msg.role === 'tool') {
          // Find the previous assistant message and merge tool_result into it
          const lastAssistant = mergedMessages[mergedMessages.length - 1];
          if (lastAssistant && lastAssistant.role === 'assistant') {
            lastAssistant.blocks.push(...msg.blocks);
          }
        } else if (msg.role === 'assistant') {
          // Parse thinking tags in text blocks
          const parsedBlocks: any[] = [];
          
          for (const block of msg.blocks) {
            if (block.type === 'text' && block.text) {
              const parsed = parseThinkingTags(block.text);
              for (const parsedBlock of parsed.blocks) {
                if (parsedBlock.type === 'thinking') {
                  parsedBlocks.push({
                    type: 'thinking',
                    thinking: parsedBlock.content,
                    id: `thinking-${Date.now()}-${Math.random()}`,
                  });
                } else {
                  parsedBlocks.push({
                    type: 'text',
                    text: parsedBlock.content,
                  });
                }
              }
            } else {
              parsedBlocks.push(block);
            }
          }
          
          // Map model_name (snake_case from backend) to modelName (camelCase for frontend)
          const modelName = (msg as any).model_name || msg.modelName;
          mergedMessages.push({ ...msg, blocks: parsedBlocks, modelName });
        } else {
          mergedMessages.push({ ...msg });
        }
      }

      console.log('[SWITCH SESSION] Merged messages:', mergedMessages);

      // Convert session messages to UI format and update state
      set({
        messages: mergedMessages,
        currentSessionId: sessionId,
        currentAssistantText: '',
        state: { status: 'IDLE' },
      });
    } catch (error) {
      console.error('Failed to switch session:', error);
      alert(`Không thể chuyển session: ${error}`);
    }
  },

  createNewSession: async () => {
    const { gateway, autoSaveCurrentSession, loadSessions } = get();
    try {
      // Auto-save current session
      await autoSaveCurrentSession();

      // Create new session on backend (this will replace runtime session)
      const newSessionId = await gateway.newSession();

      // Clear UI messages and set new session ID
      set({
        messages: [],
        currentSessionId: newSessionId,
        currentAssistantText: '',
        state: { status: 'IDLE' },
      });

      // Reload sessions list immediately
      await loadSessions();
    } catch (error) {
      console.error('Failed to create new session:', error);
      alert(`Không thể tạo session mới: ${error}`);
    }
  },

  deleteSession: async (sessionId: string) => {
    const { gateway, currentSessionId, loadSessions, sessions } = get();
    try {
      // Find session metadata to get work context
      const sessionMeta = sessions.find(s => s.id === sessionId);
      const workMode = sessionMeta?.work_mode || 'normal';
      const workspacePath = sessionMeta?.workspace_path || null;

      await gateway.deleteSession(sessionId, workMode, workspacePath);

      // If deleted current session, clear UI (không tạo session mới)
      if (currentSessionId === sessionId) {
        set({
          currentSessionId: null,
          messages: [],
          currentAssistantText: '',
          state: { status: 'IDLE' },
        });
      }
      
      // Reload sessions list
      await loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  },

  renameSession: async (sessionId: string, title: string) => {
    const { gateway, loadSessions, sessions } = get();
    try {
      // Find session metadata to get work context
      const sessionMeta = sessions.find(s => s.id === sessionId);
      const workMode = sessionMeta?.work_mode || 'normal';
      const workspacePath = sessionMeta?.workspace_path || null;

      await gateway.renameSession(sessionId, title, workMode, workspacePath);
      await loadSessions();
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  },

  autoSaveCurrentSession: async () => {
    const { gateway, currentSessionId, messages } = get();
    if (!currentSessionId || messages.length === 0) return;

    try {
      await gateway.saveSession(currentSessionId);
    } catch (error) {
      console.error('Failed to auto-save session:', error);
    }
  },

  fetchWorkMode: async () => {
    const { gateway } = get();
    try {
      const mode = await gateway.getWorkMode();
      const path = await gateway.getWorkspacePath();
      set({ workMode: mode, workspacePath: path });
    } catch (e) {
      console.error("Failed to load work mode:", e);
    }
  },

  setWorkMode: async (mode: WorkMode, workspacePath?: string) => {
    const { gateway, loadSessions, addRecentWorkspace } = get();
    try {
      await gateway.setWorkMode(mode, workspacePath);
      const path = await gateway.getWorkspacePath();
      
      if (mode === 'workspace' && path) {
        addRecentWorkspace(path);
      }

      set({ 
        workMode: mode, 
        workspacePath: path,
        // Clear current session - sẽ tạo mới khi user gửi tin nhắn đầu tiên
        currentSessionId: null,
        messages: [],
        currentAssistantText: '',
        state: { status: 'IDLE' },
      });
      
      // Reload sessions to show only sessions for this mode
      await loadSessions();
      
      // KHÔNG tạo session mới - đợi user gửi tin nhắn đầu tiên
    } catch (e) {
      console.error("Failed to set work mode:", e);
      alert(`Không thể chuyển chế độ: ${e}`);
    }
  },

  setSelectedTools: async (tools: string[]) => {
    const { gateway } = get();
    try {
      await gateway.setSelectedTools(tools);
      set({ selectedTools: tools });
      // Persist to localStorage
      localStorage.setItem('claw_selected_tools', JSON.stringify(tools));
      console.log('[STORE] Selected tools updated:', tools);
    } catch (e) {
      console.error("Failed to set selected tools:", e);
      alert(`Không thể cập nhật tools: ${e}`);
    }
  },
}));

// Initialize listeners
export function initializeChatStore() {
  const store = useChatStore.getState();
  const { gateway, dispatch, appendTextDelta, flushAssistantMessage, autoSaveCurrentSession, loadSessions } = store;

  store.fetchWorkMode(); // Fetch work mode on init
  loadSessions(); // Load sessions on init

  gateway.onStreamEvent((event: StreamEvent) => {
    console.log('[STORE] Received stream event:', event.type);
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
                // Check if tool_result already exists (from streaming)
                const existingResultIdx = message.blocks.findIndex(
                  (b) => b.type === 'tool_result' && b.tool_use_id === event.tool_use_id
                );

                if (existingResultIdx !== -1) {
                  // Update existing result - mark as complete
                  message.blocks[existingResultIdx] = {
                    type: 'tool_result',
                    tool_use_id: event.tool_use_id,
                    tool_name: toolUseBlock.name,
                    output: event.output, // Use final output from backend
                    is_error: event.is_error,
                    is_cancelled: event.is_cancelled,
                    is_timed_out: event.is_timed_out,
                    isStreaming: false, // Mark as complete
                  };
                } else {
                  // Add new tool_result block
                  messages[i] = {
                    ...message,
                    blocks: [
                      ...message.blocks,
                      {
                        type: 'tool_result',
                        tool_use_id: event.tool_use_id,
                        tool_name: toolUseBlock.name,
                        output: event.output,
                        is_error: event.is_error,
                        is_cancelled: event.is_cancelled,
                        is_timed_out: event.is_timed_out,
                        isStreaming: false,
                      },
                    ],
                  };
                }
                
                // If this was a detached tool that completed, remove from detached set
                if (prev.detachedTools.has(event.tool_use_id) && !event.is_error && !event.is_cancelled && !event.is_timed_out) {
                  const newDetachedTools = new Set(prev.detachedTools);
                  newDetachedTools.delete(event.tool_use_id);
                  
                  console.log('[STORE] Detached tool completed successfully:', event.tool_use_id);
                  
                  return { messages, detachedTools: newDetachedTools };
                }
                
                break;
              }
            }
          }

          return { messages };
        });
        dispatch({ type: 'STREAM_TOOL_RESULT' });
        break;
      case 'tool_output_chunk':
        // Append chunk to existing tool_result or create new one
        useChatStore.setState((prev) => {
          const messages = [...prev.messages];

          // Find the message containing the tool_use with matching id
          for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message.role === 'assistant') {
              const toolUseIdx = message.blocks.findIndex(
                (b) => b.type === 'tool_use' && b.id === event.tool_use_id
              );

              if (toolUseIdx !== -1) {
                const toolUseBlock = message.blocks[toolUseIdx];
                if (toolUseBlock.type === 'tool_use') {
                  // Find existing tool_result or create new one
                  const toolResultIdx = message.blocks.findIndex(
                    (b) => b.type === 'tool_result' && b.tool_use_id === event.tool_use_id
                  );

                  // Filter out internal markers
                  const cleanChunk = event.chunk.replace(/\[WAITING_FOR_INPUT\]/g, '');

                  if (toolResultIdx !== -1) {
                    // Append to existing output
                    const toolResultBlock = message.blocks[toolResultIdx];
                    if (toolResultBlock.type === 'tool_result') {
                      message.blocks[toolResultIdx] = {
                        ...toolResultBlock,
                        output: (toolResultBlock.output || '') + cleanChunk,
                        isStreaming: true, // Mark as streaming
                      };
                    }
                  } else {
                    // Create new tool_result block with chunk
                    message.blocks.push({
                      type: 'tool_result',
                      tool_use_id: event.tool_use_id,
                      tool_name: toolUseBlock.name,
                      output: cleanChunk,
                      is_error: false,
                      isStreaming: true, // Mark as streaming
                    });
                  }

                  messages[i] = { ...message };
                  break;
                }
              }
            }
          }

          return { messages };
        });
        break;
      case 'message_stop':
        // Flush và chuyển về IDLE (nếu chưa)
        const currentState = useChatStore.getState().state;
        if (currentState.status !== 'IDLE') {
          flushAssistantMessage();
          dispatch({ type: 'MESSAGE_STOP' });
        }
        // Auto-save after message completes
        autoSaveCurrentSession().then(async () => {
          // Reload session from backend to get full message with modelName
          try {
            const session = await gateway.getSession();
            const lastMessage = session.messages[session.messages.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant') {
              // Update last assistant message with full data from backend
              useChatStore.setState((prev) => {
                const messages = [...prev.messages];
                // Find last assistant message and update it
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i].role === 'assistant') {
                    // Backend uses snake_case (model_name), frontend uses camelCase (modelName)
                    messages[i] = { ...messages[i], modelName: (lastMessage as any).model_name || lastMessage.modelName };
                    break;
                  }
                }
                return { messages };
              });
            }
          } catch (e) {
            console.error('[STORE] Failed to reload session after message_stop:', e);
          }
          
          // Reload sessions list to show updated session
          loadSessions();
        });
        break;
      case 'system_message':
        // System message chỉ inject vào session (không render trong UI)
        // AI sẽ nhận được thông báo này trong turn tiếp theo
        console.log('[SYSTEM]', event.message);
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

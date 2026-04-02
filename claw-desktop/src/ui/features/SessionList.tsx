// SessionList - Sidebar với danh sách sessions
import { useChatStore } from '../../store/useChatStore';
import { SessionItem } from './SessionItem';
import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { PlusIcon } from 'lucide-react';

export function SessionList() {
  const { sessions, currentSessionId, isLoadingSessions, createNewSession } = useChatStore();

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <Button
          onClick={createNewSession}
          className="w-full"
          variant="default"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Hội thoại mới
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        {isLoadingSessions ? (
          <div className="p-4 text-center text-gray-500">Đang tải...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>Chưa có hội thoại nào</p>
            <p className="text-sm mt-2">Bắt đầu chat mới để bắt đầu</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

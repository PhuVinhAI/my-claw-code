// PermissionModal Component
import { useChatStore } from '../../store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

export function PermissionModal() {
  const { state, answerPermission } = useChatStore();

  if (state.status !== 'AWAITING_PERMISSION') return null;

  const { request } = state;

  return (
    <Dialog open={true}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permission Required</DialogTitle>
          <DialogDescription>
            Tool "{request.tool_name}" requires permission to execute.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Current mode: {request.current_mode}
          </p>
          <p className="text-sm text-muted-foreground">
            Required mode: {request.required_mode}
          </p>
          <div className="mt-4 p-3 bg-muted rounded-md">
            <pre className="text-xs overflow-auto max-h-40">
              {request.input}
            </pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => answerPermission(false)}>
            Deny
          </Button>
          <Button onClick={() => answerPermission(true)}>Allow</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Permission Request Types
export interface PermissionRequest {
  request_id: string;
  tool_name: string;
  input: string;
  current_mode: string;
  required_mode: string;
}

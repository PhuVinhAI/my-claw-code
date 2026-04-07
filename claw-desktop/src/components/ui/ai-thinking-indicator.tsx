import { cn } from "../../lib/utils";

interface AiThinkingIndicatorProps {
  className?: string;
}

export function AiThinkingIndicator({ className }: AiThinkingIndicatorProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn("w-4 h-4 shrink-0 text-foreground", className)}
      fill="currentColor"
    >
      {/* Khối lượng tử (Quantum Grid) - 4 khối vuông 2x2.
          Sử dụng animate opacity theo kiểu domino (sequential) 
          tạo cảm giác dữ liệu đang được xử lý luân phiên. */}
      
      {/* Top Left */}
      <rect x="4" y="4" width="6" height="6" rx="1">
        <animate
          attributeName="opacity"
          values="1; 0.2; 1"
          keyTimes="0; 0.2; 1"
          dur="1.2s"
          begin="0s"
          repeatCount="indefinite"
        />
      </rect>

      {/* Top Right */}
      <rect x="14" y="4" width="6" height="6" rx="1">
        <animate
          attributeName="opacity"
          values="1; 0.2; 1"
          keyTimes="0; 0.2; 1"
          dur="1.2s"
          begin="0.3s"
          repeatCount="indefinite"
        />
      </rect>

      {/* Bottom Right */}
      <rect x="14" y="14" width="6" height="6" rx="1">
        <animate
          attributeName="opacity"
          values="1; 0.2; 1"
          keyTimes="0; 0.2; 1"
          dur="1.2s"
          begin="0.6s"
          repeatCount="indefinite"
        />
      </rect>

      {/* Bottom Left */}
      <rect x="4" y="14" width="6" height="6" rx="1">
        <animate
          attributeName="opacity"
          values="1; 0.2; 1"
          keyTimes="0; 0.2; 1"
          dur="1.2s"
          begin="0.9s"
          repeatCount="indefinite"
        />
      </rect>
    </svg>
  );
}

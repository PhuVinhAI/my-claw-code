import { useMemo, useCallback } from 'react';
import { prepare, layout, type PreparedText } from '@chenglou/pretext';

interface TextMeasurementOptions {
  font?: string;
  whiteSpace?: 'normal' | 'pre-wrap';
}

interface MeasurementResult {
  height: number;
  lineCount: number;
}

/**
 * Hook để measure text height mà không cần DOM measurements
 * Sử dụng Pretext để tránh layout reflow
 */
export function useTextMeasurement(options: TextMeasurementOptions = {}) {
  const { font = '16px Inter', whiteSpace = 'normal' } = options;

  // Cache prepared text để tránh re-prepare khi không cần
  const prepareText = useCallback(
    (text: string): PreparedText => {
      return prepare(text, font, { whiteSpace });
    },
    [font, whiteSpace]
  );

  // Measure text height với width và lineHeight cho trước
  const measureText = useCallback(
    (text: string, maxWidth: number, lineHeight: number): MeasurementResult => {
      const prepared = prepareText(text);
      return layout(prepared, maxWidth, lineHeight);
    },
    [prepareText]
  );

  // Batch measure nhiều texts cùng lúc
  const measureBatch = useCallback(
    (
      texts: string[],
      maxWidth: number,
      lineHeight: number
    ): MeasurementResult[] => {
      return texts.map((text) => measureText(text, maxWidth, lineHeight));
    },
    [measureText]
  );

  return {
    prepareText,
    measureText,
    measureBatch,
  };
}

/**
 * Hook để pre-calculate message heights cho virtualization
 */
export function useMessageHeights(
  messages: Array<{ text: string }>,
  containerWidth: number,
  options: TextMeasurementOptions = {}
) {
  const { measureBatch } = useTextMeasurement(options);

  const heights = useMemo(() => {
    if (!containerWidth) return [];

    const lineHeight = 28.8; // 1.8 * 16px base font
    const texts = messages.map((m) => m.text);

    return measureBatch(texts, containerWidth, lineHeight);
  }, [messages, containerWidth, measureBatch]);

  return heights;
}

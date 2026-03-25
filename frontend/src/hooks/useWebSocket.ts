import { useEffect, useRef, useCallback } from 'react';

type MessageHandler = (data: unknown) => void;

export function useWebSocket(
  url: string | null,
  onMessage: MessageHandler,
  onOpen?: () => void,
  onClose?: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => onOpen?.();
    ws.onclose = () => {
      wsRef.current = null;
      onClose?.();
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        onMessageRef.current(JSON.parse(e.data));
      } catch {
      }
    };

    return () => ws.close();
  }, [url]);

  const send = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send };
}

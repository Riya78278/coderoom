type MinimalIOServer = {
  to: (room: string) => {
    emit: (event: string, payload: unknown) => boolean;
  };
};

/**
 * Emit a Socket.IO event to every socket in a room from inside a Next route
 * handler. Works because server.mjs (the same process) exposes its Socket.IO
 * server as a global. Returns false when unavailable (e.g. serverless).
 */
export function emitToRoom(
  roomId: string,
  event: string,
  payload: unknown
): boolean {
  const io = (
    globalThis as {
      __coderoomIO?: MinimalIOServer;
    }
  ).__coderoomIO;
  if (!io?.to) return false;
  try {
    return Boolean(io.to(roomId).emit(event, payload));
  } catch (error) {
    console.error(`[realtime-emit] ${event} failed:`, error);
    return false;
  }
}

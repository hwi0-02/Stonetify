const listeners = new Map();

export const subscribe = (event, callback) => {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }

  const callbacks = listeners.get(event);
  callbacks.add(callback);

  return () => {
    callbacks.delete(callback);
    if (!callbacks.size) {
      listeners.delete(event);
    }
  };
};

export const emit = (event, payload) => {
  const callbacks = listeners.get(event);
  if (!callbacks) return;

  callbacks.forEach((callback) => {
    try {
      callback(payload);
    } catch (error) {
      console.warn(`[eventBus] listener error for "${event}":`, error);
    }
  });
};
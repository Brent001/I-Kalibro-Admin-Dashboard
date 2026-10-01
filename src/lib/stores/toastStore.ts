import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
}

function createToastStore() {
  const { subscribe, update } = writable<ToastMessage[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let nextId = 0;

  function dismiss(id: string) {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    update((items) => items.filter((item) => item.id !== id));
  }

  function show(message: string, type: ToastType = 'info', duration = 4500, title?: string) {
    const toast: ToastMessage = {
      id: `${Date.now()}-${++nextId}`,
      message,
      type,
      title
    };
    let evicted: ToastMessage | undefined;

    update((items) => {
      const next = [...items, toast];
      if (next.length > 4) evicted = next.shift();
      return next;
    });

    if (evicted) {
      const timer = timers.get(evicted.id);
      if (timer) clearTimeout(timer);
      timers.delete(evicted.id);
    }

    if (duration > 0) {
      timers.set(toast.id, setTimeout(() => dismiss(toast.id), duration));
    }

    return toast.id;
  }

  return {
    subscribe,
    show,
    success: (message: string, duration?: number, title?: string) => show(message, 'success', duration, title),
    error: (message: string, duration?: number, title?: string) => show(message, 'error', duration, title),
    warning: (message: string, duration?: number, title?: string) => show(message, 'warning', duration, title),
    info: (message: string, duration?: number, title?: string) => show(message, 'info', duration, title),
    dismiss,
    clear: () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      update(() => []);
    }
  };
}

export const toast = createToastStore();

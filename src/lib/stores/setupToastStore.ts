import { writable } from 'svelte/store';

function createSetupToastStore() {
  const { subscribe, set } = writable<string | null>(null);
  let timeout: ReturnType<typeof setTimeout>;

  return {
    subscribe,
    show: (message: string) => {
      clearTimeout(timeout);
      set(message);
      timeout = setTimeout(() => set(null), 6000);
    },
    dismiss: () => {
      clearTimeout(timeout);
      set(null);
    }
  };
}

export const setupToast = createSetupToastStore();
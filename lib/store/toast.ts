import { create } from "zustand";

export type Toast = {
  id: number;
  title: string;
  description?: string;
  tone?: "default" | "error";
  action?: { label: string; onClick: () => void };
};

type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    // Keep the stack short: three is plenty on a phone.
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(t: Omit<Toast, "id">) {
  return useToastStore.getState().push(t);
}

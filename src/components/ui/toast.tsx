"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tone = "ok" | "error";
interface ToastItem { id: number; msg: string; tone: Tone }
interface ToastApi { show: (msg: string, tone?: Tone) => void }

const Ctx = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((msg: string, tone: Tone = "ok") => {
    const id = nextId++;
    setItems((p) => [...p, { id, msg, tone }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 2500);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-2 text-sm text-white shadow-lift ${t.tone === "error" ? "bg-red-600" : "bg-sage-600"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(Ctx) ?? { show: () => {} };
}

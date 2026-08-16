"use client";

import { useEffect } from "react";

const DISMISS_AFTER_MS = 2000;

export function CopiedDrawer({
  url,
  onDismiss,
}: {
  url: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="quiz-drawer-in pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-xl shadow-emerald-100">
        <span className="text-lg" aria-hidden>
          ✅
        </span>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Copied link</p>
          <p className="max-w-[60vw] truncate text-xs text-zinc-500">{url}</p>
        </div>
      </div>
    </div>
  );
}

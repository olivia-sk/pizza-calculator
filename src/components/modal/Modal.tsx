"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay fixed inset-0 z-40 bg-[var(--scrim)] backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            // Centred at every breakpoint. Positioning is left/top only; the
            // -50% translate lives in .modal-sheet so it cannot fight the
            // pop animation's own transform.
            "modal-sheet fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-md",
            "flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl focus:outline-none",
            "border border-border"
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="font-display text-base font-bold text-text">
              {title}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {description ?? `${title} settings`}
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl text-text-muted",
                  "transition-[background-color,transform] duration-150 ease-out",
                  "hover:bg-surface-sunken hover:text-text active:scale-[0.96]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                )}
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-border bg-surface px-5 pt-4 safe-bottom">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

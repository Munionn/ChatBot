"use client";

import { useCallback, useRef, type ClipboardEvent } from "react";
import { FileText, ImagePlus, RotateCcw, Send } from "lucide-react";

import type { ChatModelOption } from "@/lib/chat/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type LocalImagePreview = { id: string; url: string; name: string; file: File };
export type LocalDocPreview = { id: string; name: string; file: File };

type ChatComposerBarProps = {
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onRetry?: () => void;
  disabled: boolean;
  sending: boolean;
  blocked: boolean;
  error: boolean;
  chatModels: ChatModelOption[];
  selectedModelId: string | null;
  onModelChange: (id: string | null) => void;
  imagePreviews: LocalImagePreview[];
  docPreviews: LocalDocPreview[];
  onRemoveImage: (id: string) => void;
  onRemoveDoc: (id: string) => void;
  onPickImages: (files: FileList | null) => void;
  onPickDocs: (files: FileList | null) => void;
};

export function ChatComposerBar({
  input,
  onInputChange,
  onSend,
  onRetry,
  disabled,
  sending,
  blocked,
  error,
  chatModels,
  selectedModelId,
  onModelChange,
  imagePreviews,
  docPreviews,
  onRemoveImage,
  onRemoveDoc,
  onPickImages,
  onPickDocs
}: ChatComposerBarProps) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      onPickImages(dt.files);
    },
    [onPickImages]
  );

  const canSend =
    (input.trim().length > 0 ||
      imagePreviews.length > 0 ||
      docPreviews.length > 0) &&
    !disabled &&
    !sending &&
    !blocked;

  return (
    <div className="border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {(imagePreviews.length > 0 || docPreviews.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {imagePreviews.map((img) => (
              <div
                key={img.id}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- blob: object URLs */}
                <img
                  src={img.url}
                  alt={img.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  className="absolute top-0.5 right-0.5 rounded bg-black/60 px-1 text-xs text-white"
                  onClick={() => onRemoveImage(img.id)}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
            {docPreviews.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="max-w-[140px] truncate">{d.name}</span>
                <button
                  type="button"
                  className="text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                  onClick={() => onRemoveDoc(d.id)}
                  aria-label="Remove file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onPickImages(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={docInputRef}
            type="file"
            accept=".txt,.md,.pdf,application/pdf,text/plain,text/markdown"
            multiple
            className="hidden"
            onChange={(e) => {
              onPickDocs(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled || sending}
            aria-label="Attach images"
            onClick={() => imgInputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled || sending}
            aria-label="Attach documents"
            onClick={() => docInputRef.current?.click()}
          >
            <FileText className="size-4" />
          </Button>

          {chatModels.length > 0 ? (
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              value={selectedModelId ?? ""}
              onChange={(e) => onModelChange(e.target.value || null)}
              disabled={disabled || sending}
              aria-label="Model"
            >
              {chatModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : null}

          <Textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            placeholder="Message… (Enter to send; images/docs can be sent without text)"
            className="min-h-[44px] flex-1 resize-none"
            disabled={disabled || sending || blocked}
            rows={2}
          />

          {error && onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Retry"
              onClick={onRetry}
            >
              <RotateCcw className="size-4" />
            </Button>
          ) : null}

          <Button
            type="button"
            size="icon"
            disabled={!canSend}
            aria-label="Send"
            onClick={() => onSend()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

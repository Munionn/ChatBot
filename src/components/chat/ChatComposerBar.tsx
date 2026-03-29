"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent
} from "react";
import { FileText, Image as ImageIcon, ImagePlus, RotateCcw, Send } from "lucide-react";

import type { ChatModelOption } from "@/lib/types/chat-models";
import type { LocalDocPreview, LocalImagePreview } from "@/lib/types/chat-ui";
import { Button } from "@/components/ui/button";
import { CHAT_IMAGE_MAX_PER_MESSAGE } from "@/lib/constants/chat-images";
import { DOCUMENT_MAX_PER_MESSAGE } from "@/lib/constants/documents";
import { Textarea } from "@/components/ui/textarea";

export type { LocalDocPreview, LocalImagePreview };

function ImageAttachmentPreview({
  img,
  onRemove
}: {
  img: LocalImagePreview;
  onRemove: () => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);

  return (
    <div className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-900">
        {!thumbFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: preview
          <img
            src={img.url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <ImageIcon className="size-5 text-slate-400" aria-hidden />
        )}
      </div>
      <ImageIcon className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={img.name}>
        {img.name || "Image"}
      </span>
      <button
        type="button"
        className="shrink-0 text-slate-500 hover:text-red-600 dark:hover:text-red-400"
        onClick={onRemove}
        aria-label="Remove image"
      >
        ×
      </button>
    </div>
  );
}

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
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

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
    <div className="shrink-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {(imagePreviews.length > 0 || docPreviews.length > 0) && (
          <div className="flex min-h-[4.5rem] flex-wrap gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/90 p-2 dark:border-slate-600 dark:bg-slate-900/60">
            {imagePreviews.map((img) => (
              <ImageAttachmentPreview
                key={img.id}
                img={img}
                onRemove={() => onRemoveImage(img.id)}
              />
            ))}
            {docPreviews.map((d) => (
              <div
                key={d.id}
                className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <FileText className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="min-w-0 flex-1 truncate" title={d.name}>
                  {d.name}
                </span>
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

          {clientMounted && chatModels.length > 0 ? (
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

        {clientMounted ? (
          <div className="text-center text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Multiple files: use Ctrl/Cmd or Shift in the file dialog. Up to{" "}
            {CHAT_IMAGE_MAX_PER_MESSAGE} images and {DOCUMENT_MAX_PER_MESSAGE}{" "}
            documents per message.
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { EVENT } from "@/lib/brand";
import { downloadBlob } from "@/lib/browser";

type Props = {
  getBlob: () => Promise<Blob>;
  fileName: string;
  name: string;
  builderTitle: string;
  mode: "card" | "pfp";
};

/** Caption is built here so #FrameInGoa can never be dropped by a caller. */
export function buildCaption(mode: "card" | "pfp", builderTitle: string) {
  const line =
    mode === "card"
      ? `Just generated my Hacker House Goa 2026 Builder ID — "${builderTitle}" 🌴`
      : `Framed up for Hacker House Goa 2026 🌴`;
  return `${line}\n\n247 builders. Goa, India. ${EVENT.dates}.\nMake yours 👇\n\n${EVENT.hashtag}`;
}

const INTENT = "https://twitter.com/intent/tweet";

export default function ShareBar({ getBlob, fileName, name, builderTitle, mode }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await getBlob();
      const file = new File([blob], fileName, { type: "image/png" });
      const caption = buildCaption(mode, builderTitle);

      // 1. Native share sheet — attaches the real image, which is what X wants.
      //    This is the path most phones will take.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: caption });
          setStatus("Shared — make sure #FrameInGoa is in your post.");
          return;
        } catch (e) {
          // AbortError = user backed out; anything else falls through to the link path.
          if ((e as Error).name === "AbortError") return;
        }
      }

      // 2. Otherwise host the PNG and share a link whose OG preview *is* the graphic.
      const form = new FormData();
      form.append("file", file);
      form.append("name", name);
      form.append("title", builderTitle);
      form.append("mode", mode);

      const res = await fetch("/api/share", { method: "POST", body: form });
      const payload = res.ok
        ? ((await res.json()) as { url?: string; configured?: boolean })
        : null;
      if (payload?.url) {
        openIntent(caption, payload.url);
        setStatus("Opening X with your card attached as a link preview.");
        return;
      }

      // 3. Last resort: hand the user the file and a pre-filled tweet to attach it to.
      downloadBlob(blob, fileName);
      openIntent(caption, window.location.origin);
      setStatus("Image downloaded — attach it to the tweet we just opened.");
    } catch {
      setStatus("Couldn't open the share sheet. Try Download, then post it manually.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--cream)] px-5 py-3 text-sm font-bold tracking-wide text-[var(--ink)] transition hover:brightness-95 disabled:opacity-60"
      >
        <XLogo />
        {busy ? "Preparing…" : `Share to X with ${EVENT.hashtag}`}
      </button>
      {status && (
        <p role="status" className="mt-2 text-center text-xs text-[var(--cream)]/60">
          {status}
        </p>
      )}
    </div>
  );
}

function openIntent(text: string, url: string) {
  const intent = `${INTENT}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(intent, "_blank", "noopener,noreferrer");
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
      <path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-6.4L6.2 22H3l7.3-8.3L2 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
    </svg>
  );
}

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

function intentUrl(text: string, url: string) {
  return `${INTENT}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/** A File is needed to ask whether the native share sheet can take one. */
function canShareFiles() {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export default function ShareBar({ getBlob, fileName, name, builderTitle, mode }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set when the browser blocked the tab, so the user still has a way through. */
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const share = async () => {
    setBusy(true);
    setStatus(null);
    setManualUrl(null);

    const native = canShareFiles();
    // The tab MUST be opened here, synchronously inside the click. Open it after
    // awaiting the render and upload and the browser no longer counts it as a
    // user action, so it is silently blocked as a popup.
    // No "noopener" here: that feature makes window.open return null by spec,
    // which would throw away the very handle we need to navigate this tab once
    // the upload finishes. The opener is severed after navigating instead.
    const tab = native ? null : window.open("", "_blank");

    try {
      const blob = await getBlob();
      const file = new File([blob], fileName, { type: "image/png" });
      const caption = buildCaption(mode, builderTitle);

      // 1. Native share sheet — hands X the real image. Most phones take this.
      if (native) {
        try {
          await navigator.share({ files: [file], text: caption });
          setStatus("Shared — check #FrameInGoa is still in your post.");
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          // Anything else: fall through to the link path below.
        }
      }

      // 2. Host the PNG so the link's preview *is* the graphic.
      const form = new FormData();
      form.append("file", file);
      form.append("name", name);
      form.append("title", builderTitle);
      form.append("mode", mode);

      let shareUrl = window.location.origin;
      try {
        const res = await fetch("/api/share", { method: "POST", body: form });
        const payload = res.ok
          ? ((await res.json()) as { url?: string })
          : null;
        if (payload?.url) shareUrl = payload.url;
      } catch {
        // Offline or storage down — still worth opening the composer.
      }

      const url = intentUrl(caption, shareUrl);

      // Also save the PNG, so the post can be an image post if they'd rather
      // attach it than rely on the link preview.
      downloadBlob(blob, fileName);

      if (tab && !tab.closed) {
        tab.location.href = url;
        try {
          tab.opener = null;
        } catch {
          // Cross-origin once navigated; nothing to do.
        }
        setStatus("X is open with your caption ready. The PNG is in your downloads if you'd rather attach it.");
      } else {
        // Popup blocked: give them a real link to click instead of failing.
        setManualUrl(url);
        setStatus("Your browser blocked the new tab — tap below to open X.");
      }
    } catch {
      tab?.close();
      setStatus("Something went wrong. Use Download, then post it manually with #FrameInGoa.");
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
        {busy ? "Preparing your post…" : `Share to X with ${EVENT.hashtag}`}
      </button>

      {manualUrl && (
        <a
          href={manualUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--pink)] px-5 py-3 text-sm font-bold tracking-wide text-white transition hover:brightness-110"
        >
          <XLogo />
          Open X with your post
        </a>
      )}

      {status && (
        <p role="status" className="mt-2 text-center text-xs text-[var(--cream)]/60">
          {status}
        </p>
      )}
    </div>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
      <path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-6.4L6.2 22H3l7.3-8.3L2 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
    </svg>
  );
}

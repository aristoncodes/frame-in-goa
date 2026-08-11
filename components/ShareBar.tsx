"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function intentUrl(text: string, url?: string | null) {
  const q = new URLSearchParams({ text });
  if (url) q.set("url", url);
  return `${INTENT}?${q}`;
}

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

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens a panel with the post laid out ready to use rather than trying to drive
 * the browser for the user.
 *
 * Auto-opening a tab is unreliable: browsers block it whenever the click's
 * activation has been spent, and there is no way to detect that having happened.
 * Here every action is a direct click on a real control — copy the caption, open
 * X, save the image — so nothing depends on the browser cooperating.
 */
export default function ShareBar({ getBlob, fileName, name, builderTitle, mode }: Props) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [copied, setCopied] = useState<"caption" | "link" | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const start = useCallback(async () => {
    setOpen(true);
    setPreparing(true);
    setCopied(null);
    setShareUrl(null);
    setBlob(null);
    setCaption(buildCaption(mode, builderTitle));

    try {
      const png = await getBlob();
      setBlob(png);

      const form = new FormData();
      form.append("file", new File([png], fileName, { type: "image/png" }));
      form.append("name", name);
      form.append("title", builderTitle);
      form.append("mode", mode);
      const res = await fetch("/api/share", { method: "POST", body: form });
      const payload = res.ok ? ((await res.json()) as { url?: string }) : null;
      if (payload?.url) setShareUrl(payload.url);
    } catch {
      // The panel is still useful without a hosted link.
    } finally {
      setPreparing(false);
    }
  }, [getBlob, fileName, name, builderTitle, mode]);

  useEffect(() => {
    if (!open) return;
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const href = intentUrl(caption, shareUrl);
  const missingTag = !caption.includes(EVENT.hashtag);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={start}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--cream)] px-5 py-3 text-sm font-bold tracking-wide text-[var(--ink)] transition hover:brightness-95"
      >
        <XLogo />
        {`Share to X with ${EVENT.hashtag}`}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Your post"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--cream)]/15 bg-[var(--green-deep)] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl text-[var(--gold)]">Your post</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full border border-[var(--cream)]/25 px-3 py-1 text-xs font-bold text-[var(--cream)]/70 transition hover:border-[var(--gold)] hover:text-[var(--gold)]"
              >
                Close
              </button>
            </div>

            <p className="mt-1 text-xs text-[var(--cream)]/55">
              Copy this, then post it on X with your image attached.
            </p>

            <label className="mt-4 block text-[11px] font-bold tracking-[0.18em] text-[var(--cream)]/60">
              CAPTION
              <textarea
                ref={textRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={7}
                spellCheck={false}
                className="mt-1 w-full resize-y rounded-xl border border-[var(--cream)]/15 bg-black/30 p-3 text-[15px] font-normal leading-relaxed tracking-normal text-[var(--cream)] outline-none focus:border-[var(--gold)]"
              />
            </label>

            {missingTag && (
              <p role="alert" className="mt-1 text-[11px] font-bold text-[var(--pink)]">
                {EVENT.hashtag} is missing — the submission is invalid without it.
              </p>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={async () => setCopied((await copy(caption)) ? "caption" : null)}
                className="rounded-full bg-[var(--gold)] px-4 py-3 text-sm font-bold text-[var(--ink)] transition hover:brightness-110"
              >
                {copied === "caption" ? "Caption copied ✓" : "Copy caption"}
              </button>
              <button
                type="button"
                disabled={!blob}
                onClick={() => blob && downloadBlob(blob, fileName)}
                className="rounded-full border border-[var(--cream)]/25 px-4 py-3 text-sm font-semibold text-[var(--cream)] transition hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-50"
              >
                {blob ? "Save image" : "Preparing image…"}
              </button>
            </div>

            {canShareFiles() && blob && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.share({
                      files: [new File([blob], fileName, { type: "image/png" })],
                      text: caption,
                    });
                  } catch {
                    /* dismissed */
                  }
                }}
                className="mt-2 w-full rounded-full bg-[var(--pink)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
              >
                Share image via your phone
              </button>
            )}

            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--cream)] px-4 py-3 text-sm font-bold text-[var(--ink)] transition hover:brightness-95"
            >
              <XLogo />
              Open X with this caption
            </a>

            <div className="mt-4 border-t border-[var(--cream)]/12 pt-3">
              <p className="text-[11px] font-bold tracking-[0.18em] text-[var(--cream)]/60">
                SHAREABLE LINK
              </p>
              {preparing && !shareUrl ? (
                <p className="mt-1 text-xs text-[var(--cream)]/45">Uploading your graphic…</p>
              ) : shareUrl ? (
                <>
                  <p className="mt-1 break-all text-xs text-[var(--cream)]/70">{shareUrl}</p>
                  <button
                    type="button"
                    onClick={async () => setCopied((await copy(shareUrl)) ? "link" : null)}
                    className="mt-2 rounded-full border border-[var(--cream)]/25 px-3 py-1.5 text-[11px] font-bold text-[var(--cream)]/80 transition hover:border-[var(--gold)] hover:text-[var(--gold)]"
                  >
                    {copied === "link" ? "Link copied ✓" : "Copy link"}
                  </button>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--cream)]/45">
                    Posting this link shows your graphic as the preview — handy if you
                    would rather not attach the image.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-[var(--cream)]/45">
                  Not available — attach the saved image to your post instead.
                </p>
              )}
            </div>
          </div>
        </div>
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

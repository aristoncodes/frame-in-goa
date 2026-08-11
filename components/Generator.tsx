"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { COLORS, EVENT } from "@/lib/brand";
import { browserEnv, canvasToBlob, downloadBlob, ensureFonts, slugify } from "@/lib/browser";
import { generateBuilderTitle } from "@/lib/builderTitle";
import { ACCEPTED_TYPES, loadPhoto, UnsupportedImageError, type LoadedPhoto } from "@/lib/image";
import {
  DEFAULT_PFP_TRANSFORM,
  DEFAULT_TRANSFORM,
  ID_CARD_SIZE,
  PHOTO_SLOT_ASPECT,
  renderIdCard,
  type CardData,
  type CardFace,
  type PhotoTransform,
} from "@/lib/render/idcard";
import { PFP_SIZE, renderPfp } from "@/lib/render/pfp";
import type { Ctx } from "@/lib/render/primitives";
import PhotoAdjust from "./PhotoAdjust";
import ShareBar from "./ShareBar";

type Mode = "card" | "pfp";

const IDENTITY_DEFAULT = { name: "", stack: "", role: "" };
/** Matches the card's photo mount, so the control previews the real backdrop. */
const KRAFT = COLORS.kraft;

export default function Generator() {
  const [mode, setMode] = useState<Mode>("card");
  const [face, setFace] = useState<CardFace>("front");
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  // One framing per mode: the crop that suits a badge window is not the crop
  // that suits a circular avatar, and switching tabs shouldn't discard either.
  const [transforms, setTransforms] = useState<Record<Mode, PhotoTransform>>({
    card: DEFAULT_TRANSFORM,
    pfp: DEFAULT_PFP_TRANSFORM,
  });
  const transform = transforms[mode];
  const setTransform = useCallback<Dispatch<SetStateAction<PhotoTransform>>>(
    (update) =>
      setTransforms((prev) => ({
        ...prev,
        [mode]: typeof update === "function" ? update(prev[mode]) : update,
      })),
    [mode],
  );
  const [identity, setIdentity] = useState(IDENTITY_DEFAULT);
  const [titleSalt, setTitleSalt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  const [logo, setLogo] = useState<HTMLImageElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const builderTitle = useMemo(
    () => generateBuilderTitle(identity.name, identity.stack, identity.role, titleSalt),
    [identity, titleSalt],
  );

  /* fonts + optional supplied logo ------------------------------------- */
  useEffect(() => {
    ensureFonts().then(() => setFontsLoaded(true));

    // Optional: point NEXT_PUBLIC_LOGO_URL at the official HH Goa lockup and the
    // card back uses that artwork as-is. Unset, the back draws the wordmark from
    // the same type system as everything else (see drawBack).
    const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL;
    if (!logoUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLogo(img);
    img.src = logoUrl;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = mode === "card" ? ID_CARD_SIZE : PFP_SIZE;
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    const ctx = canvas.getContext("2d") as Ctx | null;
    if (!ctx) return;

    if (mode === "card") {
      const data: CardData = {
        ...identity,
        builderTitle,
        photo: photo?.source ?? null,
        transform,
      };
      renderIdCard(ctx, browserEnv, data, face, logo);
    } else {
      renderPfp(ctx, { photo: photo?.source ?? null, transform });
    }
  }, [mode, face, identity, builderTitle, photo, transform, logo]);

  // One composite per animation frame, cancelled on the next change, so holding
  // a key or dragging never queues up a backlog of full-res renders.
  useEffect(() => {
    if (!fontsLoaded) return;
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [fontsLoaded, draw]);

  /* upload -------------------------------------------------------------- */
  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const loaded = await loadPhoto(file);
      setPhoto(loaded);
      setTransforms({ card: DEFAULT_TRANSFORM, pfp: DEFAULT_PFP_TRANSFORM });
    } catch (e) {
      setError(
        e instanceof UnsupportedImageError
          ? e.message
          : "Something went wrong reading that photo. Try another one.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  /* export -------------------------------------------------------------- */
  const exportBlob = useCallback(
    async (which: CardFace | "pfp" = face): Promise<Blob> => {
      await ensureFonts();
      const size = mode === "card" ? ID_CARD_SIZE : PFP_SIZE;
      const off = document.createElement("canvas");
      off.width = size.w;
      off.height = size.h;
      const ctx = off.getContext("2d") as Ctx;
      if (mode === "card") {
        renderIdCard(
          ctx,
          browserEnv,
          { ...identity, builderTitle, photo: photo?.source ?? null, transform },
          which === "pfp" ? "front" : which,
          logo,
        );
      } else {
        renderPfp(ctx, { photo: photo?.source ?? null, transform });
      }
      return canvasToBlob(off);
    },
    [mode, face, identity, builderTitle, photo, transform, logo],
  );

  const fileName = (which: string) =>
    `hhgoa2026-${mode === "card" ? `builder-id-${which}` : "pfp"}-${slugify(
      identity.name,
    )}.png`;

  const download = async (which: CardFace | "pfp") => {
    setBusy(true);
    try {
      downloadBlob(await exportBlob(which), fileName(which));
    } finally {
      setBusy(false);
    }
  };

  // The crop viewport is exactly the frame the photo lands in: the card's fixed
  // photo slot, or the PFP's circle.
  const aspect = mode === "card" ? PHOTO_SLOT_ASPECT : 1;
  const hasPhoto = Boolean(photo);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <ModeTabs mode={mode} onChange={setMode} />

      {/*
        `contents` collapses the two column wrappers on mobile so every block
        becomes a direct flex child and can be ordered freely: preview first
        (the result is the point), then upload, adjust, details, actions.
        At lg the wrappers become real columns again.
      */}
      <div className="mt-6 flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
        <div className="contents lg:block">
          {/* -------------------------------------------------- preview */}
          <section className="order-1">
            <div className="relative overflow-hidden rounded-2xl border border-[var(--cream)]/12 bg-black/25 p-3 shadow-2xl">
              <canvas
                ref={canvasRef}
                className="block h-auto w-full rounded-lg"
                aria-label={
                  mode === "card"
                    ? `Builder ID card, ${face} side`
                    : "Profile picture frame preview"
                }
              />
              {!fontsLoaded && (
                <div className="absolute inset-0 grid place-items-center bg-[var(--green)]/70 text-sm text-[var(--cream)]/70">
                  Loading brand type…
                </div>
              )}
              {fontsLoaded && !hasPhoto && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-3 grid place-items-center rounded-lg bg-[var(--green-deep)]/55 backdrop-blur-[2px] transition hover:bg-[var(--green-deep)]/45"
                >
                  <span className="rounded-full bg-[var(--pink)] px-6 py-3 text-sm font-bold tracking-wide text-white shadow-lg">
                    Upload your photo
                  </span>
                </button>
              )}
            </div>

            {mode === "card" && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <FaceToggle face={face} onChange={setFace} />
              </div>
            )}
          </section>

          {/* -------------------------------------------------- actions */}
          <div className="order-5 lg:mt-5">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => download(mode === "card" ? face : "pfp")}
                disabled={busy}
                className="flex-1 rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-bold tracking-wide text-[var(--ink)] transition hover:brightness-110 disabled:opacity-60"
              >
                Download PNG
              </button>
              {mode === "card" && (
                <button
                  type="button"
                  onClick={() => download(face === "front" ? "back" : "front")}
                  disabled={busy}
                  className="rounded-full border border-[var(--cream)]/25 px-5 py-3 text-sm font-semibold text-[var(--cream)] transition hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-60"
                >
                  Also get the {face === "front" ? "back" : "front"}
                </button>
              )}
            </div>

            <ShareBar
              getBlob={() => exportBlob(mode === "card" ? "front" : "pfp")}
              fileName={fileName(mode === "card" ? "front" : "pfp")}
              name={identity.name}
              builderTitle={builderTitle}
              mode={mode}
            />
          </div>
        </div>

        {/* ------------------------------------------------------ controls */}
        <aside className="contents lg:block lg:space-y-6">
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="order-2 rounded-2xl border border-dashed border-[var(--cream)]/25 bg-black/20 p-5 text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="w-full rounded-full bg-[var(--pink)] px-5 py-3 text-sm font-bold tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Working…" : hasPhoto ? "Change photo" : "Upload your photo"}
            </button>
            <p className="mt-2 text-xs text-[var(--cream)]/55">
              JPG, PNG, WebP or HEIC from iPhone. Nothing is uploaded until you share.
            </p>
            {error && (
              <p role="alert" className="mt-2 text-xs font-semibold text-[var(--pink)]">
                {error}
              </p>
            )}
          </div>

          {photo && (
            <div className="order-3 rounded-2xl border border-[var(--cream)]/12 bg-black/20 p-5">
              <h2 className="mb-3 text-xs font-bold tracking-[0.2em] text-[var(--gold)]">
                POSITION YOUR PHOTO
              </h2>
              <PhotoAdjust
                photo={photo}
                aspect={aspect}
                round={mode === "pfp"}
                backdrop={mode === "card" ? KRAFT : undefined}
                transform={transform}
                onChange={setTransform}
              />
            </div>
          )}

          {mode === "card" && (
            <div className="order-4 space-y-4 rounded-2xl border border-[var(--cream)]/12 bg-black/20 p-5">
              <h2 className="text-xs font-bold tracking-[0.2em] text-[var(--gold)]">
                YOUR DETAILS
              </h2>
              <Field
                label="Name"
                value={identity.name}
                placeholder="Aryan Chauhan"
                maxLength={40}
                onChange={(v) => setIdentity((s) => ({ ...s, name: v }))}
              />
              <Field
                label="Stack"
                value={identity.stack}
                placeholder="Web3 / AI / Build"
                maxLength={60}
                onChange={(v) => setIdentity((s) => ({ ...s, stack: v }))}
              />
              <Field
                label="Role"
                value={identity.role}
                placeholder="Founding Engineer"
                maxLength={40}
                onChange={(v) => setIdentity((s) => ({ ...s, role: v }))}
              />
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-bold tracking-[0.18em] text-[var(--cream)]/60">
                    BUILDER TITLE
                  </span>
                  <button
                    type="button"
                    onClick={() => setTitleSalt((s) => s + 1)}
                    className="text-[11px] font-semibold text-[var(--pink)] underline underline-offset-2 hover:text-[var(--gold)]"
                  >
                    Reroll
                  </button>
                </div>
                <p className="mt-1 font-display text-lg text-[var(--gold)]">{builderTitle}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- sub-parts */

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Graphic format"
      className="mx-auto flex w-full max-w-md rounded-full border border-[var(--cream)]/15 bg-black/25 p-1"
    >
      {(
        [
          ["card", "Builder ID Card"],
          ["pfp", "PFP Frame"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold tracking-wide transition ${
            mode === value
              ? "bg-[var(--gold)] text-[var(--ink)]"
              : "text-[var(--cream)]/70 hover:text-[var(--cream)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FaceToggle({
  face,
  onChange,
}: {
  face: CardFace;
  onChange: (f: CardFace) => void;
}) {
  return (
    <div className="flex rounded-full border border-[var(--cream)]/15 bg-black/25 p-1 text-xs">
      {(["front", "back"] as const).map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={face === f}
          onClick={() => onChange(f)}
          className={`rounded-full px-4 py-1.5 font-bold tracking-wide capitalize transition ${
            face === f ? "bg-[var(--pink)] text-white" : "text-[var(--cream)]/65"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold tracking-[0.18em] text-[var(--cream)]/60">
        {label.toUpperCase()}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[var(--cream)]/15 bg-black/30 px-3 py-2.5 text-[16px] text-[var(--cream)] outline-none transition placeholder:text-[var(--cream)]/30 focus:border-[var(--gold)]"
      />
    </label>
  );
}

export { EVENT };

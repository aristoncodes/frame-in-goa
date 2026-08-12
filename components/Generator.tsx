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
  CARD_ONLY_SIZE,
  DEFAULT_PFP_TRANSFORM,
  DEFAULT_TRANSFORM,
  ID_CARD_SIZE,
  PHOTO_SLOT_ASPECT,
  renderCardOnly,
  renderIdCard,
  type CardData,
  type CardFace,
  type PhotoTransform,
} from "@/lib/render/idcard";
import { PFP_SIZE, renderPfp } from "@/lib/render/pfp";
import {
  emptyMember,
  renderTeamCardOnly,
  renderTeamPoster,
  TEAM_MAX,
  TEAM_MIN,
  TEAM_CARD_ONLY_SIZE,
  TEAM_PHOTO_ASPECT,
  TEAM_POSTER_SIZE,
  type TeamMember,
} from "@/lib/render/team";
import type { Ctx } from "@/lib/render/primitives";
import { BackgroundRemovalError, replaceBackground } from "@/lib/segment";
import PhotoAdjust from "./PhotoAdjust";
import { BRAND_ASSET_PATHS, NO_ASSETS, type BrandAssets } from "@/lib/render/assets";
import ShareBar, { type ShareImage } from "./ShareBar";

type Mode = "card" | "pfp" | "team";
/**
 * The two single-photo modes. Team mode keeps a transform per roster slot rather
 * than one for the whole mode, so it is deliberately outside this.
 */
type SoloMode = Exclude<Mode, "team">;

/**
 * What a download contains. The two are different crops of the same artwork, so
 * the choice has to be made before the button is pressed rather than after.
 *
 * - `poster` — the whole composite: green field, type, lanyard, card.
 * - `card`   — the card alone on a transparent ground, cropped to its own edges.
 */
type Crop = "poster" | "card";

const IDENTITY_DEFAULT = { name: "", team: "", role: "" };
/** Matches the card's photo mount, so the control previews the real backdrop. */
const KRAFT = COLORS.kraft;

export default function Generator() {
  const [mode, setMode] = useState<Mode>("card");
  const [face, setFace] = useState<CardFace>("front");
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  // One framing per mode: the crop that suits a badge window is not the crop
  // that suits a circular avatar, and switching tabs shouldn't discard either.
  const [transforms, setTransforms] = useState<Record<SoloMode, PhotoTransform>>({
    card: DEFAULT_TRANSFORM,
    pfp: DEFAULT_PFP_TRANSFORM,
  });
  const soloMode: SoloMode = mode === "pfp" ? "pfp" : "card";
  const transform = transforms[soloMode];
  const setTransform = useCallback<Dispatch<SetStateAction<PhotoTransform>>>(
    (update) =>
      setTransforms((prev) => ({
        ...prev,
        [soloMode]: typeof update === "function" ? update(prev[soloMode]) : update,
      })),
    [soloMode],
  );
  const [identity, setIdentity] = useState(IDENTITY_DEFAULT);
  /**
   * Team mode's roster. Always TEAM_MAX slots in state so a photo typed into
   * slot 3 survives toggling down to 2 and back; `teamSize` decides how many are
   * shown and rendered.
   */
  const [teamSize, setTeamSize] = useState<number>(TEAM_MAX);
  /** A team has one name — it is the card's headline, not a per-person field. */
  const [teamName, setTeamName] = useState("");
  const [team, setTeam] = useState(() =>
    Array.from({ length: TEAM_MAX }, () => ({
      name: "",
      photo: null as LoadedPhoto | null,
      transform: DEFAULT_TRANSFORM,
      // Same background knock-out the solo card offers, kept per slot.
      cutout: null as CanvasImageSource | null,
      useCutout: false,
      cutoutBusy: false,
      cutoutError: null as string | null,
    })),
  );
  const [titleSalt, setTitleSalt] = useState(0);
  const [crop, setCrop] = useState<Crop>("poster");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Official HH Goa artwork, loaded once and passed to every render.
  const [assets, setAssets] = useState<BrandAssets>(NO_ASSETS);

  // Background replacement: the cut-out is kept alongside the original so the
  // toggle is instant and always reversible.
  const [cutout, setCutout] = useState<HTMLCanvasElement | null>(null);
  const [useCutout, setUseCutout] = useState(false);
  const [cutoutBusy, setCutoutBusy] = useState(false);
  const [cutoutError, setCutoutError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const builderTitle = useMemo(
    () => generateBuilderTitle(identity.name, identity.team, identity.role, titleSalt),
    [identity, titleSalt],
  );

  /**
   * The roster the renderer takes. Titles come from the very same
   * `generateBuilderTitle` the solo card uses — called once per person, sharing
   * the one `titleSalt`, so the single Reroll button rerolls the whole team.
   */
  const roster = useMemo<TeamMember[]>(
    () =>
      team.slice(0, teamSize).map((m) => ({
        ...emptyMember(),
        name: m.name,
        // The knocked-out copy when that slot's toggle is on, exactly as the solo
        // card picks between `cutout` and the original.
        photo: (m.useCutout && m.cutout ? m.cutout : m.photo?.source) ?? null,
        transform: m.transform,
        builderTitle: generateBuilderTitle(m.name, teamName, "Builder", titleSalt),
      })),
    [team, teamSize, teamName, titleSalt],
  );
  const teamData = useMemo(() => ({ teamName, members: roster }), [teamName, roster]);

  /* fonts + optional supplied logo ------------------------------------- */
  useEffect(() => {
    ensureFonts().then(() => setFontsLoaded(true));

    // Optional: point NEXT_PUBLIC_LOGO_URL at the official HH Goa lockup and the
    // card back uses that artwork as-is. Unset, the back draws the wordmark from
    // the same type system as everything else (see drawBack).
    const load = (url: string | undefined, key: keyof BrandAssets) => {
      if (!url) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setAssets((prev) => ({ ...prev, [key]: img }));
      img.src = url;
    };
    load(BRAND_ASSET_PATHS.goa, "goa");
    load(BRAND_ASSET_PATHS.studio, "studio");
    load(BRAND_ASSET_PATHS.wordmark, "wordmark");
    load(BRAND_ASSET_PATHS.lanyard, "lanyard");
    load(BRAND_ASSET_PATHS.backLockup, "backLockup");
    // Optional override: a full lockup for the card back.
    load(process.env.NEXT_PUBLIC_LOGO_URL, "logo");
  }, []);

  /** What the renderers actually composite: the cut-out when it's on and ready. */
  const source = useCutout && cutout ? cutout : (photo?.source ?? null);

  const toggleCutout = useCallback(async () => {
    if (useCutout) {
      setUseCutout(false);
      return;
    }
    if (cutout) {
      setUseCutout(true);
      return;
    }
    if (!photo) return;
    setCutoutBusy(true);
    setCutoutError(null);
    try {
      const result = await replaceBackground(photo.source);
      setCutout(result);
      setUseCutout(true);
    } catch (e) {
      setCutoutError(
        e instanceof BackgroundRemovalError && e.message.startsWith("Couldn't")
          ? e.message
          : "Couldn't remove the background. Keeping your photo as it is.",
      );
    } finally {
      setCutoutBusy(false);
    }
  }, [useCutout, cutout, photo]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size =
      mode === "pfp" ? PFP_SIZE : mode === "team" ? TEAM_POSTER_SIZE : ID_CARD_SIZE;
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    const ctx = canvas.getContext("2d") as Ctx | null;
    if (!ctx) return;

    if (mode === "team") {
      renderTeamPoster(ctx, browserEnv, teamData, assets);
    } else if (mode === "card") {
      const data: CardData = { ...identity, builderTitle, photo: source, transform };
      renderIdCard(ctx, browserEnv, data, face, assets);
    } else {
      renderPfp(ctx, { photo: source, transform }, assets);
    }
  }, [mode, face, identity, builderTitle, source, transform, assets, teamData]);

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
      setCutout(null);
      setUseCutout(false);
      setCutoutError(null);
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

  /** Same loader, same accepted formats, same errors — just into a roster slot. */
  const handleMemberFile = useCallback(
    async (index: number, file: File | undefined | null) => {
      if (!file) return;
      setError(null);
      setBusy(true);
      try {
        const loaded = await loadPhoto(file);
        setTeam((prev) =>
          prev.map((m, i) =>
            i === index
              ? {
                  ...m,
                  photo: loaded,
                  transform: DEFAULT_TRANSFORM,
                  cutout: null,
                  useCutout: false,
                  cutoutError: null,
                }
              : m,
          ),
        );
      } catch (e) {
        setError(
          e instanceof UnsupportedImageError
            ? e.message
            : "Something went wrong reading that photo. Try another one.",
        );
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const setMember = useCallback(
    (index: number, patch: Partial<{ name: string; transform: PhotoTransform }>) =>
      setTeam((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m))),
    [],
  );

  /**
   * The solo card's kraft knock-out, per roster slot — same `replaceBackground`.
   *
   * Reads the slot from `team` rather than from inside a `setTeam` updater: React
   * runs updaters during the re-render, not at call time, so a value captured in
   * one is still unset by the time the line after it runs, and the toggle did
   * nothing at all.
   */
  const toggleMemberCutout = useCallback(
    async (index: number) => {
      const m = team[index];
      if (!m?.photo) return;
      const flip = (patch: Partial<(typeof team)[number]>) =>
        setTeam((prev) => prev.map((x, i) => (i === index ? { ...x, ...patch } : x)));

      // Already on, or already computed: a straight flip, no work to do.
      if (m.useCutout) return flip({ useCutout: false });
      if (m.cutout) return flip({ useCutout: true });

      flip({ cutoutBusy: true, cutoutError: null });
      try {
        const result = await replaceBackground(m.photo.source);
        flip({ cutout: result, useCutout: true, cutoutBusy: false });
      } catch (e) {
        flip({
          cutoutBusy: false,
          cutoutError:
            e instanceof BackgroundRemovalError && e.message.startsWith("Couldn't")
              ? e.message
              : "Couldn't remove the background. Keeping the photo as it is.",
        });
      }
    },
    [team],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  /* export -------------------------------------------------------------- */
  const exportBlob = useCallback(
    async (which: CardFace | "pfp" = face): Promise<Blob> => {
      await ensureFonts();
      // The PFP has one crop; the card and the team card both offer
      // poster-vs-card-only.
      const cardOnly = mode !== "pfp" && crop === "card";
      const size =
        mode === "pfp"
          ? PFP_SIZE
          : mode === "team"
            ? cardOnly
              ? TEAM_CARD_ONLY_SIZE
              : TEAM_POSTER_SIZE
            : cardOnly
              ? CARD_ONLY_SIZE
              : ID_CARD_SIZE;
      const off = document.createElement("canvas");
      off.width = size.w;
      off.height = size.h;
      const ctx = off.getContext("2d") as Ctx;
      if (mode === "team") {
        if (cardOnly) renderTeamCardOnly(ctx, browserEnv, teamData, assets);
        else renderTeamPoster(ctx, browserEnv, teamData, assets);
      } else if (mode === "card") {
        const data = { ...identity, builderTitle, photo: source, transform };
        const cardFace = which === "pfp" ? "front" : which;
        if (cardOnly) renderCardOnly(ctx, browserEnv, data, cardFace, assets);
        else renderIdCard(ctx, browserEnv, data, cardFace, assets);
      } else {
        renderPfp(ctx, { photo: source, transform }, assets);
      }
      return canvasToBlob(off);
    },
    [mode, crop, face, identity, builderTitle, source, transform, assets, teamData],
  );

  /**
   * Renders every graphic — card front, card back and PFP — regardless of which
   * tab is open, each with that mode's own framing. X takes up to four images
   * per post, so the whole set can go up together.
   */
  const exportAll = useCallback(async (): Promise<ShareImage[]> => {
    await ensureFonts();
    const slug = slugify(identity.name);
    const make = (w: number, h: number, paint: (ctx: Ctx) => void) => {
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      paint(off.getContext("2d") as Ctx);
      return canvasToBlob(off);
    };
    const data = {
      ...identity,
      builderTitle,
      photo: source,
      transform: transforms.card,
    };
    if (mode === "team") {
      const blob = await make(TEAM_POSTER_SIZE.w, TEAM_POSTER_SIZE.h, (ctx) =>
        renderTeamPoster(ctx, browserEnv, teamData, assets),
      );
      return [
        {
          key: "team",
          label: `Team card — ${roster.length} builders`,
          fileName: `hhgoa2026-team-${slug || "squad"}.png`,
          blob,
        },
      ];
    }

    const [front, back, pfp] = await Promise.all([
      make(ID_CARD_SIZE.w, ID_CARD_SIZE.h, (ctx) =>
        renderIdCard(ctx, browserEnv, data, "front", assets),
      ),
      make(ID_CARD_SIZE.w, ID_CARD_SIZE.h, (ctx) =>
        renderIdCard(ctx, browserEnv, data, "back", assets),
      ),
      make(PFP_SIZE.w, PFP_SIZE.h, (ctx) =>
        renderPfp(ctx, { photo: source, transform: transforms.pfp }, assets),
      ),
    ]);
    return [
      { key: "front", label: "ID card — front", fileName: `hhgoa2026-builder-id-front-${slug}.png`, blob: front },
      { key: "back", label: "ID card — back", fileName: `hhgoa2026-builder-id-back-${slug}.png`, blob: back },
      { key: "pfp", label: "PFP frame", fileName: `hhgoa2026-pfp-${slug}.png`, blob: pfp },
    ];
  }, [mode, identity, builderTitle, source, transforms, assets, teamData, roster]);

  const fileName = (which: string) => {
    const kind = crop === "card" ? "card" : "poster";
    if (mode === "pfp") return `hhgoa2026-pfp-${slugify(identity.name)}.png`;
    if (mode === "team") {
      return `hhgoa2026-team-${teamSize}-${kind}-${slugify(teamName, "squad")}.png`;
    }
    return `hhgoa2026-builder-id-${kind}-${which}-${slugify(identity.name)}.png`;
  };

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
                    : mode === "team"
                      ? `Team card, ${teamSize} builders`
                      : "Profile picture frame preview"
                }
              />
              {!fontsLoaded && (
                <div className="absolute inset-0 grid place-items-center bg-[var(--green)]/70 text-sm text-[var(--cream)]/70">
                  Loading brand type…
                </div>
              )}
              {fontsLoaded && !hasPhoto && mode !== "team" && (
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
            {mode !== "pfp" && <CropTabs crop={crop} onChange={setCrop} />}

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => download(mode === "card" ? face : "pfp")}
                disabled={busy}
                className="flex-1 rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-bold tracking-wide text-[var(--ink)] transition hover:brightness-110 active:brightness-95 disabled:opacity-60"
              >
                {mode === "pfp"
                  ? "Download PNG"
                  : crop === "card"
                    ? mode === "team"
                      ? "Only team card"
                      : "Only ID card"
                    : "Download post"}
              </button>
              {mode === "card" && (
                <button
                  type="button"
                  onClick={() => download(face === "front" ? "back" : "front")}
                  disabled={busy}
                  className="rounded-full border border-[var(--cream)]/25 px-5 py-3 text-sm font-semibold text-[var(--cream)] transition hover:border-[var(--gold)] hover:text-[var(--gold)] active:border-[var(--gold)] disabled:opacity-60"
                >
                  Also the {face === "front" ? "back" : "front"}
                </button>
              )}
            </div>

            <ShareBar
              getImages={exportAll}
              name={identity.name}
              builderTitle={builderTitle}
              mode={mode}
            />
          </div>
        </div>

        {/* ------------------------------------------------------ controls */}
        <aside className="contents lg:block lg:space-y-6">
          {mode === "team" && (
            <TeamPanel
              team={team}
              size={teamSize}
              onSize={setTeamSize}
              teamName={teamName}
              onTeamName={setTeamName}
              onFile={handleMemberFile}
              onMember={setMember}
              onCutout={toggleMemberCutout}
              titles={roster.map((m) => m.builderTitle)}
              onReroll={() => setTitleSalt((n) => n + 1)}
              busy={busy}
              error={error}
            />
          )}

          <div
            hidden={mode === "team"}
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

          {photo && mode !== "team" && (
            <div className="order-3 rounded-2xl border border-[var(--cream)]/12 bg-black/20 p-5">
              <h2 className="mb-3 text-xs font-bold tracking-[0.2em] text-[var(--gold)]">
                POSITION YOUR PHOTO
              </h2>

              <button
                type="button"
                onClick={toggleCutout}
                disabled={cutoutBusy}
                aria-pressed={useCutout}
                className={`mb-3 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-xs font-bold tracking-wide transition disabled:opacity-60 ${
                  useCutout
                    ? "border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold)]"
                    : "border-[var(--cream)]/20 text-[var(--cream)]/75 hover:border-[var(--cream)]/40"
                }`}
              >
                <span>
                  {cutoutBusy ? "REMOVING BACKGROUND…" : "PUT ME ON KRAFT PAPER"}
                  <span className="mt-0.5 block text-[10px] font-medium tracking-normal text-[var(--cream)]/50">
                    {cutoutBusy
                      ? "First run downloads the model"
                      : "Swaps your background for the card's paper"}
                  </span>
                </span>
                <span
                  className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${
                    useCutout ? "bg-[var(--gold)]" : "bg-[var(--cream)]/25"
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-[var(--ink)] transition ${
                      useCutout ? "translate-x-4" : ""
                    }`}
                  />
                </span>
              </button>
              {cutoutError && (
                <p role="alert" className="mb-3 text-[11px] font-semibold text-[var(--pink)]">
                  {cutoutError}
                </p>
              )}
              <PhotoAdjust
                photo={{ ...photo, source: source ?? photo.source }}
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
                label="Team"
                value={identity.team}
                placeholder="Midnight Shippers"
                maxLength={60}
                onChange={(v) => setIdentity((s) => ({ ...s, team: v }))}
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
                    className="rounded-full bg-[var(--pink)] px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-white shadow-sm transition hover:brightness-110 active:brightness-95 active:translate-y-px"
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

/**
 * Team mode's controls: a size toggle, then one repeated block per builder —
 * the same upload button, the same `Field` inputs and the same `PhotoAdjust`
 * the solo modes use, just once per roster slot. One Reroll for the whole team,
 * since every title comes from the one shared salt.
 */
type TeamSlotState = {
  name: string;
  photo: LoadedPhoto | null;
  transform: PhotoTransform;
  cutout: CanvasImageSource | null;
  useCutout: boolean;
  cutoutBusy: boolean;
  cutoutError: string | null;
};

function TeamPanel({
  team,
  size,
  onSize,
  teamName,
  onTeamName,
  onFile,
  onMember,
  onCutout,
  titles,
  onReroll,
  busy,
  error,
}: {
  team: TeamSlotState[];
  size: number;
  onSize: (n: number) => void;
  teamName: string;
  onTeamName: (v: string) => void;
  onFile: (index: number, file: File | undefined | null) => void;
  onMember: (index: number, patch: Partial<{ name: string; transform: PhotoTransform }>) => void;
  onCutout: (index: number) => void;
  titles: string[];
  onReroll: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="order-2 space-y-4 rounded-2xl border border-[var(--cream)]/12 bg-black/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold tracking-[0.2em] text-[var(--gold)]">YOUR SQUAD</h2>
        <div
          role="group"
          aria-label="Squad size"
          className="flex rounded-full border border-[var(--cream)]/15 bg-black/25 p-1"
        >
          {Array.from({ length: TEAM_MAX - TEAM_MIN + 1 }, (_, i) => TEAM_MIN + i).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={size === n}
              onClick={() => onSize(n)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                size === n
                  ? "bg-[var(--gold)] text-[var(--ink)]"
                  : "text-[var(--cream)]/70 hover:text-[var(--cream)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Team name"
        value={teamName}
        placeholder="Midnight Shippers"
        maxLength={40}
        onChange={onTeamName}
      />

      {error && (
        <p role="alert" className="text-xs font-semibold text-[var(--pink)]">
          {error}
        </p>
      )}

      {team.slice(0, size).map((m, i) => (
        <TeamSlot
          key={i}
          index={i}
          member={m}
          title={titles[i] ?? ""}
          onFile={onFile}
          onMember={onMember}
          onCutout={onCutout}
          busy={busy}
        />
      ))}

      <div className="flex items-center justify-between gap-3 border-t border-[var(--cream)]/10 pt-4">
        <span className="text-[11px] font-bold tracking-[0.18em] text-[var(--cream)]/60">
          BUILDER TITLES
        </span>
        <button
          type="button"
          onClick={onReroll}
          className="rounded-full bg-[var(--pink)] px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-white shadow-sm transition hover:brightness-110 active:brightness-95 active:translate-y-px"
        >
          Reroll all
        </button>
      </div>
      <p className="text-xs text-[var(--cream)]/55">
        JPG, PNG, WebP or HEIC from iPhone. Nothing is uploaded until you share.
      </p>
    </div>
  );
}

/** One builder's slot. Deliberately the same controls as the solo panel. */
function TeamSlot({
  index,
  member,
  title,
  onFile,
  onMember,
  onCutout,
  busy,
}: {
  index: number;
  member: TeamSlotState;
  title: string;
  onFile: (index: number, file: File | undefined | null) => void;
  onMember: (index: number, patch: Partial<{ name: string; transform: PhotoTransform }>) => void;
  onCutout: (index: number) => void;
  busy: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3 rounded-xl border border-[var(--cream)]/12 bg-black/20 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold tracking-[0.18em] text-[var(--cream)]/60">
          BUILDER {index + 1}
        </span>
        {title && <span className="text-[11px] text-[var(--gold)]">{title}</span>}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        onChange={(e) => onFile(index, e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="w-full rounded-full bg-[var(--pink)] px-4 py-2.5 text-xs font-bold tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Working…" : member.photo ? "Change photo" : "Upload photo"}
      </button>

      <Field
        label="Name"
        value={member.name}
        placeholder="Aryan Chauhan"
        maxLength={40}
        onChange={(v) => onMember(index, { name: v })}
      />

      {member.photo && (
        <>
          <button
            type="button"
            onClick={() => onCutout(index)}
            disabled={member.cutoutBusy}
            aria-pressed={member.useCutout}
            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-[11px] font-bold tracking-wide transition disabled:opacity-60 ${
              member.useCutout
                ? "border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold)]"
                : "border-[var(--cream)]/20 text-[var(--cream)]/75 hover:border-[var(--cream)]/40"
            }`}
          >
            <span>
              {member.cutoutBusy ? "REMOVING BACKGROUND…" : "PUT ME ON KRAFT PAPER"}
              <span className="mt-0.5 block text-[10px] font-medium tracking-normal text-[var(--cream)]/50">
                {member.cutoutBusy
                  ? "First run downloads the model"
                  : "Swaps the background for the card's paper"}
              </span>
            </span>
            <span
              className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${
                member.useCutout ? "bg-[var(--gold)]" : "bg-[var(--cream)]/25"
              }`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-[var(--ink)] transition ${
                  member.useCutout ? "translate-x-4" : ""
                }`}
              />
            </span>
          </button>
          {member.cutoutError && (
            <p role="alert" className="text-[11px] font-semibold text-[var(--pink)]">
              {member.cutoutError}
            </p>
          )}
          <PhotoAdjust
            photo={{
              ...member.photo,
              source: (member.useCutout && member.cutout ? member.cutout : member.photo.source) as
                | HTMLImageElement
                | HTMLCanvasElement,
            }}
            aspect={TEAM_PHOTO_ASPECT}
            backdrop={KRAFT}
            transform={member.transform}
            onChange={(update) =>
              onMember(index, {
                transform: typeof update === "function" ? update(member.transform) : update,
              })
            }
          />
        </>
      )}
    </div>
  );
}

/**
 * Poster vs card-only. Two different crops of the same artwork, so the choice
 * belongs before the download button rather than in a menu behind it.
 */
function CropTabs({ crop, onChange }: { crop: Crop; onChange: (c: Crop) => void }) {
  return (
    <div>
      <div
        role="tablist"
        aria-label="What to download"
        className="flex w-full rounded-full border border-[var(--cream)]/15 bg-black/25 p-1"
      >
        {(
          [
            ["poster", "Full poster"],
            ["card", "Card only"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={crop === value}
            onClick={() => onChange(value)}
            className={`flex-1 rounded-full px-4 py-2 text-xs font-bold tracking-wide transition ${
              crop === value
                ? "bg-[var(--cream)] text-[var(--ink)]"
                : "text-[var(--cream)]/70 hover:text-[var(--cream)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-[var(--cream)]/50">
        {crop === "poster"
          ? "The whole composite — background, lanyard and card."
          : "Just the card, cropped to its edges on a transparent background."}
      </p>
    </div>
  );
}

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
          ["team", "Team"],
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

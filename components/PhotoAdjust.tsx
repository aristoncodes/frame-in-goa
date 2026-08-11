"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { clamp, drawPhoto, photoRect } from "@/lib/render/primitives";
import type { PhotoTransform } from "@/lib/render/idcard";
import type { LoadedPhoto } from "@/lib/image";

type Props = {
  photo: LoadedPhoto;
  aspect: number;
  round?: boolean;
  transform: PhotoTransform;
  /** A setState updater, so rapid gestures compose instead of clobbering. */
  onChange: Dispatch<SetStateAction<PhotoTransform>>;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const CANVAS_W = 720;

type Point = { x: number; y: number };
type Gesture = { startT: PhotoTransform; start: Point; startDist: number };

/**
 * Drag-to-reposition viewport matching the target frame's aspect ratio, so the
 * user never has to pre-crop. Pointer events cover mouse, touch and pen; a
 * second finger (or the wheel / slider) zooms.
 */
export default function PhotoAdjust({ photo, aspect, round, transform, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = Math.round(CANVAS_W / aspect);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPhoto(ctx, photo.source, 0, 0, canvas.width, canvas.height, transform);
  }, [photo, aspect, transform]);

  /**
   * Converts a pixel drag into the normalised offsets drawPhoto expects, using
   * the transform captured when the gesture began so the mapping stays linear.
   * Geometry comes from photoRect, so fit mode and zoom are always respected.
   */
  const applyDrag = useCallback(
    (dxPx: number, dyPx: number, start: PhotoTransform) => {
      const box = boxRef.current;
      const canvas = canvasRef.current;
      if (!box || !canvas) return;
      const rect = box.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      const { maxDX, maxDY } = photoRect(
        photo.source,
        0,
        0,
        canvas.width,
        canvas.height,
        start,
      );
      onChange({
        ...start,
        // No overflow on an axis (contain at zoom 1) means nothing to pan into —
        // guard the divide rather than letting the offset explode.
        offsetX: maxDX > 0.5 ? clamp(start.offsetX + (dxPx * scale) / maxDX, -1, 1) : 0,
        offsetY: maxDY > 0.5 ? clamp(start.offsetY + (dyPx * scale) / maxDY, -1, 1) : 0,
      });
    },
    [photo, onChange],
  );

  const beginGesture = (current: PhotoTransform) => {
    const pts = [...pointers.current.values()];
    if (!pts.length) {
      gesture.current = null;
      return;
    }
    gesture.current = {
      startT: current,
      start: { x: avg(pts, "x"), y: avg(pts, "y") },
      startDist: pts.length > 1 ? dist(pts[0], pts[1]) : 0,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture(transform);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    e.preventDefault();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];

    if (pts.length > 1 && g.startDist > 0) {
      const zoom = clamp(
        (g.startT.zoom * dist(pts[0], pts[1])) / g.startDist,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      onChange({ ...g.startT, zoom });
      return;
    }
    applyDrag(avg(pts, "x") - g.start.x, avg(pts, "y") - g.start.y, g.startT);
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    // Lifting one finger of a pinch re-anchors the gesture instead of jumping.
    beginGesture(transform);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.94 : 1.06;
    onChange((prev) => ({ ...prev, zoom: clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM) }));
  };

  const shape = round ? "rounded-full" : "rounded-xl";

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
        className={`relative w-full cursor-grab touch-none select-none overflow-hidden bg-black/30 active:cursor-grabbing ${shape}`}
        style={{ aspectRatio: String(aspect) }}
        role="application"
        aria-label="Drag to reposition your photo, pinch or scroll to zoom"
      >
        <canvas ref={canvasRef} className="pointer-events-none block h-full w-full" />
        <div
          className={`pointer-events-none absolute inset-0 ring-2 ring-inset ring-[var(--gold)]/70 ${shape}`}
        />
      </div>

      <div
        role="radiogroup"
        aria-label="How the photo meets the frame"
        className="flex rounded-full border border-[var(--cream)]/15 bg-black/25 p-1 text-[11px]"
      >
        {(
          [
            ["contain", "Whole photo", "Nothing gets cropped"],
            ["cover", "Fill frame", "Crops to the edges"],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={transform.fit === value}
            title={hint}
            onClick={() =>
              // Switching mode re-centres: an offset tuned for a cropped frame
              // is meaningless once the whole photo is in view, and vice versa.
              onChange((prev) => ({ ...prev, fit: value, offsetX: 0, offsetY: 0, zoom: 1 }))
            }
            className={`flex-1 rounded-full px-3 py-1.5 font-bold tracking-wide transition ${
              transform.fit === value
                ? "bg-[var(--gold)] text-[var(--ink)]"
                : "text-[var(--cream)]/65 hover:text-[var(--cream)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="radiogroup"
        aria-label="Photo tone"
        className="flex rounded-full border border-[var(--cream)]/15 bg-black/25 p-1 text-[11px]"
      >
        {(
          [
            ["kraft", "Kraft tone", "Warmed to sit in the card's paper"],
            ["original", "Original", "Your photo's own colours"],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={transform.tone === value}
            title={hint}
            onClick={() => onChange((prev) => ({ ...prev, tone: value }))}
            className={`flex-1 rounded-full px-3 py-1.5 font-bold tracking-wide transition ${
              transform.tone === value
                ? "bg-[var(--kraft)] text-[var(--ink)]"
                : "text-[var(--cream)]/65 hover:text-[var(--cream)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 text-xs font-semibold tracking-wide text-[var(--cream)]/70">
        ZOOM
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={transform.zoom}
          onChange={(e) => {
            const zoom = Number(e.target.value);
            onChange((prev) => ({ ...prev, zoom }));
          }}
          className="h-1 flex-1 accent-[var(--pink)]"
          aria-label="Zoom"
        />
        <button
          type="button"
          onClick={() => onChange((prev) => ({ ...prev, zoom: 1, offsetX: 0, offsetY: 0 }))}
          className="rounded-full border border-[var(--cream)]/25 px-3 py-1 text-[11px] transition hover:border-[var(--gold)] hover:text-[var(--gold)]"
        >
          Reset
        </button>
      </label>
    </div>
  );
}

function avg(pts: Point[], k: "x" | "y") {
  return pts.reduce((s, p) => s + p[k], 0) / pts.length;
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

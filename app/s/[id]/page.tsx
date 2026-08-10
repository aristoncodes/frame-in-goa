import { list } from "@vercel/blob";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EVENT } from "@/lib/brand";

export const revalidate = 3600;

type Params = { params: Promise<{ id: string }> };

type Share = { name: string; title: string; mode: "card" | "pfp"; image: string };

/**
 * Resolves a share by listing the blob prefix — no database needed, and the
 * caller can't inject an arbitrary og:image URL, since the image always comes
 * from our own store.
 */
async function getShare(id: string): Promise<Share | null> {
  if (!/^[a-z0-9]{6,16}$/.test(id) || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { blobs } = await list({ prefix: `shares/${id}.` });
    const image = blobs.find((b) => b.pathname === `shares/${id}.png`);
    if (!image) return null;
    const metaBlob = blobs.find((b) => b.pathname === `shares/${id}.json`);
    let meta: Partial<Share> = {};
    if (metaBlob) {
      const res = await fetch(metaBlob.url, { next: { revalidate: 3600 } });
      if (res.ok) meta = await res.json();
    }
    return {
      name: meta.name ?? "",
      title: meta.title ?? "",
      mode: meta.mode === "pfp" ? "pfp" : "card",
      image: image.url,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const share = await getShare((await params).id);
  if (!share) return { title: "Frame in Goa" };

  const who = share.name.trim();
  const title = who
    ? `${who} — ${EVENT.name} Builder ID`
    : `${EVENT.name} — ${share.mode === "pfp" ? "PFP Frame" : "Builder ID"}`;
  const description = share.title
    ? `${share.title} · ${EVENT.dates} · ${EVENT.location}`
    : `${EVENT.dates} · ${EVENT.location}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: share.image,
          width: share.mode === "pfp" ? 1080 : 1080,
          height: share.mode === "pfp" ? 1080 : 1350,
          alt: title,
        },
      ],
    },
    twitter: {
      // summary_large_image renders the graphic itself in the timeline card.
      card: "summary_large_image",
      title,
      description,
      images: [share.image],
    },
  };
}

export default async function SharePage({ params }: Params) {
  const share = await getShare((await params).id);
  if (!share) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center px-4 py-10">
      <p className="text-xs font-bold tracking-[0.3em] text-[var(--gold)]">
        {EVENT.name}
      </p>
      <h1 className="mt-2 text-center font-display text-3xl text-[var(--cream)]">
        {share.name.trim() || "Builder ID"}
      </h1>
      {share.title && (
        <p className="mt-1 text-sm text-[var(--pink)]">{share.title}</p>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={share.image}
        alt={`${share.name || "Builder"} — ${EVENT.name}`}
        width={1080}
        height={share.mode === "pfp" ? 1080 : 1350}
        className="mt-6 w-full rounded-2xl border border-[var(--cream)]/12 shadow-2xl"
      />

      <Link
        href="/"
        className="mt-8 rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold tracking-wide text-[var(--ink)] transition hover:brightness-110"
      >
        Make your own
      </Link>
      <p className="mt-3 text-xs text-[var(--cream)]/50">{EVENT.hashtag}</p>
    </main>
  );
}

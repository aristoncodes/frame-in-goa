import Generator from "@/components/Generator";
import { EVENT } from "@/lib/brand";

/**
 * The landing hero is a reproduction of hhgoa.com's, built from that site's own
 * artwork rather than from type: the gold "HACKER HOUSE" lockup, the official
 * गोवा sticker nested between its two words, and the palms/sunburst plate.
 * Layout offsets live in .hero* (app/globals.css).
 *
 * The event site's header — "CHECK HYPE" and the APPLY button — is deliberately
 * absent: this is the frame generator, not the ticket page, so that corner is
 * left empty.
 */
function Hero() {
  return (
    <section className="hero" aria-label="Hacker House Goa 2026">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="hero-scene"
        src="/brand/hero-scene.webp"
        alt=""
        aria-hidden
        fetchPriority="high"
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="hero-studio"
        src="/brand/2-47.svg"
        alt={EVENT.studio}
        width={546}
        height={335}
        fetchPriority="high"
      />

      <h1 className="hero-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="hero-wordmark"
          src="/brand/hacker-house.png"
          alt="Hacker House"
          width={1162}
          height={251}
          fetchPriority="high"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="hero-goa"
          src="/brand/goa_hindi.svg"
          alt={EVENT.deva}
          width={154}
          height={152}
        />
      </h1>

      <p className="hero-meta">
        {EVENT.location} &nbsp;·&nbsp; {EVENT.datesLong}
      </p>
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <Hero />

      <p className="mx-auto mt-10 max-w-xl text-balance px-4 text-center text-sm text-[var(--cream)]/70 sm:px-6 sm:text-base">
        Upload a photo, get your Builder ID or a matching profile-picture frame.
        Download it, post it with{" "}
        <span className="font-semibold text-[var(--pink)]">{EVENT.hashtag}</span>. No
        login, no waiting.
      </p>

      <div className="mt-8">
        <Generator />
      </div>
    </main>
  );
}

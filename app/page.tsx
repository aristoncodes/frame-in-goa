import Generator from "@/components/Generator";
import { EVENT } from "@/lib/brand";

export default function Home() {
  return (
    <main>
      <header className="mx-auto w-full max-w-6xl px-4 pb-2 pt-10 text-center sm:px-6 sm:pt-14">
        <p className="text-[11px] font-bold tracking-[0.3em] text-[var(--gold)] sm:text-xs">
          {EVENT.location} · {EVENT.dates}
        </p>

        <h1 className="relative mt-3 inline-block font-display text-[clamp(2.6rem,11vw,5.5rem)] leading-[0.82] tracking-tight text-[var(--gold)]">
          HACKER
          <br />
          HOUSE
          <span
            aria-hidden
            className="font-deva absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] text-[clamp(2rem,8.5vw,4.2rem)] text-[var(--pink)]"
            style={{ textShadow: "0 0 22px rgba(230,25,122,0.75), 3px 3px 0 #b00f5c" }}
          >
            {EVENT.deva}
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-balance text-sm text-[var(--cream)]/70 sm:text-base">
          Upload a photo, get your Builder ID or a matching profile-picture frame.
          Download it, post it with{" "}
          <span className="font-semibold text-[var(--pink)]">{EVENT.hashtag}</span>. No
          login, no waiting.
        </p>
      </header>

      <div className="mt-8">
        <Generator />
      </div>
    </main>
  );
}

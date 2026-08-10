# Frame in Goa — Hacker House Goa 2026 ID & PFP generator

Upload a photo, get an on-brand **Hacker House Goa 2026** graphic in a second or
two, download the PNG, and post it with **#FrameInGoa**. No login, no signup, one
pass start to finish.

Two formats share one upload/crop/HEIC pipeline:

| Mode | Output | Notes |
| --- | --- | --- |
| **Builder ID Card** | 1080×1350 poster | Double-sided — front carries the photo, name, stack, generated builder title and a real CODE128 barcode; back carries the brand lockup |
| **PFP Frame** | 1080×1080 | Gold/pink ring, arced wordmark on a text path, गोवा sticker badge |

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run preview      # render every output to scripts/out/*.png (no browser needed)
npm run e2e          # drive the real flow in a phone-sized Chromium
```

`npm run e2e` needs the app running and a fixture directory containing
`test.heic` and `landscape.jpg`:

```bash
npm run build && npm run start &
npx tsx scripts/e2e.ts http://localhost:3000 ./fixtures
```

## How the graphics are made

Everything is **drawn in code** — no reference image is composited in as a flat
asset — so text stays live and the output is crisp at any resolution.

```
lib/brand.ts            colour / type / event tokens (single source of truth)
lib/render/primitives   starbursts, squiggles, paper grain, tracked text,
                        text auto-fit, cover-fit with focal point, गोवा badge
lib/render/motifs       poster backdrop, mirrored headline, lanyard + metal
                        clip, discipline icon chips, CODE128 barcode, card shell
lib/render/idcard       front + back composition (1080×1350)
lib/render/pfp          profile-picture ring (1080×1080)
lib/builderTitle        builder-title generation + which icon chips light up
```

The renderers take a plain canvas 2D context, so the **exact same code** runs in
the browser and in `scripts/preview.ts` under `@napi-rs/canvas`. That is what
makes composition changes reviewable without a browser.

Type is served from `public/fonts/*.woff2` (Fraunces for display, Yatra One for
the Devanagari wordmark, Inter for utility text) rather than `next/font`, because
canvas needs to reference the families by literal name and the offline harness
loads the same files.

### Handling real photos

- **HEIC/HEIF** from iPhone is converted client-side via `heic2any` before
  anything touches it, with a fallback to native decoding for browsers that
  already understand HEIC.
- EXIF orientation is honoured (`createImageBitmap(..., { imageOrientation })`).
- Anything over 1800px on its longest edge is downscaled once on upload, so
  typing in the form doesn't re-composite a 48MP bitmap.
- Portrait, landscape and off-centre photos all cover-fit into the frame, and
  **drag to reposition / pinch to zoom** lets the user fix the crop.

### Builder titles

`<vibe adjective> <role-flavoured noun>`, biased by keywords in the stack/role
(`AI → Whisperer`, `Web3 → Chain Smith`, …) with a generic pool behind it so an
unlisted stack never looks broken. Deterministic on the inputs, with a **Reroll**
that salts the seed.

## Share to X

1. **Web Share API** with the PNG attached — what most phones get.
2. Otherwise the PNG is stored in Vercel Blob and X opens with a link to
   `/s/<id>`, whose `og:image` / `twitter:image` **is the generated graphic**
   (`summary_large_image`), so the preview is never a blank thumbnail.
3. If blob storage isn't configured, the PNG downloads and X still opens with the
   caption pre-filled to attach it to.

Every path builds its caption through `buildCaption()`, so **#FrameInGoa** can't
be dropped.

## Deploying

```bash
npx vercel login
npx vercel --prod
```

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | for share links | Vercel Blob store. Create a Blob store in the Vercel dashboard and it is injected automatically. Without it, share falls back to download + pre-filled tweet. |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical origin for metadata. Defaults to the Vercel production URL. |
| `NEXT_PUBLIC_LOGO_URL` | no | Point at the official HH Goa lockup to use that artwork as-is on the card back. Unset, the back draws the wordmark from the same type system as the rest of the poster. |

After deploying, check the link preview with
[cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator) or by
pasting a `/s/<id>` URL into a draft post.

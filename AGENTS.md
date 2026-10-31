# Product video workflow for coding agents

Use this repository to produce a clear product-feature video from the real app, then assemble
optional opening and closing scenes and background media. This workflow applies to Codex, Claude,
and other coding agents.

## Project customization

- Treat `VIDEO` in `scripts/config.mjs` as the agent-facing customization contract. Read it before
  changing a video, and edit it for brand, logo, chapter order, intro/outro, media, and output path.
- Keep recording behavior in `scripts/lib.mjs` separate from project branding and media choices.
- Match the product's actual visual identity. Never use indigo, violet, or purple as defaults; use
  them only when the user specifies them.
- Keep `intro`, `outro`, and `music.src` null when the user has not asked for them. Do not invent
  brand claims, URLs, or a call to action.
- Local asset paths are relative to the project root. For AI-generated artwork, create the asset
  only when requested, save it under the project's `assets/` directory, then reference that path.
- For Unsplash, use a direct image asset URL, not a photo webpage. For video and music URLs, use
  direct media URLs. Prefer local copies for repeatable exports.
- Do not silently replace user assets or delete existing chapter videos.

## Record, assemble, review

1. Inspect `scripts/config.mjs`, the app-specific `chapters.mjs`, and existing chapter MP4s.
2. Record only the requested chapters with `node run.mjs <chapter-id>` when a new capture is needed.
3. Assemble the configured chapter order with `node scripts/assemble.mjs`.
4. Review the exported MP4 itself: check its dimensions and duration, inspect frames from the
   beginning, middle, and end, and listen for narration/music balance. Compare a soft-looking frame
   with the source chapter to distinguish capture softness from export softness.
5. Report the output file path and any remaining limits. Never claim the video was reviewed if
   only the source chapter or a screenshot was inspected.

When the project has no real chapters or media yet, use a clearly labeled fixture as a preview and
say that it does not verify the user's product footage, narration, or soundtrack.

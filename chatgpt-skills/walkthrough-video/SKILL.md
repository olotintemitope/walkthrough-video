---
name: walkthrough-video
description: Create, record, test, and review clear product walkthrough videos from a real web or Electron app. Use when asked for a product demo, feature tour, onboarding video, UI recording, or to fix camera, zoom, cursor, or recording quality issues. Also supports optional intros, outros, music, and image or video backgrounds.
---

# Product walkthrough videos

Use this skill with the user's application repository open in a coding workspace. Work from the
real app when possible, and use a clearly labeled fixture when the app is unavailable. A fixture
can prove the recorder flow; it cannot prove the user's product UI, data, narration, or soundtrack.

## Start with the repository

1. Inspect `README.md`, `AGENTS.md`, `SKILL.md`, `scripts/config.mjs`, `scripts/lib.mjs`, and the
   app-specific chapters before changing the recording flow.
2. Treat `VIDEO` in `scripts/config.mjs` as the customization interface for brand, logo, chapter
   order, intro and outro, optional media, soundtrack, dimensions, and final output path.
3. Read the existing chapters, recordings, fixtures, and user-provided assets before replacing
   anything. Keep product actions and recording mechanics separate from branding choices.
4. If the app is not already running, use the project's documented local start command. Use
   realistic test data and a local or test environment; never record actions against production.

## Build and record the walkthrough

- Follow the user's requested feature and audience. Write a short sequence that explains the
  outcome, demonstrates the feature, and verifies the result in the UI.
- Use the app's real accessible labels and selectors. Survey the UI when the project provides a
  survey script; do not invent selectors when the page can be inspected.
- Use the repository's recording helpers for real clicks, typing, cursor motion, zoom, captions,
  and narration. For long forms, keep related field edits together when that makes the camera
  movement easier to follow.
- Keep the pointer aligned with the real input. Let the camera finish returning to a wide view
  before aiming at a different area. Check the full frame during transitions, especially when
  moving between a sidebar, a wide form, and a small control near an edge.
- For form typing softness, inspect the actual recording frames. Do not claim post-processing can
  recover detail that was absent from the captured source.
- Add an intro, outro, soundtrack, or background only when requested. Keep optional scenes at the
  duration the user specifies; don't invent product claims, logos, music, or external media.
- If asked to generate artwork, use the available image-generation capability and save the result
  in the project before referencing it. If asked for Unsplash or a URL, use a direct media URL and
  check that it is accessible to the assembly workflow.

## Test and review the exported video

1. Run the requested browser recording or project chapter command. A recording is part of the
   test: assert that expected UI state changed, form submission succeeded, and the camera returned
   to a stable wide view.
2. When checking edge behavior, sample the stage bounds during transitions. Confirm that the app
   continues to cover the video frame and that zooming out doesn't sweep toward a screen edge.
3. Assemble the configured export when requested, then inspect the exported MP4 itself. Check
   dimensions, frame rate, duration, and representative frames from the beginning, middle, and
   end. Listen to the audio when narration or music is present.
4. Compare a soft-looking frame against the source recording to locate whether softness entered
   during capture or export. Report remaining limits honestly.
5. Give the user the full path to the final MP4 and concise test results.

## Guardrails

- Never expose passwords or secrets in visible typing, captions, logs, or sample data.
- Do not modify production data. Ask before external publication or other irreversible actions.
- Preserve existing recordings and assets unless the user asks to replace them.
- Don't claim a recording, test, assembly, or visual review happened unless it actually ran.
- If a required app, browser, dependency, or permission is unavailable, state the blocker and give
  the exact next step rather than reporting an unverified result.

# Prompts for coding agents

Copy a prompt into Codex, Claude, or another coding agent with this repository open. Replace the
bracketed details with your product information. The repository's `AGENTS.md` and `SKILL.md` remain
the source of project rules; these prompts provide task requests you can adapt.

## Record a product feature

```text
Create a clear product walkthrough video for [feature] in [app]. The audience is [audience], and
the main takeaway should be [outcome]. Inspect the app and the existing chapters first. Use a local
or test environment, record the real UI, complete the feature workflow, and verify the result on
screen. Keep narration concise and synchronized with the actions. Run the recording, assemble the
video, inspect the exported MP4, and give me its full file path plus the checks you performed.
```

## Investigate camera, zoom, or pointer problems

```text
Investigate the reported recording issue: [describe the issue and approximate timestamp]. Reproduce
it in a browser recording with a representative layout. Check the full video frame during zoom and
pointer movement, especially near the viewport edges. Fix the underlying cause, rerun the recording,
and inspect the resulting video at the problem timestamps. Report the exact file changed, the test
recording path, and what you verified.
```

## Add an intro, outro, or motion treatment

```text
Customize this product video with [intro/outro/both], using this exact copy: [copy]. Use [brand
colors and assets], with [music or background media, if any]. Choose restrained, professional
motion that supports the product story. Available card layouts are editorial, split, and closing;
the intro and outro can use different layouts. Available card entrances are fade-up, slide-left,
pop, and none. Available clip
transitions and durations are documented in README.md. No indigo, violet, or purple by default
unless I explicitly request one. Configure scripts/config.mjs, assemble the final video, inspect
the exported MP4, and give me its full file path.
```

## Improve an existing video

```text
Review the current product walkthrough for clarity, pacing, visual quality, and whether each feature
is actually completed on screen. Identify specific problems with timestamps, then fix the highest
impact issues. Preserve existing user assets and product branding. Run the affected recording and
assembly steps, inspect the exported video, and summarize the changes with the full output path.
```

## Build a test layout for an edge case

```text
Create or use a representative test layout with [sidebar / wide form / modal / dense table / other]
to reproduce [edge case]. Record the real browser interaction at the configured output quality.
Verify that the pointer stays aligned, the full app remains in frame, and zoom returns to the wide
view before moving to another target. Save the recording as a clearly named fixture and report its
full path and the behavior you verified.
```

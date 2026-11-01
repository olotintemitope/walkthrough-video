# Video quality gate

Run this gate before presenting or publishing a product video. A correct MP4 filename or 4K
container alone does not prove the captured interface has 4K detail.

## 1. Verify the source and export

After recording and assembling, run the metadata and decode check against the final MP4. When the
recording source is available, compare it too:

```bash
node scripts/check-video-quality.mjs path/to/final.mp4 --source path/to/source-capture.mp4
```

The command checks the export dimensions against `VIDEO.width` and `VIDEO.height` in
`scripts/config.mjs`, requires at least 24 fps, verifies duration, decodes all audio and video
streams, and fails if the source capture is smaller than the export. Set `RENDER_SCALE` and the
delivery dimensions before recording. Never describe upscaled footage as native 4K. For example,
3840×2160 delivery requires a 3840×2160 source capture, not a 1920×1080 capture enlarged during
assembly.

For a one-off render whose dimensions differ from the shared config, pass `--width` and `--height`
to check the actual delivery size. The assembler checks each selected chapter before scaling and
stops if the source is smaller than the configured delivery frame.

## 2. Review the actual exported MP4

Metadata cannot judge focus, motion, or composition. Inspect frames extracted from the final MP4 at
the beginning, a representative feature interaction, and the end. Include a form while text is
being typed, at least one zoom-in and zoom-out, and any edge-sensitive layout when those appear in
the video. Review at native output size when possible; do not judge quality from a chat preview or
a resized thumbnail alone.

Check that:

- Text, icons, pointer edges, and form content are readable and stable during typing and motion.
- Zooms keep the relevant content in frame, return fully to the wide view before changing targets,
  and do not expose blank edges or drift toward a screen edge.
- The UI fills the frame without stretching, cropping important controls, or unexpected bands.
- Intro, transitions, and outro are clean, correctly timed, and do not obscure product content.
- There are no unintended frozen frames, long empty pauses, or moments where narration describes a
  control that is not visible.
- Narration is clear and leads the music. Listen to the beginning, middle, and end, including a
  section with speech over music and a music-only section.

If a frame looks soft, compare that same moment with the source capture. If softness is already in
the source, record again with a suitable browser capture size and layout. Sharpening or enlarging
after capture does not restore missing detail.

## 3. Report evidence

Before delivery, record the final path, resolution, frame rate, duration, whether the source passed
the resolution comparison, and which visual and audio sections were reviewed. Do not say the video
was checked unless the exported MP4 itself was inspected.

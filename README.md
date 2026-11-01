# walkthrough-video

Create a clear, narrated product video from a real web or Electron app. Playwright drives the
workflow while the recorder captures the app, visible pointer, zooms, captions, and voiceover. Then
assemble the footage into one branded MP4 with optional intro, outro, images, video, and music.

Built for coding agents such as Codex and Claude. The scripts can also be run directly.

## Start here

**Using a coding agent?** Give it this repo and ask it to make a product-feature video. For example:

> Use the walkthrough-video skill in this repository to make a clear product video of the app at
> `http://localhost:3000`. Inspect the app first, choose one customer goal, record the complete
> workflow, write concise product-led narration, assemble a branded 1080p MP4, and review the
> exported video for sharpness, pacing, zooms, and audio balance. Ask me for brand assets if needed.

See [more agent prompts](docs/agent-prompts.md), the [Codex/Claude instructions](SKILL.md), or the
[ChatGPT skill ZIP](chatgpt-skills/walkthrough-video-chatgpt.zip).

**Want to see examples first?** Open the [Daymark todo app and promo](fixtures/todo-reminder/README.md)
or the [SignalDesk AI demo and 4K promo](fixtures/signaldesk/README.md). There is also a short
[1080p motion sample](fixtures/camera-check/motion-showcase-1080p.mp4).

## Make a video of your app

### 1. Install the tools

You need Node.js 18+, FFmpeg, a local copy of the app you want to film, and an OpenAI API key for
narration. From this repository, install the project and Playwright:

```bash
npm install
npm install playwright-core
npx playwright-core install chromium
```

Install FFmpeg with your system package manager (`brew install ffmpeg` on macOS, or your Linux
distribution's package manager). Confirm `ffmpeg` and `ffprobe` run from a terminal. Install `curl`
if you plan to use remote image, video, or music URLs.

Set the OpenAI key in your terminal before recording:

```bash
export OPENAI_API_KEY='your-api-key'
```

### 2. Point the recorder at your app

Start your app locally, then edit `scripts/config.mjs`. Set `START_URL`, login details, and the
selectors for your app. The provided values are examples and will not match your product. Record
against a local or disposable demo account because a chapter can create or update records.

If the app uses a local SQLite database, set `DB.live` and save a clean copy as `DB.baseline` so
each take starts with the same data. Set `DB.live` to `null` when there is no database to reset.

### 3. Inspect the app and plan the story

Survey the real controls before writing selectors:

```bash
node scripts/survey.mjs --limit 8
node scripts/survey.mjs --drawers Products
```

Copy `chapters.example.mjs` to `chapters.mjs`, then adapt a chapter to one customer goal. Explain
why the feature helps, show the complete action, and confirm the result on screen. A chapter that
only opens a form does not demonstrate the feature.

### 4. Record the chapter

```bash
node scripts/run.mjs                  # record every chapter
node scripts/run.mjs ch06-add-product  # record a matching chapter only
```

Chapter videos are written to `mp4/`. The recorder adds captions and OpenAI narration. Voice clips
are cached, so unchanged lines do not need to be generated again.

### 5. Brand and assemble the finished video

Edit the `VIDEO` block in `scripts/config.mjs`. Set the brand, logo, intro/outro, transitions, music,
chapter order, and output path. Use your own brand assets, direct media URLs, or an image you asked
an agent to create. Keep `intro`, `outro`, or `music.src` as `null` to omit them.

```bash
node scripts/assemble.mjs
```

The finished video is written to `VIDEO.output` (default: `mp4/product-tour.mp4`). Review the
exported MP4 itself before publishing: check the opening, a feature action, the ending, and the
narration/music balance.

Run the automated metadata/source check first, then complete the required visual and audio review:

```bash
node scripts/check-video-quality.mjs mp4/product-tour.mp4 --source recording/product-tour-silent.mp4
```

The source argument is optional when no source capture is retained. The check compares the source
capture with the configured delivery size, so a 4K export enlarged from a 1080p recording fails.
The assembler also checks every selected chapter's source dimensions and stops instead of silently
upscaling a chapter to the delivery size.
The [video quality checklist](docs/video-quality-checklist.md) covers sharpness while typing,
zoom framing, edge coverage, pacing, and sound. Agents must review the exported MP4 itself; passing
metadata checks alone is not enough.

## Customize the look and sound

- **Brand:** Set `VIDEO.brand` and `VIDEO.logo`; provide brand colors and fonts if you have them.
  The recorded app keeps its own visual identity.
- **Intro and outro:** Set the title, subtitle, duration, and optional image or video background.
  Keep the copy short enough to read comfortably.
- **Music:** Set `VIDEO.music.src` to a local audio file or direct audio URL. Adjust `volume`,
  `fadeIn`, and `fadeOut` so narration stays clearly louder.
- **Motion:** Choose `fade-up`, `slide-left`, `pop`, or `none` for title text. Card layouts include
  `editorial`, `split`, and `closing`; see the [layouts guide](docs/layouts.md).
- **Transitions:** Choose a supported FFmpeg transition in `VIDEO.transition`. A fade or direct cut
  keeps attention on the product.
- **Zoom and pointer:** The camera follows the pointer and returns to the wide view between targets.
  Use `{ stay: true }` to hold a zoom across related actions, then call `wide(win)` before moving on.

### Choose the output resolution

The default export is 1920×1080. For a native 4K desktop browser recording, keep the app layout at
1920×1080 and change these settings in `scripts/config.mjs`:

```js
export const SIZE = { width: 1920, height: 1080 }
export const RENDER_SCALE = 2

export const VIDEO = {
  width: 3840,
  height: 2160,
  // keep your other VIDEO settings here
}
```

This renders the browser viewport and animated title cards at 3840×2160 while preserving the app's
1920×1080 layout. It takes longer and produces larger files. Choose the resolution before recording;
converting a 1080p video to 4K only enlarges existing pixels and cannot restore fine detail. This
setting is for web browser captures; Electron uses the app window's recording dimensions.

Match the product's real brand. Indigo, violet, and purple are not defaults; use them only when
requested.

## Using the skills

- **Codex:** Follow `SKILL.md` in this repository or copy it into your project's `.agents/skills/`
  directory.
- **Claude:** Copy the skill to `.claude/skills/walkthrough-video/` in your project.
- **ChatGPT:** Upload `chatgpt-skills/walkthrough-video-chatgpt.zip` using the Skills upload flow.

## Supported apps

| App | Support |
| --- | --- |
| Web app | Any local URL, including Laravel, Rails, Django, and SPAs |
| Electron app | A packaged desktop app |
| Mobile web | Playwright device emulation with a real mobile viewport and touch events |

Mobile emulation records mobile web, not native iOS or Android apps. Native apps need a different
automation tool such as Appium.

For agent workflow details, see `AGENTS.md`. For sample requests, see [agent prompts](docs/agent-prompts.md).

## Licence

MIT.

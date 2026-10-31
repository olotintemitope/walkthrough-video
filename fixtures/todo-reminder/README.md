# Daymark todo and reminder demo

Daymark is a self-contained browser demo built for the walkthrough-video promo. It lets a user add
tasks with a due date, time, priority, and reminder timing; mark tasks complete; and browse Today,
Upcoming, and Completed views. Tasks persist in that browser's local storage. The reminder preview
shows the in-app notification treatment. Scheduled in-app and desktop reminders run while the page
is open; desktop notifications also require browser permission. This fixture has no server-side
account sync or background scheduler.

## Open the demo

From the repository root, serve this folder with any local static file server. For example:

```bash
python3 -m http.server 8765 --directory fixtures/todo-reminder
```

Then open `http://127.0.0.1:8765/`.

## Re-record and assemble the promo

Install the project's Node dependencies and ensure `ffmpeg`, `ffprobe`, and `OPENAI_API_KEY` are
available. The promo uses OpenAI text to speech for the product walkthrough and matching captions.
The branded intro and outro stay quiet, with no spoken lines. Then run:

```bash
node scripts/record-todo-promo.mjs
```

The script launches a local browser, records the working UI at 1920×1080, demonstrates adding a
scheduled task, previews its reminder, marks the task complete, and assembles branded animated
intro and outro cards. Narration plays over the product walkthrough only. The title cards are quiet.
The Live Edit mark and blue brand color are applied to
both cards and the app UI. The logo asset is `assets/live-edit-mark.png`.
The finished MP4 is `fixtures/todo-reminder/daymark-todo-reminder-promo-1080p.mp4`, encoded as
1080p H.264 video with OpenAI AAC narration over the app footage and fast-start metadata for web playback.

# SignalDesk AI product demo

SignalDesk is an interactive product concept for an AI startup. It shows how a product team can
bring support conversations, customer interviews, and product feedback together, review emerging
themes with their evidence, and turn a theme into a product brief.

The app is a self-contained browser prototype with sample customer data. Its recommendation and
brief creation are a scripted demo; it does not connect to real customer sources or call a model.
The walkthrough presents the product idea and its intended customer workflow.

## Preview the app

From the repository root:

```bash
python3 -m http.server 8765 --directory fixtures/signaldesk
```

Open `http://127.0.0.1:8765/`.

## Record the product tour

Set `OPENAI_API_KEY` in the shell or create a private, git-ignored `.env.local` in the repository
root. If the key is already exported in your terminal, this command copies it locally without
putting the key in shell history:

```bash
umask 077
printf 'OPENAI_API_KEY=%s\n' "$OPENAI_API_KEY" > .env.local
```

Then run:

```bash
node scripts/record-signaldesk-promo.mjs
```

The recorder captures the app at 1920×1080, narrates the customer problem, evidence, recommendation,
and action brief with OpenAI TTS, and uses the downloaded Mixkit track “Digital Clouds” by Alejandro
Magaña (A. M.). Mixkit’s Stock Music Free License allows use in commercial projects and YouTube
videos. Music is fuller on the one-second intro and outro cards and lowers under narration while
continuing through pauses. The normalized soundtrack is mixed at 0.22× under narration and 0.45×
on the music-only title cards, keeping the spoken presentation clearly in front. Track page:
https://mixkit.co/free-stock-music/electronic/. License:
https://mixkit.co/license/modal/musicFree/. The downloaded MP3 is in `assets/`. The finished H.264/AAC
video is `fixtures/signaldesk/signaldesk-product-tour-1080p.mp4`.

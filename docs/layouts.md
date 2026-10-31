# Video layouts

This project has two different kinds of layout: the title cards added during assembly, and the app
pages shown in the recorded footage. They are configured and produced differently.

## Built-in title-card layouts

Intro and outro scenes can each select a layout with their `layout` property. Three compositions are
built in:

| Layout | Composition | Good for |
| --- | --- | --- |
| `editorial` | Left-aligned title, subtitle, slim guide, accent marker, and brand at the foot | A restrained opener or chapter card |
| `split` | Copy on the left and a designed task-list panel on the right | Introducing a product beside a feature visual |
| `closing` | Centered white typography on deep evergreen with a fine rule and centered brand | A composed, visually distinct outro |

The editorial layout contains:

- A kicker, such as `PRODUCT WALKTHROUGH` (or a custom `kicker` on the scene).
- A large title and supporting subtitle.
- A slim brand-colored marker and guide line.
- A brand name and optional logo near the bottom.
- A solid neutral background, an image background, or a video background.

Set `VIDEO.brand`, `VIDEO.logo`, `VIDEO.motion.accent`, `VIDEO.intro`, and `VIDEO.outro` in
`scripts/config.mjs` to customize title cards. The intro and outro may use different compositions.
The card entrance is separately controlled by `VIDEO.motion.card`: `fade-up`, `slide-left`, `pop`,
or `none`. Setting a scene to `null` omits that card.

Example:

```js
brand: 'Northstar',
logo: './assets/northstar-logo.png',
motion: { card: 'fade-up', accent: '#d9623e' },
intro: {
  layout: 'split',
  kicker: 'A BETTER WAY TO PLAN',
  title: 'Meet Northstar',
  subtitle: 'Plan thoughtful work together',
  duration: 2.5,
  background: { type: 'image', src: './assets/intro.jpg' },
},
outro: {
  layout: 'closing',
  title: 'Make room for what matters.',
  subtitle: 'Your tasks, in good time.',
  duration: 2.5,
},
```

## Product-screen layouts

The recorded chapters show the real app in the browser viewport. Their layout comes from the app
itself, not from a video template. Examples include a sidebar with a settings form, a registration
form, a profile page, a dashboard, a modal, or a multi-column workspace. The recorder follows the
pointer and frames the elements being demonstrated; it does not rearrange the product UI.

Use your actual app for the final walkthrough. The repository's `fixtures/camera-check/` pages are
test layouts for recording and camera checks, not themes to apply to another product:

| Fixture | Layout represented |
| --- | --- |
| `project-settings.html` | Product settings with a fixed sidebar, tabs, two-column form, and summary panel |
| `sidebar-form.html` | Dense navigation plus a wide form, useful for zoom and screen-edge checks |
| `registration-profile-1080p.mp4` | Registration and long-profile recording example |
| `product-editor.html` | Product editor screen used in the motion showcase |

## Other title-card designs

Full-bleed product imagery and logo-focused openers can be added for a project when the built-in
options do not fit. Ask the agent to implement the composition as a selectable layout, preserve the
brand's typography and colors, and render and inspect a sample before using it in the full export.

Example request:

```text
Add a selectable `full-bleed` intro/outro layout alongside `editorial`, `split`, and `closing`. Keep
the existing layout as the default, use my brand assets and colors, and make the product image fill
the frame behind legible copy. Update the config documentation and agent prompts, then render and
inspect a sample video at the configured resolution.
```

# Happy Tiger 🐯

A lighthearted little fitness companion, built as a birthday gift. It's a static
website designed to be added to an iPhone home screen, where it behaves like a
real app (full-screen, its own icon, works offline).

## What it does

- **Today tab** — shows the day's plan: pilates, shoulder physio, netball,
  yoga/stretch, the Sunday sprint session with Dougall, and a slow casual run
  with a gentle, ever-so-slowly increasing distance goal (starts at 3km).
- **Recovery weeks** — every few weeks (configurable) the app flags a lighter
  "recovery week" and the run goal doesn't increase.
- **Period days** — a configurable day-of-month range (defaults to 12th–16th)
  is automatically treated as full rest, no exercise, no guilt.
- **Monday is a real rest day** — no training tasks, just physio.
- **Sleep + steps** — quick tap-to-log sleep score and a steps field (meant to
  be copied over from the Apple Watch/Fitness app — see note below).
- **Wellness tab** — weekly reading nudge, weekly swim reminder that only
  shows up if she hasn't swum yet that week, and a few tips on using the
  Apple Watch alongside the app.
- **Week tab** — the whole week at a glance, with completed tasks ticked off.
- **Settings tab** — period dates, recovery-week frequency, starting run
  distance and step goal are all editable, plus a full data reset.
- Every completed task pops up a random encouraging message (yellow, tiger,
  zero pressure — nothing here nags, guilt-trips, or shows streak-shaming).

## About Apple Watch syncing

Apple doesn't expose HealthKit (steps, sleep, workouts) to regular websites —
that data is only available to native iOS apps, so a home-screen web app like
this one genuinely cannot pull it in automatically. Instead:

- The Watch's own **Workout app** already tracks pilates/netball/sprints/yoga
  sessions with heart rate — no need to duplicate that here.
- Sleep is tracked automatically by watchOS; Happy Tiger just asks for a
  1-tap score each morning so there's a nice simple log in one place.
- Steps can be glanced at in the iPhone Fitness app and typed in — takes a
  couple of seconds, no faffing about.

If real auto-sync ever becomes worth the effort, the practical route is an
iOS Shortcuts automation that reads HealthKit and posts to a small backend —
that's a bigger project than a static site and wasn't built here.

## Hosting it

This is a plain static site (`index.html` + `css/` + `js/`) — no build step.
Easiest option: GitHub Pages.

1. In this repo on GitHub: **Settings → Pages → Deploy from a branch**, pick
   this branch and the root folder.
2. Open the resulting URL on her iPhone in Safari.
3. Tap the **Share** button → **Add to Home Screen**.

She'll get a yellow tiger icon on her home screen that opens full-screen, and
it keeps working without signal thanks to the small offline cache.

## Customizing

Everything schedule-related lives in `js/schedule.js` (tasks per weekday,
sprint session details, encouragement messages). Logic and rendering are in
`js/app.js`. Nothing needs a server or a build tool — edit and refresh.

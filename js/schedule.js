// Static weekly plan data for Happy Tiger.
// Each day is an array of task objects. Distance goals / week-dependent
// text get filled in at render time by app.js (see TOKEN placeholders).

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WEEKLY_PLAN = {
  // Monday — her big work day, so it's a real rest day.
  1: [
    { id: 'rest-day', kind: 'info', icon: '☕', title: 'Rest day', subtitle: 'Big work day today — feet up, tiger. No training, no guilt.' },
    { id: 'physio-mon', kind: 'check', icon: '💪', title: 'Shoulder physio', subtitle: 'Your usual rehab set — you know it better than anyone.' },
  ],
  // Tuesday — required pilates
  2: [
    { id: 'pilates-tue', kind: 'check', icon: '🧘‍♀️', title: 'Pilates', subtitle: 'This week\'s pilates session.' },
    { id: 'physio-tue', kind: 'check', icon: '💪', title: 'Shoulder physio', subtitle: 'Your usual rehab set.' },
  ],
  // Wednesday — yoga / stretch day
  3: [
    { id: 'yoga-wed', kind: 'check', icon: '🌤️', title: 'Yoga / stretch', subtitle: 'Slow it down, breathe, stretch it out.' },
    { id: 'physio-wed', kind: 'check', icon: '💪', title: 'Shoulder physio', subtitle: 'Your usual rehab set.' },
  ],
  // Thursday — netball night + massage after
  4: [
    { id: 'physio-thu', kind: 'check', icon: '💪', title: 'Shoulder physio', subtitle: 'Your usual rehab set — get it done before netball.' },
    { id: 'netball-thu', kind: 'check', icon: '🏐', title: 'Netball', subtitle: 'Thursday night netball.' },
    { id: 'massage-thu', kind: 'check', icon: '💆‍♀️', title: 'Recovery massage', subtitle: 'After netball — Dougall\'s got you covered. Tick it off once you\'ve had it.' },
  ],
  // Friday — optional bonus pilates
  5: [
    { id: 'pilates-fri', kind: 'check', icon: '🧘‍♀️', title: 'Bonus pilates', subtitle: 'Totally optional — only if you\'re feeling it.', optional: true },
    { id: 'physio-fri', kind: 'check', icon: '💪', title: 'Shoulder physio', subtitle: 'Your usual rehab set.' },
  ],
  // Saturday — slow, easy, casual run with a gentle distance ladder
  6: [
    { id: 'casual-run', kind: 'check', icon: '👟', title: 'Easy run', subtitle: '{{RUN_GOAL}}' },
    { id: 'physio-sat', kind: 'check', icon: '💪', title: 'Shoulder physio', subtitle: 'Your usual rehab set.' },
  ],
  // Sunday — structured sprint session with Dougall
  0: [
    {
      id: 'sprint-sun',
      kind: 'check',
      icon: '⚡',
      title: 'Sprint training with Dougall',
      subtitle: '10 min warm-up jog + dynamic drills, then 8–10 x 40–60m @ 90–100% effort, 2 min rest between reps, finish with agility work.',
    },
    { id: 'physio-sun', kind: 'check', icon: '💪', title: 'Shoulder physio', subtitle: 'Your usual rehab set.' },
  ],
};

const ENCOURAGEMENTS = [
  'Nice work tiger, time to put those feet up 🐯💛',
  'love ya - duggydeath',
  "Grrreat job! Go relax, you've earned it.",
  "That's my tiger. Kettle's on, feet up.",
  'Stripes on point today 🐅✨',
  'Look at you go! So proud of you, love.',
  'One more done — no pressure, just vibes.',
  "You're doing amazing, sweetheart. Rest up.",
  'Tiger stamp of approval ✅🐯',
  'Ell oh vee ee. Go relax now.',
  "That's it, easy does it. See you on the couch.",
  'Absolute unit. Go put your feet up, tiger.',
];

const PERIOD_MESSAGES = [
  "Period days — no organised exercise. Anything you do today is a bonus, not a requirement 🫶",
  "Nothing's on the plan today. If you feel like moving, lovely — if not, that's perfect too 💛",
  "Your body's doing enough work already. Whatever you do today is a bonus, tiger 🐯",
];

const GREETING_MESSAGES = {
  morning: 'Good morning - duggydeath 🐯',
  midday: 'Happy midday, tiger ☀️',
  night: 'Sweet dreams - show Gigi and Teddy some love for me 🐾💛',
};

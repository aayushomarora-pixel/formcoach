# FormCoach — Design Direction

## Three stylistic approaches

### Theme Name: Studio Kinetics
Very light, editorial training software with warm paper surfaces, deep ink typography, and an ownable vermilion signal color. It makes form feedback feel like a calm coach's studio notes rather than a gamified scoreboard.

Probability: 0.087

### Theme Name: Night Range
A dark athlete-console direction with fluorescent safety yellow, motion trails, and dense telemetry. It feels focused, technical, and built for late-night training sessions.

Probability: 0.064

### Theme Name: Field Manual
A utilitarian, tactile field-guide direction with canvas neutrals, forest green, stamped labels, and instructional diagrams. It makes exercise technique feel practical, repeatable, and grounded.

Probability: 0.031

## Selected approach: Studio Kinetics

### Design Movement
Contemporary editorial wellness meets Swiss sports-poster design: disciplined typography, asymmetrical composition, clear measurement, and warmth through material rather than decoration.

### Core Principles
1. **Make the body legible.** Pose traces, angles, and status markers should read at a glance without looking like a science dashboard.
2. **Coach, do not scold.** Form feedback is specific and calm, with a clear next adjustment instead of a vague warning.
3. **Use editorial hierarchy.** Oversized numerals, compact labels, and intentional whitespace create an interface that feels authored.
4. **Progress is quiet confidence.** Reps and session history should celebrate consistency without turning movement into a game.

### Color Philosophy
The base is warm bone paper (#F3F0E9) with ink-black text (#171715), creating a low-glare studio feeling. A vivid vermilion (#E64E2E) owns the action state: it appears only where the user needs to move, start, or correct. A deep pine (#173C37) is reserved for confirmed good form and stable states. A washed clay (#E7D4C9) supports secondary surfaces, while muted graphite keeps metadata quiet. The emotional intent is grounded energy: alert enough to motivate, calm enough to focus.

### Layout Paradigm
An asymmetric split-console. A narrow editorial rail anchors the brand and session context on the left; the camera stage owns the center; a slim coaching column on the right delivers the latest cue, metric snapshots, and controls. On small screens the rail compresses into a top strip and the coaching column stacks below the camera.

### Signature Elements
1. **Vermilion motion marker:** small offset bars and corner notches that appear beside active controls and live states.
2. **Pose trace card:** a dark stage with a warm grid line, crisp landmark linework, and a bottom-edge status plate.
3. **Editorial index labels:** compact uppercase labels with numeric prefixes such as 01 / LIVE SIGNAL and 02 / FORM CUE.

### Interaction Philosophy
Every interaction should feel like a physical adjustment: buttons press inward, toggles slide with a short snap, and changing exercises updates the stage without a full-page transition. High-frequency tracking stays visually stable; only the state plate and key metrics respond. Feedback is persistent enough to act on, not so loud that it interrupts the set.

### Animation
Use fast, low-amplitude transitions: 160–220ms for controls, 260ms for panel reveals, and no looping decoration except the subtle live pulse on the camera status. When a rep increments, the large numeral briefly lifts by 2px and returns with a spring-like ease-out. The pose overlay should remain steady; bad-form cues can enter with a short opacity/translate transition. Respect reduced motion by disabling decorative pulses and rep count lift.

### Typography System
Use **DM Sans** for body copy, labels, and controls; use **Space Grotesk** for display numerals and section headlines. Display headlines are 700 weight with tight tracking (-0.045em). Labels are 11px, 700 weight, uppercase, 0.13em tracking. Body text is 14–16px with 1.45 line-height. Use tabular numerals for reps, angles, and time.

### Brand Essence
FormCoach is a live movement companion for people who want clearer technique without a trainer hovering over them; it turns a laptop camera into immediate, understandable coaching.

Personality: observant, steady, precise.

### Brand Voice
Headlines are direct and lightly editorial. CTAs are verbs that name the next physical action. Microcopy is specific, compact, and never overclaims what the model can see.

Example lines:
- "Find your line. Then own the rep."
- "Knees tracking inward — press them over the second toe."

### Wordmark & Logo
The mark is a bold, text-free monogram built from three offset vermilion bars: two vertical bars imply legs and a short horizontal bar implies the hip hinge. It should read as a compact movement diagram at favicon size and as a confident editorial stamp in the header.

### Signature Brand Color
**Vermilion Signal — #E64E2E.** It is the brand's ownable action color: warm, physical, and unmistakably directional without leaning into generic fitness neon.

## Implementation notes

- The landing view is the product itself: a live coach console rather than a marketing page.
- Demo mode must be available so the interface is still explorable when camera permissions are unavailable; camera mode remains the primary path.
- Exercise support starts with Squat and Push-up, with technique heuristics surfaced as transparent, local feedback.
- All high-level UI files should carry a short reminder comment referencing Studio Kinetics, warm paper surfaces, editorial hierarchy, and Vermilion Signal.
- Avoid centered marketing layouts, purple gradients, generic rounded-card dashboards, and fake testimonials.

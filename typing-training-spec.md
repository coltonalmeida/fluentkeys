# Typing Trainer — Letter Strength System: Full Implementation Spec

> **Purpose of this document:** A complete prompt and specification for building the core training logic of a keybr-inspired typing trainer. Covers the letter strength algorithm, unlock progression, word/pseudoword generation, session flow, and exactly what the user sees at every stage.

---

## 1. Core Mental Model

The trainer treats every letter key as a **skill with an independent strength score** (0–100). The user begins with a minimal set of starter keys. As they demonstrate consistent accuracy and speed on those keys, new keys unlock one at a time. Practice content is always generated from the **currently unlocked key pool**, but weighted heavily toward whichever keys are weakest — so the user is always grinding their problem areas without realizing it.

Three principles drive everything:

1. **Introduce before overload.** No new letter appears in content until the user has unlocked it.
2. **Weight toward weakness.** The weakest unlocked letter appears most frequently in practice text.
3. **Unlock through proof.** A key unlocks the next only after the user meets a consistent competence threshold across multiple samples — not a lucky streak.

---

## 2. Letter Strength Score

### 2.1 Per-Keystroke Data Collected

Every time the user presses a key (correctly or incorrectly) during a session, record:

```ts
type KeyEvent = {
  key: string;           // The expected character
  correct: boolean;      // Whether the user hit the right key
  reactionMs: number;    // Time from character appearing to keypress (ms)
  timestamp: number;     // Unix ms, for decay calculations
};
```

### 2.2 Strength Score Formula

Each letter maintains a rolling window of its **last 50 samples** (keystrokes). Strength is computed from three sub-scores, each normalized to 0–100:

#### Accuracy Score (weight: 50%)
```
accuracyScore = (correctPresses / totalPresses) * 100
```

#### Speed Score (weight: 35%)
Map reaction time to a 0–100 score using a sigmoid-like curve:

| Reaction Time | Speed Score |
|--------------|-------------|
| ≤ 150ms      | 100         |
| 200ms        | 90          |
| 300ms        | 70          |
| 500ms        | 45          |
| 800ms        | 20          |
| ≥ 1200ms     | 0           |

Formula approximation:
```
speedScore = clamp(100 - ((reactionMs - 150) / 10.5), 0, 100)
```
Use the **median** reaction time across the window (not average — median is more resistant to hesitation outliers).

#### Consistency Score (weight: 15%)
```
consistencyScore = clamp(100 - (stdDev(reactionTimes) / 8), 0, 100)
```
Low standard deviation = typing that key rhythmically = high consistency.

#### Final Strength
```
strength = (accuracyScore * 0.50) + (speedScore * 0.35) + (consistencyScore * 0.15)
```

### 2.3 Score Persistence and Decay

- Scores are **persisted to the database** after each session ends.
- If a key hasn't been practiced in **7+ days**, apply a daily decay of 0.5 points/day (capped at 20 points total decay). This keeps users returning.
- New users start all letters at **strength = 0**. Locked letters display as `—`.

---

## 3. Letter Unlock Progression

### 3.1 Unlock Threshold

A letter is considered **competent** (eligible to unlock the next) when:
- Strength score ≥ **75** AND
- Based on a minimum sample of **at least 30 keystrokes** in the rolling window

Only the **weakest unlocked letter** needs to exceed the threshold to trigger an unlock — the system doesn't require all current letters to be at 75, only that the user has brought their worst key up to an acceptable level.

### 3.2 Letter Tiers and Unlock Order

Letters unlock in a fixed sequence, ordered by: home row priority → finger load → English frequency. Pseudoword generation always uses letters from within the same tier, falling back to previous tiers.

```
TIER 1 — Starter Set (always unlocked from day 1)
  F  J

TIER 2 — Home Row Core
  D  K

TIER 3 — Home Row Expand
  S  L

TIER 4 — Home Row Complete
  A  ;

TIER 5 — Most Common Vowels
  E  I

TIER 6 — High Frequency
  T  N

TIER 7 — High Frequency
  O  R

TIER 8 — Upper Mid Frequency
  H  U

TIER 9 — Upper Mid Frequency
  C  M

TIER 10 — Mid Frequency
  G  B

TIER 11 — Mid Frequency
  P  W

TIER 12 — Lower Frequency
  Y  V

TIER 13 — Lower Frequency
  X  Q

TIER 14 — Rare
  Z
```

Within each tier, letters unlock **left-to-right** (e.g., F unlocks before J is introduced, but J is introduced almost immediately). When a tier is completed and all its letters are competent, the next tier's first letter is introduced.

> **Note to implementer:** The unlock sequence can be stored as a flat ordered array: `['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'e', 'i', 't', 'n', 'o', 'r', 'h', 'u', 'c', 'm', 'g', 'b', 'p', 'w', 'y', 'v', 'x', 'q', 'z']`. The user's `unlockedUpToIndex` is stored in the DB and incremented on each unlock event.

### 3.3 Newly Unlocked Letter Behavior

When a new letter unlocks:
- Its **frequency weight is set to maximum** (see Section 4.2) for the next 2 sessions to force early exposure.
- The keyboard UI flashes the new key with an unlock animation.
- A small toast appears: `"New key unlocked: [letter]"`.

---

## 4. Practice Content Generation

### 4.1 Content Strategy: Real Words First, Pseudowords as Fallback

Use a **pre-filtered word list** (e.g., top 10,000 English words). At session start, filter the word list to only include words made entirely from the user's unlocked letter set. If fewer than 20 eligible real words exist (common in early tiers), supplement with **procedurally generated pseudowords** — pronounceable letter sequences that feel like real words.

### 4.2 Word Selection Weights

Each eligible word is scored by how heavily it features the user's **weakest letters**. The selection process:

1. Compute each unlocked letter's **weakness score** = `100 - strength` (so weaker = higher weight).
2. For each candidate word, compute its **practice value**:
   ```
   practiceValue = sum(weaknessScore[letter] for each letter in word) / wordLength
   ```
3. Sample words **probabilistically** using `practiceValue` as the sampling weight — so words full of weak letters appear more often, but variety is maintained.

Words containing the **newest unlocked letter** receive a **2× weight multiplier** during the first two sessions after unlock.

### 4.3 Pseudoword Generation

When real words are insufficient (early tiers), generate pronounceable pseudowords:

1. Pick a word length between 3–7 characters.
2. Alternate consonant/vowel slots using a simple syllable template: `CV`, `CVC`, `CVCV`, `CVCCV`.
3. Fill each slot by sampling from available consonants/vowels weighted by weakness score.
4. Filter out any accidental profanity (blocklist check).

Examples of valid pseudowords with only `f, j, d, k, s, l, a` available: `fads`, `jalsk`, `dalk`, `flask`.

### 4.4 Line Generation

Each practice line contains **8–12 words** (adjustable by user). Lines are pre-generated before the user starts typing. When the user completes a line, the next is generated on the fly.

---

## 5. Session Flow

### 5.1 Session Structure

A session is a continuous typing run until the user manually stops or closes the tab. There are no rounds or timers — the goal is flow state.

```
Session Start
  → Generate first 3 lines of practice text
  → Show keyboard UI + text area
  → User begins typing

Per Keystroke
  → Record KeyEvent
  → Update live WPM + accuracy display
  → Re-weight next line generation if letter strengths shifted significantly

Every 10 words completed
  → Recalculate all strength scores
  → Check unlock conditions
  → If unlock triggered: toast + keyboard animation + regenerate upcoming lines

Session End (user stops)
  → Persist strength scores to DB
  → Show session summary card
```

### 5.2 Error Handling During Typing

- **Wrong key pressed:** the current character is highlighted red; the user must press the correct key before advancing (no skipping errors). Record the error in the keystroke log.
- **Backspace is disabled** by default (configurable). This forces the user to confront errors rather than fixing them invisibly. The error still counts.
- If the user presses backspace and it's enabled: back up one character, do not un-record the error (errors are immutable).

---

## 6. What the User Sees

### 6.1 Screen Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]                                    WPM: 47  Acc: 94%   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│   THE PRACTICE TEXT LINE (typed chars dim, current bright)     │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│                                                                 │
│   [caret blinking at current character]                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│              KEYBOARD VISUALIZATION (see 6.2)                   │
├─────────────────────────────────────────────────────────────────┤
│              LETTER STRENGTH PANEL (see 6.3)                    │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Keyboard Visualization

The keyboard shows the full QWERTY layout with per-key state:

| Key State         | Visual Treatment                                    |
|-------------------|-----------------------------------------------------|
| Locked            | Dark gray, low opacity, no color, lock icon overlay |
| Unlocked, weak    | Muted red/orange tint, colored by strength          |
| Unlocked, medium  | Muted yellow tint                                   |
| Unlocked, strong  | Muted green tint                                    |
| Next to type      | Bright highlight (the key the user needs to press)  |
| Wrong keypress    | Flash red for 150ms, then return to normal          |
| Newly unlocked    | Pulse animation + glow for 2 seconds               |

Strength maps to key color using a gradient: `red(0) → orange(40) → yellow(65) → green(85) → teal(100)`.

Home row indicator dots (F and J) always visible.

### 6.3 Letter Strength Panel

Below the keyboard, a horizontal strip shows all **unlocked letters** as small cards:

```
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│ F  │ │ J  │ │ D  │ │ K  │ │ S  │
│ 82 │ │ 71 │ │ 58 │ │ 90 │ │ 45 │
│████│ │███░│ │██░░│ │████│ │█░░░│
└────┘ └────┘ └────┘ └────┘ └────┘
```

Each card shows:
- The letter (uppercase)
- Numeric strength (0–100)
- A mini progress bar
- Color matches the keyboard key color

Cards are sorted by **strength ascending** (weakest first) so the user's attention is drawn to problem keys.

Locked letters are shown as grayed-out cards with a lock icon and `—` instead of a number.

### 6.4 Live WPM and Accuracy

Top-right corner, always visible:

- **WPM** is calculated as a **5-second rolling window** (not the full session average) so it feels responsive to current rhythm.
- **Accuracy** is the session-level correct/total ratio.
- Both values update every 500ms.

### 6.5 Unlock Toast

When a new letter unlocks:

```
╔══════════════════════════════════════════╗
║  🔓  New key unlocked: [ E ]             ║
║  Keep it up — 24 letters to go          ║
╚══════════════════════════════════════════╝
```

Toast appears for 3 seconds, top-center, non-blocking.

### 6.6 Session Summary Card

When the user ends a session, a modal shows:

```
┌─────────────────────────────────────────┐
│         Session Complete                │
│                                         │
│  Duration        4m 32s                 │
│  Words Typed     87                     │
│  Peak WPM        61                     │
│  Avg Accuracy    91%                    │
│                                         │
│  Most Improved   [ D ] +12 pts          │
│  Still Weak      [ S ] 38/100           │
│  New Unlocks     [ E ]                  │
│                                         │
│       [ Practice Again ]                │
└─────────────────────────────────────────┘
```

---

## 7. Data Model

```ts
// Stored per user in PostgreSQL

type UserProfile = {
  userId: string;
  unlockedUpToIndex: number;   // Index into the unlock sequence array
  createdAt: Date;
};

type LetterStrength = {
  userId: string;
  letter: string;              // Single char, lowercase
  strengthScore: number;       // 0–100
  sampleCount: number;         // Total keystrokes ever recorded for this key
  lastPracticedAt: Date;
  // Rolling window is stored as a serialized array of the last 50 KeyEvents
  recentSamples: KeyEvent[];
};

type Session = {
  sessionId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  wordsTyped: number;
  peakWpm: number;
  avgAccuracy: number;
  unlockEvents: string[];       // Letters unlocked during this session
};
```

---

## 8. Implementation Prompt for Claude

> Copy and paste the following into a new Claude conversation to generate the implementation:

---

**PROMPT:**

You are implementing the core logic for a touch-typing trainer inspired by keybr.com. I will describe the full system; implement it as a complete React + TypeScript module.

**What to build:**

1. **`useLetterStrength` hook** — manages all letter strength state. Accepts an array of `KeyEvent` objects emitted from the typing area. Returns:
   - `strengthMap: Record<string, number>` — current strength score (0–100) per letter
   - `unlockedLetters: string[]` — ordered array of currently unlocked letters
   - `justUnlocked: string | null` — set momentarily when a new letter unlocks (for UI animation)
   - `recordKeystroke(key: string, correct: boolean, reactionMs: number): void`

2. **`useContentGenerator` hook** — generates practice lines. Accepts `unlockedLetters` and `strengthMap`. Returns:
   - `currentLine: string` — the current line the user is typing
   - `nextLine: string` — pre-generated for smooth transitions
   - `advanceLine(): void` — call when user completes the current line

3. **Strength score formula** (implement exactly):
   - Accuracy sub-score = (correct / total) * 100, weight 50%
   - Speed sub-score = clamp(100 - ((medianReactionMs - 150) / 10.5), 0, 100), weight 35%
   - Consistency sub-score = clamp(100 - (stdDev(reactionTimes) / 8), 0, 100), weight 15%
   - Use rolling window of last 50 keystrokes per letter

4. **Unlock logic:**
   - Unlock sequence (fixed array): `['f','j','d','k','s','l','a',';','e','i','t','n','o','r','h','u','c','m','g','b','p','w','y','v','x','q','z']`
   - Start with first 2 unlocked (`f`, `j`)
   - Unlock next letter when the weakest currently-unlocked letter has strength ≥ 75 AND at least 30 samples
   - Check for unlock after every keystroke

5. **Content generation:**
   - Filter the provided word list (`WORD_LIST: string[]`) to words using only unlocked letters
   - Score each candidate word by `sum(100 - strength[letter]) / wordLength`
   - Sample words proportionally by score (weighted random)
   - If fewer than 20 real words available, fill remainder with pseudowords using CV/CVC syllable templates
   - Each line = 8–10 words joined by spaces

6. **Pseudoword generation:**
   - Syllable templates: `['cv', 'cvc', 'cvcc', 'cvcv', 'cvccv']`
   - Assign available unlocked letters to consonant vs vowel buckets: vowels = {a, e, i, o, u}, rest = consonants
   - Fill slots weighted by weakness score
   - If a bucket is empty (e.g., no vowels unlocked yet), sample from all available letters instead

**Constraints:**
- Pure TypeScript, no external dependencies beyond React
- All state lives in the hooks; no global stores
- The hooks must be unit-testable (no DOM dependencies inside core logic)
- Expose a `resetSession()` function that clears rolling windows but preserves persisted scores

Return the complete implementation with inline comments explaining each non-obvious decision.

---

## 9. Key Design Decisions and Rationale

| Decision | Rationale |
|----------|-----------|
| Rolling 50-sample window (not session-wide) | Avoids early poor samples haunting good learners; adapts quickly |
| Median reaction time (not mean) | Long hesitations on hard keys skew mean; median is more truthful |
| Weakest unlocked key triggers next unlock | Prevents users ignoring their bad keys and coasting on good ones |
| Backspace disabled by default | Forces error acknowledgment; mirrors real typing stakes |
| Pseudowords over random strings | Phonemic patterns are more memorable and feel natural |
| Word selection weighted, not filtered | Variety prevents boredom; still targets weak keys statistically |
| Newly unlocked key gets 2× weight for 2 sessions | Ensures exposure before the letter "disappears" into a large pool |
| Score persisted, session ends any time | No pressure to finish a "round"; supports mobile/interrupt usage |

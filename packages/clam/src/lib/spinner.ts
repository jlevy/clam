/**
 * Aquatic-themed spinner for Clam.
 * Wave pattern: calm → ripple → waves → strong → waves → ripple → repeat
 */

/** Wave character frames for spinner animation */
export const WAVE_FRAMES = ['─', '~', '≈', '≋', '≈', '~'] as const;

/** Get the frame at the given index, wrapping around */
export function getNextFrame(index: number): string {
  return WAVE_FRAMES[index % WAVE_FRAMES.length]!;
}

/** Aquatic-themed verbs for fun spinner mode (only used when waiting on Claude Code) */
export const AQUATIC_VERBS = [
  // Movement & Flow
  'Swimming',
  'Drifting',
  'Floating',
  'Gliding',
  'Undulating',
  'Swirling',
  'Eddying',
  'Streaming',
  'Cascading',
  'Surging',
  'Rippling',
  'Welling',
  'Billowing',
  'Cresting',
  'Ebbing',
  'Flowing',

  // Marine Creature Behaviors
  'Filtering',
  'Siphoning',
  'Burrowing',
  'Pearling',
  'Schooling',
  'Shoaling',
  'Sounding',
  'Breaching',
  'Spouting',
  'Finning',
  'Tentacling',
  'Jellying',
  'Inking',
  'Scuttling',
  'Sidling',
  'Pinching',
  'Clacking',

  // Ocean Phenomena
  'Tiding',
  'Waving',
  'Foaming',
  'Frothing',
  'Misting',
  'Spraying',
  'Splashing',
  'Lapping',
  'Roiling',
  'Churning',
  'Swelling',
  'Plunging',
  'Surfing',

  // Shell & Mollusk Specific
  'Shelling',
  'Clamming',
  'Oystering',
  'Valving',
  'Nacring',
  'Calcifying',
  'Encrusting',
  'Anchoring',
  'Secreting',

  // Nautical & Maritime
  'Charting',
  'Fathoming',
  'Barnacling',
  'Docking',
  'Mooring',
  'Harboring',
  'Navigating',
  'Helming',

  // Aquatic Environment
  'Reefing',
  'Kelping',
  'Coralizing',
  'Abyssing',
  'Trenching',
  'Shallowing',
  'Deepening',
  'Tidepooling',

  // Whimsical & Playful
  'Bubbling',
  'Gurgling',
  'Burbling',
  'Plinking',
  'Plopping',
  'Splooshing',
  'Whooshing',
  'Shimmering',
  'Glinting',
  'Glistening',

  // Shell Double Meanings (Aquatic Shell + Command Shell)
  'Spawning',
  'Forking',
  'Piping',
  'Buffering',
  'Flushing',
  'Sourcing',
  'Echoing',
  'Channeling',
  'Routing',
  'Polling',
  'Signaling',
] as const;

/** Fisher-Yates shuffle for array randomization */
function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/** Create a verb selector that cycles through shuffled verbs without repetition */
export function createVerbSelector(): () => string {
  let shuffled = shuffle(AQUATIC_VERBS);
  let index = 0;

  return () => {
    if (index >= shuffled.length) {
      // Reshuffle when we've used all verbs
      shuffled = shuffle(AQUATIC_VERBS);
      index = 0;
    }
    return shuffled[index++]!;
  };
}

/** Spinner display modes */
export const SpinnerMode = {
  /** Just animated wave characters, no text */
  Plain: 'plain',
  /** Wave characters + static custom message */
  CustomMessage: 'custom',
  /** Wave characters + cycling aquatic verbs with typewriter animation */
  FunVerbs: 'funVerbs',
} as const;

export type SpinnerModeType = (typeof SpinnerMode)[keyof typeof SpinnerMode];

/** Configuration for creating a spinner */
export interface SpinnerConfig {
  mode: SpinnerModeType;
  message?: string;
  write: (text: string) => void;
}

/** Spinner instance returned by createSpinner */
export interface Spinner {
  start(): void;
  stop(): void;
}

/** Animation timings (in ms) */
const TIMING = {
  waveFrame: 80, // Base wave animation speed
  verbDisplay: 200, // Show verb without dots
  dot1: 150, // First dot
  dot2: 150, // Second dot
  dot3: 400, // Third dot (hold)
  clear: 50, // Quick clear
  typewriter: 30, // Per-character typing speed
};

/** Create a spinner with the specified mode */
export function createSpinner(config: SpinnerConfig): Spinner {
  const { mode, message = '', write } = config;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let frameIndex = 0;

  // Fun verbs mode state
  let verbSelector: (() => string) | null = null;
  let currentVerb = '';
  let animationPhase = 0; // 0=verb, 1=dot1, 2=dot2, 3=dot3, 4=clear, 5+=typewriter
  let typewriterIndex = 0;
  let phaseTimer: ReturnType<typeof setTimeout> | null = null;

  const clearLine = () => {
    write('\r\x1b[K');
  };

  const renderFrame = () => {
    const frame = getNextFrame(frameIndex++);

    switch (mode) {
      case SpinnerMode.Plain:
        write(`\r${frame} `);
        break;

      case SpinnerMode.CustomMessage:
        write(`\r${frame} ${message}...`);
        break;

      case SpinnerMode.FunVerbs:
        // This mode uses a more complex animation, handled separately
        break;
    }
  };

  const renderFunVerbFrame = () => {
    const frame = getNextFrame(frameIndex++);
    let text = '';

    switch (animationPhase) {
      case 0: // Show verb without dots
        text = `\r${frame} ${currentVerb}`;
        break;
      case 1: // First dot
        text = `\r${frame} ${currentVerb}.`;
        break;
      case 2: // Second dot
        text = `\r${frame} ${currentVerb}..`;
        break;
      case 3: // Third dot (hold)
        text = `\r${frame} ${currentVerb}...`;
        break;
      case 4: // Clear
        text = `\r${frame} `;
        break;
      default: {
        // Typewriter phase
        const charsToShow = Math.min(typewriterIndex, currentVerb.length);
        text = `\r${frame} ${currentVerb.slice(0, charsToShow)}`;
        break;
      }
    }

    write(text);
  };

  const advanceVerbAnimation = () => {
    if (mode !== SpinnerMode.FunVerbs || !verbSelector) return;

    animationPhase++;

    if (animationPhase === 1) {
      // Moving to dot1
      phaseTimer = setTimeout(advanceVerbAnimation, TIMING.dot1);
    } else if (animationPhase === 2) {
      // Moving to dot2
      phaseTimer = setTimeout(advanceVerbAnimation, TIMING.dot2);
    } else if (animationPhase === 3) {
      // Moving to dot3
      phaseTimer = setTimeout(advanceVerbAnimation, TIMING.dot3);
    } else if (animationPhase === 4) {
      // Moving to clear
      phaseTimer = setTimeout(advanceVerbAnimation, TIMING.clear);
    } else if (animationPhase === 5) {
      // Start typewriter for new verb
      currentVerb = verbSelector();
      typewriterIndex = 0;
      advanceTypewriter();
    }
  };

  const advanceTypewriter = () => {
    if (mode !== SpinnerMode.FunVerbs) return;

    typewriterIndex++;

    if (typewriterIndex <= currentVerb.length) {
      renderFunVerbFrame();
      phaseTimer = setTimeout(advanceTypewriter, TIMING.typewriter);
    } else {
      // Typewriter complete, reset to phase 0 and start normal animation
      animationPhase = 0;
      phaseTimer = setTimeout(advanceVerbAnimation, TIMING.verbDisplay);
    }
  };

  const start = () => {
    frameIndex = 0;

    if (mode === SpinnerMode.FunVerbs) {
      verbSelector = createVerbSelector();
      currentVerb = verbSelector();
      animationPhase = 0;
      typewriterIndex = 0;

      // Render initial frame
      renderFunVerbFrame();

      // Start wave animation
      intervalId = setInterval(renderFunVerbFrame, TIMING.waveFrame);

      // Start verb animation phases
      phaseTimer = setTimeout(advanceVerbAnimation, TIMING.verbDisplay);
    } else {
      // Plain or CustomMessage mode
      renderFrame();
      intervalId = setInterval(renderFrame, TIMING.waveFrame);
    }
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (phaseTimer) {
      clearTimeout(phaseTimer);
      phaseTimer = null;
    }
    clearLine();
  };

  return { start, stop };
}

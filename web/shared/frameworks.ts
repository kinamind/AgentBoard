// NLP (Neuro-Linguistic Programming) frameworks used as structured-thinking checklists.
// They are heuristics for clarifying goals and checking alignment, NOT evidence-based
// science; every analysis is labelled "heuristic" and must cite evidence.

export interface Framework {
  id: string;
  name: string;
  applies_to: ("goal" | "task" | "session" | "company" | "department")[];
  summary: string;
  prompt: string;
}

const RESULT_SHAPE =
  'Return JSON: {"verdict":"ok|needs_work|misaligned","findings":[{"item":string,"ok":boolean,"note":string,"quote"?:string}],"questions":[string],"recommendation":string,"confidence":0-1,"evidence":[{"type":"goal|task|session","id":string}],"disclaimer":"heuristic"}. Every finding must cite evidence ids from the provided context; do not invent facts.';

export const FRAMEWORKS: Framework[] = [
  {
    id: "well_formed_outcome",
    name: "Well-Formed Outcome",
    applies_to: ["goal"],
    summary: "Is the goal stated positively, with sensory evidence, context, ecology, resources and a first step?",
    prompt:
      "For the target goal, check the Well-Formed Outcome conditions: (1) stated positively (what you want, not what to avoid); (2) evidence - how will we know it is achieved (observable, measurable); (3) context - when/where/with whom; (4) ecology - side-effects on other goals/departments; (5) resources - what is needed and available; (6) first step - a concrete next action. Mark each as ok/not ok, quote the offending wording, and ask the missing questions. " +
      RESULT_SHAPE,
  },
  {
    id: "meta_model",
    name: "Meta Model",
    applies_to: ["goal", "task"],
    summary: "Detect vague language: deletions, generalizations, distortions; produce clarifying questions.",
    prompt:
      "Scan the title/description of the target for Meta Model patterns: deletions (missing who/what/how much), unspecified verbs ('improve', 'optimize'), universal quantifiers ('always', 'all'), modal limits ('must', 'can't'), nominalizations ('experience', 'quality'), and assumed causes. For each, quote it and give a precise clarifying question (Who/What exactly? How will we measure it? Compared to what?). " +
      RESULT_SHAPE,
  },
  {
    id: "logical_levels",
    name: "Logical Levels (Dilts)",
    applies_to: ["goal", "task", "department", "company"],
    summary: "Place work on Environment/Behavior/Capability/Beliefs-Values/Identity/Purpose and check vertical alignment.",
    prompt:
      "Classify each goal/task onto Dilts' logical levels (environment, behavior, capability, beliefs/values, identity, purpose). Then check alignment: do the behaviors (tasks/sessions) actually support the higher-level goals and the company's stated purpose? Flag tasks that serve no goal, goals no task supports, and work concentrated at the wrong level (e.g. only tooling while the goal is about customers). " +
      RESULT_SHAPE,
  },
  {
    id: "chunking",
    name: "Chunking up / down",
    applies_to: ["goal", "task", "company"],
    summary: "Chunk up ('for what purpose?') to link tasks to goals; chunk down ('how, specifically?') to split big work.",
    prompt:
      "Chunk UP each task: what higher goal does it serve? If none, mark it an orphan. Chunk DOWN each goal: is it decomposed into concrete tasks? Flag goals that are too abstract to act on and tasks that are too big to finish in one session (suggest a split). Propose concrete new tasks where gaps exist. " +
      RESULT_SHAPE,
  },
  {
    id: "tote",
    name: "TOTE (Test-Operate-Test-Exit)",
    applies_to: ["task", "session"],
    summary: "Judge whether a running task is converging on its exit condition, looping, or drifting.",
    prompt:
      "Treat the task/session as a TOTE loop. Identify the exit condition (the test that says 'done'); if none is stated, say so and propose one. From the session status, events and timestamps judge: converging (progress toward exit), looping (repeating without progress), blocked (needs a decision), or drifting (activity unrelated to the exit condition). Recommend continue / intervene / cancel. " +
      RESULT_SHAPE,
  },
  {
    id: "perceptual_positions",
    name: "Perceptual Positions",
    applies_to: ["goal", "task", "company"],
    summary: "Decision brief from three viewpoints: the founder (1st), the customer/other party (2nd), a neutral observer (3rd).",
    prompt:
      "Write a decision brief for the pending decision or proposed direction. Analyse it from 1st position (the founder: goals, constraints, energy), 2nd position (the customer/user/counterparty: what they experience and need), and 3rd position (a neutral observer: risks, opportunity cost, reversibility). List options with pros/cons per position, then recommend one and say what would change your mind. " +
      RESULT_SHAPE,
  },
  {
    id: "disney_strategy",
    name: "Disney Strategy",
    applies_to: ["goal", "company"],
    summary: "Dreamer / Realist / Critic passes to stress-test a new direction.",
    prompt:
      "Evaluate the proposed direction in three passes. Dreamer: the best outcome, unconstrained. Realist: the concrete plan, resources, sequence and first 3 tasks. Critic: what could fail, hidden costs, and mitigations. Finish with a go / adjust / stop recommendation. " +
      RESULT_SHAPE,
  },
];

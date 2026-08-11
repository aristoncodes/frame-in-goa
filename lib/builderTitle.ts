/**
 * Builder title generator.
 *
 * Pattern: <vibe adjective> <role-flavoured noun>. The noun pool is biased by
 * whatever stack the user typed when there's a clean keyword match, but there is
 * always a solid generic pool behind it so an unlisted stack never looks broken.
 * Generation is deterministic on (name + stack + role) so the same inputs
 * reproduce the same title — a card can be regenerated and still match a shared
 * screenshot.
 */

const ADJECTIVES = [
  "Beachside",
  "Midnight",
  "Sunburnt",
  "Feral",
  "Caffeinated",
  "Monsoon",
  "Barefoot",
  "Ship-it",
  "Low-latency",
  "Offline-first",
  "Susegad",
  "Neon",
  "Tidepool",
  "Overclocked",
  "Salt-Air",
  "Chaos",
  "Golden-Hour",
  "Rooftop",
  "High-Tide",
  "Unsupervised",
];

const GENERIC_NOUNS = [
  "Innovator",
  "Architect",
  "Specialist",
  "Operator",
  "Coordinator",
  "Tinkerer",
  "Builder",
  "Craftsman",
  "Renegade",
  "Wrangler",
  "Pathfinder",
  "Mechanic",
];

/** Ordered — first matching entry wins, so put specific keywords above broad ones. */
const STACK_NOUNS: { match: RegExp; nouns: string[] }[] = [
  {
    match: /\b(web3|crypto|onchain|on-chain|solidity|blockchain|defi|solana|evm|ethereum|nft)\b/i,
    nouns: ["Alchemist", "Anchor", "Validator", "Block Runner", "Chain Smith", "Consensus Keeper"],
  },
  {
    match: /\b(ai|ml|llm|genai|agents?|rag|nlp|pytorch|tensorflow|diffusion)\b/i,
    nouns: ["Alchemist", "Whisperer", "Prompt Smith", "Model Tamer", "Latent Explorer", "Agent Handler"],
  },
  {
    match: /\b(design|ux|ui|figma|brand|motion|3d|illustrat)/i,
    nouns: ["Pixel Pusher", "Composition Lead", "Form Giver", "Vibe Director", "Grid Keeper"],
  },
  {
    match: /\b(devops|infra|sre|kubernetes|k8s|cloud|aws|gcp|terraform|platform)\b/i,
    nouns: ["Firefighter", "Uptime Keeper", "Pipeline Boss", "Cluster Tamer", "Yak Shaver"],
  },
  {
    match: /\b(security|sec|pentest|infosec|appsec|crypto-?graphy)\b/i,
    nouns: ["Lockpick", "Threat Hunter", "Perimeter Keeper", "Red Teamer"],
  },
  {
    match: /\b(data|analytics|sql|etl|warehouse|spark|pandas)\b/i,
    nouns: ["Pipeline Boss", "Signal Finder", "Query Slinger", "Insight Miner"],
  },
  {
    match: /\b(mobile|ios|android|swift|kotlin|flutter|react ?native|expo)\b/i,
    nouns: ["Pocket Architect", "Gesture Smith", "App Runner", "Thumb-Zone Tactician"],
  },
  {
    match: /\b(game|unity|unreal|godot|graphics|shader|webgl|three)\b/i,
    nouns: ["World Builder", "Shader Wizard", "Frame Chaser", "Level Designer"],
  },
  {
    match: /\b(backend|api|go|golang|rust|java|node|python|django|server)\b/i,
    nouns: ["Systems Mechanic", "Throughput Monk", "Endpoint Smith", "Daemon Keeper"],
  },
  {
    match: /\b(frontend|front-end|react|next|vue|svelte|css|typescript|web)\b/i,
    nouns: ["Interface Smith", "Render Chaser", "Pixel Pusher", "Hydration Tamer"],
  },
  {
    match: /\b(founder|ceo|cto|product|pm|growth|bd|marketing|solo)\b/i,
    nouns: ["Ringleader", "Roadmap Runner", "Demo Closer", "Narrative Lead"],
  },
  {
    match: /\b(student|learning|beginner|self-?taught)\b/i,
    nouns: ["Speedrunner", "Fast Learner", "Night Owl", "First-Shipper"],
  },
];

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nounPoolFor(stack: string, role: string) {
  const haystack = `${stack} ${role}`;
  const pool: string[] = [];
  for (const entry of STACK_NOUNS) {
    if (entry.match.test(haystack)) pool.push(...entry.nouns);
  }
  // Always keep a generic tail so results stay varied and never look templated.
  return pool.length ? [...pool, ...GENERIC_NOUNS.slice(0, 4)] : GENERIC_NOUNS;
}

export function generateBuilderTitle(
  name: string,
  stack: string,
  role: string,
  salt = 0,
): string {
  const seed = hash(`${name.trim().toLowerCase()}|${stack.trim().toLowerCase()}|${role
    .trim()
    .toLowerCase()}|${salt}`);
  const nouns = nounPoolFor(stack, role);
  const adj = ADJECTIVES[seed % ADJECTIVES.length];
  const noun = nouns[Math.floor(seed / ADJECTIVES.length) % nouns.length];
  return `${adj} ${noun}`;
}

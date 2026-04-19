// ═══════════════════════════════════════════════════════════
//  LEVEL GENERATION — 1000 levels, boss every 10th
// ═══════════════════════════════════════════════════════════

import { realmForLevel, isBossLevel, bossName } from "./realms.js";

export const TYPE_INFO = [
  { type: "normal",     name: "NORMAL",     desc: "Standard. Pops, expands, chains.",                          intro: 1   },
  { type: "ghost",      name: "GHOST",      desc: "Dashed. Scores on hit, but doesn't chain onward.",          intro: 5   },
  { type: "heavy",      name: "HEAVY",      desc: "Crossed. Needs two hits. Moves slowly.",                    intro: 9   },
  { type: "splitter",   name: "SPLITTER",   desc: "Ringed. Explodes twice — spawns waves of small bubbles.",   intro: 14  },
  { type: "fast",       name: "FAST",       desc: "Streaked. Blazes across the screen.",                       intro: 20  },
  { type: "anchor",     name: "ANCHOR",     desc: "Bracketed. Stationary.",                                    intro: 27  },
  { type: "magnet",     name: "MAGNET",     desc: "Pulsing. Pulls all other types. Repels other magnets.",     intro: 35  },
  { type: "shield",     name: "SHIELD",     desc: "Haloed. Absorbs the first hit before igniting.",            intro: 44  },
  { type: "teleporter", name: "TELEPORTER", desc: "Erratic. Blinks to random spots and changes direction.",    intro: 55  },
  { type: "bomb",       name: "BOMB",       desc: "Spiked. Huge radius but collapses twice as fast.",          intro: 68  },
];

// Build a bubble mix for a given level
function buildMix(n, total, introType) {
  // Types unlocked at this level
  const unlocked = TYPE_INFO
    .filter(t => t.intro <= n)
    .map(t => t.type);

  // Normal ratio decays throughout the game, but never below 25%
  // Also, each realm re-introduces some normals to keep things playable
  const realmProgress = ((n - 1) % 100) / 100; // 0..1 within realm
  const globalProgress = Math.min(1, (n - 1) / 1000);
  const normalRatio = Math.max(0.25, 0.95 - globalProgress * 0.6 - realmProgress * 0.15);

  const mix = {};
  for (const type of unlocked) mix[type] = 0;

  let remaining = total;

  // Reserve a prominent slot for the newly-introduced type
  if (introType && mix[introType] !== undefined) {
    const introShare = Math.max(5, Math.round(total * 0.25));
    mix[introType] = Math.min(introShare, total);
    remaining -= mix[introType];
  }

  // Normals as the base
  const targetNormal = Math.round(total * normalRatio);
  mix.normal = Math.min(targetNormal, remaining);
  remaining -= mix.normal;

  // Distribute rest among specials
  if (remaining > 0 && unlocked.length > 1) {
    const specials = unlocked.filter(t => t !== "normal" && t !== introType);
    if (specials.length > 0) {
      const per = Math.max(1, Math.floor(remaining / specials.length));
      for (const t of specials) {
        if (remaining <= 0) break;
        const give = Math.min(per, remaining);
        mix[t] += give;
        remaining -= give;
      }
    }
    if (remaining > 0) {
      const pool = specials.length > 0 ? specials : ["normal"];
      const target = pool[Math.floor(Math.random() * pool.length)];
      mix[target] += remaining;
    }
  } else if (remaining > 0) {
    mix.normal += remaining;
  }

  // Prune zeros
  const clean = {};
  for (const [k, v] of Object.entries(mix)) if (v > 0) clean[k] = v;
  return clean;
}

// Boss levels have unique themed mixes and layouts
function buildBossMix(levelNum, realm) {
  const bossIdx = Math.floor(((levelNum - 1) % 100) / 10); // 0..9 within realm
  const realmIdx = realm.index;

  // Boss difficulty scales across realms and within realms
  const baseCount = 30 + bossIdx * 4 + realmIdx * 8; // 30 to ~110
  const total = Math.min(100, baseCount);

  // Each realm has a boss "signature" — certain types it features prominently
  const signatures = {
    space:     ["anchor", "heavy"],          // asteroid belt
    candy:     ["splitter", "magnet"],       // gumball chaos
    themepark: ["fast", "teleporter"],       // carnival rides
    horror:    ["ghost", "teleporter"],      // wraiths
    ocean:     ["magnet", "heavy"],          // leviathan pulls
    volcanic:  ["bomb", "fast"],             // eruptions
    crystal:   ["shield", "splitter"],       // refractions
    clockwork: ["heavy", "anchor"],          // machinery
    dream:     ["teleporter", "ghost"],      // unreality
    final:     ["bomb", "shield", "heavy"],  // the gauntlet
  };

  const sig = signatures[realm.id] || ["heavy"];
  const unlocked = TYPE_INFO.filter(t => t.intro <= levelNum).map(t => t.type);
  const availableSig = sig.filter(t => unlocked.includes(t));

  const mix = { normal: Math.floor(total * 0.35) };
  let remaining = total - mix.normal;

  // Pack signature types heavily
  for (const t of availableSig) {
    const share = Math.floor(remaining / availableSig.length * 0.9);
    mix[t] = share;
    remaining -= share;
  }

  // Fill with other unlocked specials
  const others = unlocked.filter(t => t !== "normal" && !availableSig.includes(t));
  if (others.length > 0 && remaining > 0) {
    const per = Math.max(1, Math.floor(remaining / others.length));
    for (const t of others) {
      if (remaining <= 0) break;
      const give = Math.min(per, remaining);
      mix[t] = (mix[t] || 0) + give;
      remaining -= give;
    }
  }
  if (remaining > 0) mix.normal += remaining;

  const clean = {};
  for (const [k, v] of Object.entries(mix)) if (v > 0) clean[k] = v;
  return clean;
}

export function generateLevel(n) {
  const realm = realmForLevel(n);
  const boss = isBossLevel(n);
  const introType = TYPE_INFO.find(t => t.intro === n)?.type || null;

  // Progression scalars across full 1000 levels
  const g = (n - 1) / 1000; // 0..~1

  // Total bubble count
  let total = Math.round(18 + n * 0.08 + (g * g) * 25); // gentle early, curves up
  total = Math.min(85, total);

  // Hold time (frames bubbles stay expanded) — 45 → 14
  const hold = Math.max(14, Math.round(46 - n * 0.032));

  // Expansion radius — 95 → 48
  const expansion = Math.max(48, Math.round(96 - n * 0.048));

  // Fast bubble multiplier — now 2x the base (per request)
  // Starts at ~5 and scales up
  const fastMul = Math.min(8, 5 + g * 3);

  // Pass percentage — 45% → 65%
  const passPercent = Math.min(0.65, 0.45 + g * 0.2);

  let mix, name;
  if (boss) {
    mix = buildBossMix(n, realm);
    total = Object.values(mix).reduce((a, b) => a + b, 0);
    name = bossName(n, realm);
  } else {
    mix = buildMix(n, total, introType);
    total = Object.values(mix).reduce((a, b) => a + b, 0);
    name = genLevelName(n, realm);
  }

  return {
    n,
    name,
    realm,
    boss,
    introType,
    mix,
    hold,
    expansion,
    fastMul,
    passPercent,
    total,
    // Boss levels need a higher threshold
    passThreshold: Math.ceil(total * (boss ? 0.6 : passPercent)),
    // Which 10-level round this belongs to (1-indexed round start)
    roundStart: Math.floor((n - 1) / 10) * 10 + 1,
  };
}

function genLevelName(n, realm) {
  // A pool of evocative names per realm, cycled within the 9 non-boss levels
  const pools = {
    space:     ["ORBIT", "DRIFT", "VACUUM", "NEBULA", "COMET", "PULSAR", "VOID", "STARDUST", "GRAVITY"],
    candy:     ["SUGAR", "GUMDROP", "TAFFY", "SYRUP", "LOLLIPOP", "FROSTING", "CARAMEL", "SPRINKLES", "BRITTLE"],
    themepark: ["NEON", "SPINNER", "MIDWAY", "BALLOON", "FUNHOUSE", "COASTER", "PRIZE", "BARKER", "FERRIS"],
    horror:    ["DREAD", "WHISPER", "SHADOW", "SHIVER", "OMEN", "PHANTOM", "CRYPT", "HOLLOW", "DECAY"],
    ocean:     ["CURRENT", "KELP", "TRENCH", "REEF", "TIDE", "FATHOM", "PRESSURE", "SONAR", "BRINE"],
    volcanic:  ["EMBER", "MAGMA", "ASH", "VENT", "CINDER", "FLARE", "SCORCH", "BLAZE", "PYRE"],
    crystal:   ["FACET", "PRISM", "GEODE", "SHIMMER", "REFRACT", "QUARTZ", "SHARD", "LUSTER", "VEIN"],
    clockwork: ["GEAR", "COG", "SPRING", "PENDULUM", "ESCAPEMENT", "CAM", "LEVER", "RATCHET", "TORQUE"],
    dream:     ["HAZE", "DRIFT", "LUCID", "MIRAGE", "WHIM", "FLUTTER", "MURMUR", "REVERIE", "VAPOR"],
    final:     ["DAWN", "HALO", "ASCENT", "RADIANCE", "THRESHOLD", "SUMMIT", "BEACON", "ZENITH", "APEX"],
  };
  const pool = pools[realm.id] || pools.space;
  const withinRealm = ((n - 1) % 100); // 0..99
  const withinRound = withinRealm % 10; // 0..9 (9 is boss)
  return pool[withinRound % pool.length];
}

// Pre-generate all 1000 levels
export const ALL_LEVELS = Array.from({ length: 1000 }, (_, i) => generateLevel(i + 1));

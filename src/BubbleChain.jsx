import React, { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
//  CHAIN REACTION — 100 levels, 10 bubble types
// ═══════════════════════════════════════════════════════════

const BASE_RADIUS = 22;
const SMALL_RADIUS = 13;
const EXPANSION_SPEED = 2.2;
const SHRINK_SPEED = 1.8;

// ── Bubble types ──────────────────────────────────────────
const PALETTE = {
  normal:     { core: "#7df9ff", glow: "#7df9ff" },
  ghost:      { core: "#e0e0ff", glow: "#9090c0" },
  heavy:      { core: "#ff6ec7", glow: "#ff3ea5" },
  splitter:   { core: "#c4f542", glow: "#a6e22e" },
  fast:       { core: "#ffb347", glow: "#ff8c42" },
  anchor:     { core: "#b39dff", glow: "#9b7cff" },
  small:      { core: "#5ef0c0", glow: "#2ee6a8" },
  magnet:     { core: "#ff5577", glow: "#ff2244" },
  shield:     { core: "#44ddff", glow: "#22aadd" },
  teleporter: { core: "#ff44ff", glow: "#cc22cc" },
  bomb:       { core: "#ffee44", glow: "#ddcc00" },
};

const TYPE_INFO = [
  { type: "normal",     name: "NORMAL",     desc: "Standard. Pops, expands, chains.",                intro: 1  },
  { type: "ghost",      name: "GHOST",      desc: "Dashed. Scores on hit, but doesn't chain onward.", intro: 5  },
  { type: "heavy",      name: "HEAVY",      desc: "Crossed. Needs two separate hits to ignite.",      intro: 9  },
  { type: "splitter",   name: "SPLITTER",   desc: "Ringed. Spawns small chain bubbles when popped.",  intro: 14 },
  { type: "fast",       name: "FAST",       desc: "Streaked. Moves much quicker than normal.",        intro: 20 },
  { type: "anchor",     name: "ANCHOR",     desc: "Bracketed. Stationary — routes chains through.",   intro: 27 },
  { type: "magnet",     name: "MAGNET",     desc: "Pulsing rings. Attracts nearby bubbles.",          intro: 35 },
  { type: "shield",     name: "SHIELD",     desc: "Haloed. Absorbs the first hit before igniting.",   intro: 44 },
  { type: "teleporter", name: "TELEPORTER", desc: "Warping dashes. Blinks away when chain-hit.",      intro: 55 },
  { type: "bomb",       name: "BOMB",       desc: "Spiked. Huge radius but collapses twice as fast.", intro: 68 },
];

// ── Level generation ─────────────────────────────────────
// Hand-tuned difficulty curve for 100 levels.
function generateLevel(n) {
  // n is 1-indexed level number

  // Total count: 18 at lv1, ~60 at lv100
  const total = Math.min(60, Math.round(17 + n * 0.44));

  // Hold time (how long expanded bubbles stay big): 42 -> 16
  const hold = Math.max(16, Math.round(44 - n * 0.28));

  // Expansion radius: 95 -> 55
  const expansion = Math.max(55, Math.round(96 - n * 0.42));

  // Fast bubble speed multiplier: 2.5 -> 4.5
  const fastMul = Math.min(4.5, 2.5 + n * 0.02);

  // Pass percentage: 45% -> 65%
  const passPercent = Math.min(0.65, 0.45 + n * 0.002);

  // Build the bubble mix
  const mix = buildMix(n, total);
  const actualTotal = Object.values(mix).reduce((a, b) => a + b, 0);

  return {
    name: genLevelName(n),
    mix,
    hold,
    expansion,
    fastMul,
    passPercent,
    total: actualTotal,
  };
}

function buildMix(n, total) {
  // Determine which types are unlocked by this level
  const unlocked = TYPE_INFO
    .filter(t => t.intro <= n)
    .map(t => t.type);

  // Is a new type being introduced THIS level?
  const introThisLevel = TYPE_INFO.find(t => t.intro === n)?.type;

  // Target normal ratio: 100% at lv1, decays to ~30% by lv100
  const normalRatio = Math.max(0.3, 1 - (n - 1) * 0.008);

  const mix = {};
  for (const type of unlocked) mix[type] = 0;

  let remaining = total;

  // Reserve a prominent slot for the newly-introduced type FIRST
  // so it always has a proper debut regardless of normal ratio.
  if (introThisLevel) {
    const introShare = Math.max(5, Math.round(total * 0.25));
    mix[introThisLevel] = Math.min(introShare, total);
    remaining -= mix[introThisLevel];
  }

  // Normals fill the base
  const targetNormal = Math.round(total * normalRatio);
  mix.normal = Math.min(targetNormal, remaining);
  remaining -= mix.normal;

  // Distribute the rest among specials
  if (remaining > 0 && unlocked.length > 1) {
    const specials = unlocked.filter(t => t !== "normal" && t !== introThisLevel);

    if (specials.length > 0) {
      const per = Math.max(1, Math.floor(remaining / specials.length));
      for (const t of specials) {
        if (remaining <= 0) break;
        const give = Math.min(per, remaining);
        mix[t] += give;
        remaining -= give;
      }
    }

    // Any remainder goes to a random non-normal type (or normals if no specials)
    if (remaining > 0) {
      const pool = specials.length > 0 ? specials : ["normal"];
      const target = pool[Math.floor(Math.random() * pool.length)];
      mix[target] += remaining;
      remaining = 0;
    }
  } else if (remaining > 0) {
    // No specials at all, dump into normals
    mix.normal += remaining;
  }

  // Prune zero entries
  const clean = {};
  for (const [k, v] of Object.entries(mix)) if (v > 0) clean[k] = v;
  return clean;
}

function genLevelName(n) {
  const names = [
    "FIRST LIGHT","SHALLOW WATERS","GENTLE DRIFT","CALM CURRENT","PHANTOM TIDE",
    "FADING GLOW","ECHO CHAMBER","DISTANT PULSE","IRON SHELL","PRESSURE POINT",
    "DEEP MURMUR","DARK CASCADE","COLD BLOOM","FRAGMENTATION","SPLINTERED",
    "SHIVER","CRACKED ICE","PULSE WAVE","RIPTIDE","SWIFT PASSAGE",
    "BLUR","VELOCITY","LIGHTNING DRIFT","SURGE POINT","FLASH FLOOD",
    "TORRENT","ANCHORED DEEP","LOCKDOWN","STONE GARDEN","FIXED POINT",
    "FROZEN ARRAY","SILENT GRID","CRYSTAL LOCK","STATIC FIELD","MAGNETAR",
    "PULL TIDE","GRAVITY WELL","CONVERGENCE","ATTRACTION","DARK PULL",
    "INWARD SPIRAL","ORBIT DECAY","TIDAL LOCK","SHELL GAME","FORTIFIED",
    "DOUBLE WALL","BARRIER REEF","IRON CURTAIN","HARDENED","ARMOR PLATING",
    "BUNKER","RESILIENCE","DEEP SHIELD","PHASE SHIFT","WARP GATE",
    "BLINK","DISPLACEMENT","QUANTUM LEAP","VOID STEP","STUTTER",
    "GLITCH","FLUX","ANOMALY","WORMHOLE","DARK MATTER",
    "NOVA PULSE","DETONATION","BLAST ZONE","CRITICAL MASS","CHAIN IGNITION",
    "OVERLOAD","MELTDOWN","SUPERNOVA","FIRESTORM","ENTROPY",
    "CHAOS FIELD","MAELSTROM","TURBULENCE","VORTEX","ZERO POINT",
    "DARK ENERGY","COLLAPSE","IMPLOSION","THE VOID","ANNIHILATION",
    "TERMINUS","OBLIVION","CATACLYSM","EVENT HORIZON","HEAT DEATH",
    "FINAL CHAIN","THE CRUCIBLE","ABSOLUTE ZERO","OMEGA","EXTINCTION",
    "LAST LIGHT","ENDGAME","RAGNAROK","APEX","SINGULARITY",
  ];
  return names[Math.min(n - 1, names.length - 1)];
}

const ALL_LEVELS = Array.from({ length: 100 }, (_, i) => generateLevel(i + 1));

// ── Bubble factory ────────────────────────────────────────
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function makeBubble(id, w, h, type, lvlCfg) {
  const isAnchor = type === "anchor";
  const isFast = type === "fast";
  const isSmall = type === "small";
  const speedBase = isFast ? lvlCfg.fastMul : isAnchor ? 0 : 1;
  const r = isSmall ? SMALL_RADIUS : BASE_RADIUS;
  const maxR = type === "bomb"  ? lvlCfg.expansion * 1.8
             : type === "small" ? 55
             : lvlCfg.expansion;
  return {
    id,
    type,
    x: rand(r + 5, w - r - 5),
    y: rand(r + 5, h - r - 5),
    vx: rand(-0.5, 0.5) * speedBase,
    vy: rand(-0.5, 0.5) * speedBase,
    r,
    baseR: r,
    maxR,
    state: "alive",
    holdTimer: 0,
    wobblePhase: Math.random() * Math.PI * 2,
    hits: 0,
    hitSources: new Set(),
    hasSplit: false,
    shieldUp: type === "shield",
    hasTeleported: false,
  };
}

function buildBubbles(lvlIdx, w, h) {
  const cfg = ALL_LEVELS[Math.min(lvlIdx, ALL_LEVELS.length - 1)];
  const bubbles = [];
  let id = 0;
  for (const [type, count] of Object.entries(cfg.mix)) {
    for (let i = 0; i < count; i++) {
      bubbles.push(makeBubble(id++, w, h, type, cfg));
    }
  }
  return bubbles;
}

// ═══════════════════════════════════════════════════════════
//  Main component
// ═══════════════════════════════════════════════════════════
export default function BubbleChain() {
  const canvasRef = useRef(null);
  const bubblesRef = useRef([]);
  const animRef = useRef(null);
  const dimsRef = useRef({ w: 800, h: 600 });
  const nextIdRef = useRef(5000);
  const levelCfgRef = useRef(ALL_LEVELS[0]);
  const scoreRef = useRef(0);
  const gameStateRef = useRef("ready");

  const [gameState, setGameState] = useState("ready");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [best, setBest] = useState(0);
  const [showTypes, setShowTypes] = useState(false);
  const [newType, setNewType] = useState(null);

  const levelCfg = ALL_LEVELS[Math.min(level, ALL_LEVELS.length - 1)];
  const total = levelCfg.total;
  const passThreshold = Math.ceil(total * levelCfg.passPercent);
  const passed = score >= passThreshold;

  // Sync refs
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const resetBubbles = useCallback((lvlIdx) => {
    const { w, h } = dimsRef.current;
    bubblesRef.current = buildBubbles(lvlIdx, w, h);
    levelCfgRef.current = ALL_LEVELS[Math.min(lvlIdx, ALL_LEVELS.length - 1)];
    nextIdRef.current = 5000;
  }, []);

  // Canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dimsRef.current = { w: rect.width, h: rect.height };
      if (bubblesRef.current.length === 0) resetBubbles(0);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resetBubbles]);

  // ── Animation loop ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frame = 0;

    const tick = () => {
      frame++;
      const { w, h } = dimsRef.current;
      const bubbles = bubblesRef.current;
      const cfg = levelCfgRef.current;

      // Background
      const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h));
      grad.addColorStop(0, "#0a1a2e");
      grad.addColorStop(0.6, "#050a18");
      grad.addColorStop(1, "#000308");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Drifting plankton
      for (let i = 0; i < 45; i++) {
        const px = (i * 97 + frame * 0.3) % w;
        const py = (i * 53 + frame * 0.15) % h;
        const alpha = 0.04 + Math.sin(frame * 0.01 + i) * 0.03;
        ctx.fillStyle = `rgba(125, 249, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update bubbles
      for (const b of bubbles) {
        if (b.state === "dead") continue;

        if (b.state === "alive") {
          if (b.type !== "anchor") {
            b.x += b.vx;
            b.y += b.vy;
          }
          b.wobblePhase += 0.04;

          // Magnet pull
          if (b.type === "magnet") {
            for (const other of bubbles) {
              if (other === b || other.state !== "alive") continue;
              if (other.type === "anchor" || other.type === "magnet") continue;
              const dx = b.x - other.x;
              const dy = b.y - other.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 180 && dist > 5) {
                const pull = 0.08;
                other.vx += (dx / dist) * pull;
                other.vy += (dy / dist) * pull;
                const spd = Math.sqrt(other.vx * other.vx + other.vy * other.vy);
                const maxSpd = other.type === "fast" ? 3.5 : 1.6;
                if (spd > maxSpd) {
                  other.vx = (other.vx / spd) * maxSpd;
                  other.vy = (other.vy / spd) * maxSpd;
                }
              }
            }
          }

          // Bounce off walls
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
          if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx); }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
          if (b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy); }
        } else if (b.state === "growing") {
          b.r += EXPANSION_SPEED;
          if (b.r >= b.maxR) {
            b.r = b.maxR;
            b.state = "holding";
            b.holdTimer = 0;
          }
        } else if (b.state === "holding") {
          b.holdTimer++;
          if (b.holdTimer >= cfg.hold) b.state = "shrinking";
        } else if (b.state === "shrinking") {
          const shrinkSpd = b.type === "bomb" ? SHRINK_SPEED * 2 : SHRINK_SPEED;
          b.r -= shrinkSpd;
          if (b.r <= 0) {
            b.r = 0;
            if (b.type === "splitter" && !b.hasSplit) {
              b.hasSplit = true;
              for (let k = 0; k < 2; k++) {
                const small = makeBubble(nextIdRef.current++, w, h, "small", cfg);
                small.x = b.x + rand(-12, 12);
                small.y = b.y + rand(-12, 12);
                small.state = "growing";
                small.r = 4;
                bubbles.push(small);
              }
            }
            b.state = "dead";
          }
        }
      }

      // Collisions — expanding bubbles ignite alive ones
      for (const a of bubbles) {
        if (a.state !== "growing" && a.state !== "holding") continue;
        if (a.type === "ghost") continue;
        for (const b of bubbles) {
          if (b.state !== "alive") continue;
          if (b.hitSources.has(a.id)) continue;

          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= a.r + b.r) continue;

          // Record this source so it doesn't re-hit every frame
          b.hitSources.add(a.id);

          // Shield absorbs first hit only
          if (b.type === "shield" && b.shieldUp) {
            b.shieldUp = false;
            continue;
          }

          // Heavy needs two distinct sources
          if (b.type === "heavy") {
            b.hits++;
            if (b.hits < 2) continue;
          }

          // Teleporter warps then ignites
          if (b.type === "teleporter" && !b.hasTeleported) {
            b.hasTeleported = true;
            b.x = rand(b.r + 10, w - b.r - 10);
            b.y = rand(b.r + 10, h - b.r - 10);
            // Keep hitSources so `a` doesn't immediately re-trigger
          }

          b.state = "growing";
          setScore(s => s + 1);
        }
      }

      // Draw
      for (const b of bubbles) {
        if (b.state === "dead" || b.r <= 0) continue;
        drawBubble(ctx, b, frame);
      }

      // Detect round end (from resolving state)
      if (gameStateRef.current === "resolving") {
        const anyActive = bubbles.some(
          b => b.state === "growing" || b.state === "holding" || b.state === "shrinking"
        );
        if (!anyActive) {
          setGameState("done");
        }
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // ── Draw a single bubble ─────────────────────────────────
  function drawBubble(ctx, b, frame) {
    const colors = PALETTE[b.type] || PALETTE.normal;
    const wobble = Math.sin(b.wobblePhase) * 0.5;
    const displayR = b.r + (b.state === "alive" ? wobble : 0);
    if (displayR <= 0) return;
    const isGhost = b.type === "ghost";
    const alphaMul = isGhost ? 0.45 : 1;

    // Outer glow
    const glowGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, displayR * 2.2);
    glowGrad.addColorStop(0, colors.glow + (isGhost ? "55" : "cc"));
    glowGrad.addColorStop(0.3, colors.glow + (isGhost ? "18" : "44"));
    glowGrad.addColorStop(1, colors.glow + "00");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, displayR * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGrad = ctx.createRadialGradient(
      b.x - displayR * 0.3, b.y - displayR * 0.3, displayR * 0.1,
      b.x, b.y, displayR
    );
    bodyGrad.addColorStop(0, `rgba(255,255,255,${0.9 * alphaMul})`);
    bodyGrad.addColorStop(0.15, colors.core + (isGhost ? "88" : "ee"));
    bodyGrad.addColorStop(0.7, colors.core + (isGhost ? "33" : "66"));
    bodyGrad.addColorStop(1, colors.glow + (isGhost ? "11" : "22"));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, displayR, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.strokeStyle = colors.core + (isGhost ? "44" : "88");
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Type glyph
    if (b.type === "heavy") {
      ctx.strokeStyle = `rgba(255,255,255,${b.hits >= 1 ? 0.3 : 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - displayR * 0.4, b.y); ctx.lineTo(b.x + displayR * 0.4, b.y);
      ctx.moveTo(b.x, b.y - displayR * 0.4); ctx.lineTo(b.x, b.y + displayR * 0.4);
      ctx.stroke();
    } else if (b.type === "splitter") {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, displayR * 0.45, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x, b.y, displayR * 0.25, 0, Math.PI * 2); ctx.stroke();
    } else if (b.type === "fast") {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      const ang = Math.atan2(b.vy, b.vx);
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 4;
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(ang) * displayR * 1.1 + Math.sin(ang) * off, b.y - Math.sin(ang) * displayR * 1.1 - Math.cos(ang) * off);
        ctx.lineTo(b.x - Math.cos(ang) * displayR * 1.5 + Math.sin(ang) * off, b.y - Math.sin(ang) * displayR * 1.5 - Math.cos(ang) * off);
        ctx.stroke();
      }
    } else if (b.type === "anchor") {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      const s = displayR * 0.5;
      ctx.beginPath();
      ctx.moveTo(b.x - s, b.y - s * 0.6); ctx.lineTo(b.x - s, b.y + s * 0.6);
      ctx.moveTo(b.x + s, b.y - s * 0.6); ctx.lineTo(b.x + s, b.y + s * 0.6);
      ctx.stroke();
    } else if (b.type === "ghost") {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "rgba(224,224,255,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (b.type === "magnet") {
      ctx.strokeStyle = "rgba(255,85,119,0.5)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a1 = (frame * 0.03 + i * 2.1);
        ctx.beginPath();
        ctx.arc(b.x, b.y, displayR * (0.3 + i * 0.2), a1, a1 + 1.2);
        ctx.stroke();
      }
    } else if (b.type === "shield") {
      if (b.shieldUp && b.state === "alive") {
        ctx.strokeStyle = "rgba(68,221,255,0.8)";
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, displayR * 1.15, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(68,221,255,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(b.x, b.y, displayR * 1.25, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (b.type === "teleporter") {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(frame * 0.05);
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = "rgba(255,68,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, displayR * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else if (b.type === "bomb") {
      ctx.strokeStyle = "rgba(255,238,68,0.6)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i + frame * 0.02;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * displayR * 0.5, b.y + Math.sin(a) * displayR * 0.5);
        ctx.lineTo(b.x + Math.cos(a) * displayR * 0.85, b.y + Math.sin(a) * displayR * 0.85);
        ctx.stroke();
      }
    }

    // Specular highlight
    ctx.beginPath();
    ctx.arc(b.x - displayR * 0.35, b.y - displayR * 0.35, displayR * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.45 * alphaMul})`;
    ctx.fill();
  }

  // ── Click handler ────────────────────────────────────────
  const handleClick = (e) => {
    if (gameState !== "playing") return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    let hit = null;
    let hitDist = Infinity;
    for (const b of bubblesRef.current) {
      if (b.state !== "alive") continue;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < b.r + 4 && d < hitDist) {
        hit = b;
        hitDist = d;
      }
    }
    if (hit) {
      // Direct click bypasses defenses
      if (hit.type === "heavy") hit.hits = 2;
      if (hit.type === "shield") hit.shieldUp = false;
      if (hit.type === "teleporter") hit.hasTeleported = true;
      hit.state = "growing";
      setScore(1);
      setGameState("resolving");
    }
  };

  useEffect(() => {
    if (gameState === "done") {
      setTotalScore(t => t + scoreRef.current);
      setBest(b => Math.max(b, scoreRef.current));
    }
  }, [gameState]);

  const startLevel = (lvlIdx) => {
    resetBubbles(lvlIdx);
    setScore(0);
    setLevel(lvlIdx);
    const intro = TYPE_INFO.find(t => t.intro === lvlIdx + 1);
    if (intro && lvlIdx > 0) {
      setNewType(intro);
      setGameState("ready");
    } else {
      setNewType(null);
      setGameState("playing");
    }
  };

  const dismissNewType = () => {
    setNewType(null);
    setGameState("playing");
  };

  const nextLevel = () => {
    if (level + 1 >= 100) {
      setGameState("gameover");
    } else {
      startLevel(level + 1);
    }
  };

  const restartRun = () => {
    setTotalScore(0);
    startLevel(0);
  };

  const typesInLevel = Object.keys(levelCfg.mix);

  return (
    <div style={{
      width: "100%", height: "100vh", minHeight: "600px",
      background: "#000308",
      fontFamily: "'Courier New', monospace",
      color: "#7df9ff",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      {/* HUD */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "14px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        zIndex: 10, pointerEvents: "none",
        textShadow: "0 0 10px #7df9ff",
      }}>
        <div>
          <div style={{ fontSize: "9px", letterSpacing: "3px", opacity: 0.6 }}>
            LV {String(level + 1).padStart(3, "0")} · {levelCfg.name}
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold", letterSpacing: "2px" }}>
            {String(score).padStart(2, "0")}
            <span style={{ fontSize: "11px", opacity: 0.5 }}> / {total}</span>
          </div>
          <div style={{ fontSize: "8px", opacity: 0.5, letterSpacing: "2px" }}>
            NEED {passThreshold}
          </div>
          <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap", maxWidth: "180px" }}>
            {typesInLevel.map(t => (
              <div key={t} title={t} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: PALETTE[t]?.core || "#fff",
                boxShadow: `0 0 6px ${PALETTE[t]?.glow || "#fff"}`,
              }} />
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "9px", letterSpacing: "3px", opacity: 0.6 }}>TOTAL</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", letterSpacing: "2px" }}>{totalScore}</div>
          <div style={{ fontSize: "9px", letterSpacing: "3px", opacity: 0.6, marginTop: "2px" }}>BEST CHAIN</div>
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>{best}</div>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{
            display: "block", width: "100%", height: "100%",
            cursor: gameState === "playing" ? "crosshair" : "default",
          }}
        />

        {gameState === "ready" && !newType && (
          <Overlay>
            <div style={{ fontSize: "10px", letterSpacing: "6px", opacity: 0.6, marginBottom: "12px" }}>
              ONE CLICK · MAX CHAIN · 100 LEVELS
            </div>
            <div style={{
              fontSize: "48px", fontWeight: "bold", letterSpacing: "4px", marginBottom: "16px",
              textShadow: "0 0 20px #7df9ff, 0 0 40px #7df9ff", lineHeight: 1,
            }}>
              CHAIN<br/>REACTION
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, maxWidth: "340px", textAlign: "center", lineHeight: 1.6, marginBottom: "22px" }}>
              Pop one bubble. It swells and ignites any it touches.
              New bubble types appear as you progress.
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
              <Btn onClick={() => startLevel(0)}>◉ BEGIN</Btn>
              <Btn onClick={() => setShowTypes(true)} ghost>? TYPES</Btn>
            </div>
          </Overlay>
        )}

        {newType && (
          <Overlay>
            <div style={{ fontSize: "10px", letterSpacing: "6px", opacity: 0.6, marginBottom: "16px" }}>
              NEW BUBBLE TYPE
            </div>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: PALETTE[newType.type]?.core,
              boxShadow: `0 0 30px ${PALETTE[newType.type]?.glow}, 0 0 60px ${PALETTE[newType.type]?.glow}`,
              marginBottom: "16px",
            }} />
            <div style={{
              fontSize: "28px", fontWeight: "bold", letterSpacing: "4px", marginBottom: "8px",
              color: PALETTE[newType.type]?.core,
              textShadow: `0 0 15px ${PALETTE[newType.type]?.glow}`,
            }}>
              {newType.name}
            </div>
            <div style={{ fontSize: "13px", opacity: 0.8, maxWidth: "320px", textAlign: "center", lineHeight: 1.6, marginBottom: "24px" }}>
              {newType.desc}
            </div>
            <Btn onClick={dismissNewType}>▸ GOT IT</Btn>
          </Overlay>
        )}

        {gameState === "done" && (
          <Overlay>
            <div style={{ fontSize: "10px", letterSpacing: "6px", opacity: 0.6, marginBottom: "10px" }}>
              {passed ? `LEVEL ${level + 1} CLEARED` : "CHAIN BROKEN"}
            </div>
            <div style={{
              fontSize: "60px", fontWeight: "bold", letterSpacing: "2px", marginBottom: "4px", lineHeight: 1,
              textShadow: passed ? "0 0 20px #7df9ff, 0 0 40px #7df9ff" : "0 0 20px #ff6ec7",
              color: passed ? "#7df9ff" : "#ff6ec7",
            }}>
              {score}<span style={{ fontSize: "22px", opacity: 0.5 }}>/{total}</span>
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "8px", marginBottom: "22px" }}>
              {passed
                ? (score === total ? "⟡ PERFECT CLEAR ⟡" :
                   score >= total * 0.9 ? "outstanding." :
                   score >= total * 0.75 ? "impressive chain." : "onward.")
                : `needed ${passThreshold} to advance.`}
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
              {passed ? (
                <Btn onClick={nextLevel}>
                  {level + 1 >= 100 ? "★ FINISH" : `▸ LEVEL ${level + 2}`}
                </Btn>
              ) : (
                <Btn onClick={() => startLevel(level)}>↻ RETRY</Btn>
              )}
              <Btn onClick={restartRun} ghost>⟲ RESTART</Btn>
            </div>
          </Overlay>
        )}

        {gameState === "gameover" && (
          <Overlay>
            <div style={{ fontSize: "10px", letterSpacing: "6px", opacity: 0.6, marginBottom: "12px" }}>
              ALL 100 LEVELS CLEARED
            </div>
            <div style={{
              fontSize: "52px", fontWeight: "bold", letterSpacing: "3px", marginBottom: "12px",
              textShadow: "0 0 25px #c4f542, 0 0 50px #c4f542",
              color: "#c4f542", lineHeight: 1,
            }}>
              SINGULARITY<br/>REACHED
            </div>
            <div style={{ fontSize: "14px", opacity: 0.8, marginBottom: "6px" }}>
              final total: <span style={{ fontWeight: "bold", color: "#fff" }}>{totalScore}</span>
            </div>
            <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "24px" }}>
              best single chain: {best}
            </div>
            <Btn onClick={restartRun}>⟲ RUN AGAIN</Btn>
          </Overlay>
        )}

        {showTypes && (
          <Overlay>
            <div style={{ fontSize: "10px", letterSpacing: "6px", opacity: 0.6, marginBottom: "16px" }}>
              ALL BUBBLE TYPES
            </div>
            <div style={{
              display: "flex", flexDirection: "column", gap: "8px",
              maxWidth: "440px", fontSize: "11px", marginBottom: "20px",
              maxHeight: "60vh", overflowY: "auto", padding: "4px 8px",
            }}>
              {TYPE_INFO.map(t => (
                <div key={t.type} style={{ display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                    background: PALETTE[t.type]?.core,
                    boxShadow: `0 0 10px ${PALETTE[t.type]?.glow}`,
                  }} />
                  <div style={{ fontWeight: "bold", letterSpacing: "2px", width: "95px", color: PALETTE[t.type]?.core, fontSize: "10px" }}>
                    {t.name}
                  </div>
                  <div style={{ opacity: 0.75, flex: 1 }}>{t.desc}</div>
                  <div style={{ opacity: 0.4, fontSize: "9px", width: "40px", textAlign: "right" }}>LV {t.intro}</div>
                </div>
              ))}
            </div>
            <Btn onClick={() => setShowTypes(false)}>◀ BACK</Btn>
          </Overlay>
        )}
      </div>
    </div>
  );
}

// ── UI primitives ──────────────────────────────────────────
function Overlay({ children }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(0, 3, 8, 0.82)",
      backdropFilter: "blur(6px)",
      color: "#7df9ff", textAlign: "center", padding: "20px", zIndex: 20,
    }}>
      {children}
    </div>
  );
}

function Btn({ onClick, children, ghost = false }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: ghost ? "transparent" : (hover ? "#7df9ff" : "transparent"),
        color: ghost ? (hover ? "#7df9ff" : "rgba(125,249,255,0.7)") : (hover ? "#000308" : "#7df9ff"),
        border: ghost ? "1px solid rgba(125,249,255,0.4)" : "1px solid #7df9ff",
        padding: "12px 24px", fontSize: "13px", letterSpacing: "3px",
        fontFamily: "'Courier New', monospace", cursor: "pointer",
        textShadow: hover && !ghost ? "none" : "0 0 8px #7df9ff",
        boxShadow: hover && !ghost ? "0 0 30px #7df9ff" : "0 0 10px rgba(125, 249, 255, 0.2)",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}

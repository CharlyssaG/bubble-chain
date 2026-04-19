import React, { useState, useEffect, useRef, useCallback } from "react";
import { ALL_LEVELS, TYPE_INFO } from "./levels.js";
import { REALMS, realmForLevel } from "./realms.js";
import { playPop, resumeAudio, setAudioEnabled, isAudioEnabled } from "./audio.js";

// ═══════════════════════════════════════════════════════════
//  CHAIN REACTION — 1000 levels, 10 realms, 10 bubble types
// ═══════════════════════════════════════════════════════════

// ── Base sizing (scaled per-screen) ──────────────────────
const BASE_RADIUS_REF = 22;
const SMALL_RADIUS_REF = 13;
const EXPANSION_SPEED_REF = 2.2;
const SHRINK_SPEED_REF = 1.8;
const REFERENCE_SCREEN_AREA = 380 * 600; // portrait phone

// ── Type palette per realm (each realm tints the bubbles) ─
function paletteForRealm(realm) {
  // Base palette — all realms have variations on these hues
  const base = {
    normal:     { core: realm.accent,          glow: realm.accentGlow },
    ghost:      { core: "#e0e0ff",             glow: "#9090c0" },
    heavy:      { core: realm.secondaryAccent, glow: realm.secondaryAccent },
    splitter:   { core: "#c4f542",             glow: "#a6e22e" },
    fast:       { core: "#ffb347",             glow: "#ff8c42" },
    anchor:     { core: "#b39dff",             glow: "#9b7cff" },
    small:      { core: "#5ef0c0",             glow: "#2ee6a8" },
    magnet:     { core: "#ff5577",             glow: "#ff2244" },
    shield:     { core: "#44ddff",             glow: "#22aadd" },
    teleporter: { core: "#ff44ff",             glow: "#cc22cc" },
    bomb:       { core: "#ffee44",             glow: "#ddcc00" },
  };
  // Realm-specific tweaks for flavor
  if (realm.id === "candy") {
    base.normal = { core: "#ff9ed8", glow: "#ff6ec7" };
    base.heavy  = { core: "#ffee55", glow: "#ddcc00" };
    base.ghost  = { core: "#ffffff", glow: "#ffddee" };
  } else if (realm.id === "horror") {
    base.normal = { core: "#ff3838", glow: "#aa0000" };
    base.ghost  = { core: "#cccccc", glow: "#666666" };
  } else if (realm.id === "volcanic") {
    base.normal = { core: "#ff8844", glow: "#ff4400" };
  } else if (realm.id === "crystal") {
    base.normal = { core: "#c8a0ff", glow: "#9944ff" };
  } else if (realm.id === "clockwork") {
    base.normal = { core: "#d4a55a", glow: "#aa7722" };
  } else if (realm.id === "final") {
    base.normal = { core: "#ffe888", glow: "#ffaa00" };
  } else if (realm.id === "ocean") {
    base.normal = { core: "#5ef0c0", glow: "#2ee6a8" };
    base.heavy  = { core: "#ffbb44", glow: "#ff8844" };
  } else if (realm.id === "themepark") {
    base.normal = { core: "#ffdc50", glow: "#ff8800" };
    base.heavy  = { core: "#ff3366", glow: "#cc1144" };
  } else if (realm.id === "dream") {
    base.normal = { core: "#ffb8e8", glow: "#d888ff" };
  }
  return base;
}

// ── Bubble factory ──────────────────────────────────────
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function makeBubble(id, w, h, type, lvlCfg, scale) {
  const isAnchor = type === "anchor";
  const isFast = type === "fast";
  const isSmall = type === "small";
  const isHeavy = type === "heavy";

  // Heavy bubbles move slower (per request)
  const speedBase =
    isFast   ? lvlCfg.fastMul :
    isAnchor ? 0 :
    isHeavy  ? 0.4 :
    1;

  const r = (isSmall ? SMALL_RADIUS_REF : BASE_RADIUS_REF) * scale;
  const maxR =
    type === "bomb"  ? lvlCfg.expansion * scale * 1.8 :
    type === "small" ? 55 * scale :
    lvlCfg.expansion * scale;

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
    splitsRemaining: type === "splitter" ? 2 : 0, // per request: explode twice
    hasSplit: false,
    shieldUp: type === "shield",
    hasTeleported: false,
    teleportTimer: 0, // for chaotic teleporter direction changes
  };
}

function buildBubbles(lvlCfg, w, h, scale) {
  const bubbles = [];
  let id = 0;
  for (const [type, count] of Object.entries(lvlCfg.mix)) {
    for (let i = 0; i < count; i++) {
      bubbles.push(makeBubble(id++, w, h, type, lvlCfg, scale));
    }
  }
  return bubbles;
}

// ── Screen scaling ──────────────────────────────────────
function computeScale(w, h) {
  // Scale everything so the game feels right on any screen size.
  // Reference: 380x600 portrait. On larger screens, make bubbles bigger.
  const area = w * h;
  const areaScale = Math.sqrt(area / REFERENCE_SCREEN_AREA);
  // Clamp: never shrink below 0.85, allow growth up to 1.8x on big monitors
  return Math.max(0.85, Math.min(1.8, areaScale));
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function BubbleChain() {
  const canvasRef = useRef(null);
  const bubblesRef = useRef([]);
  const animRef = useRef(null);
  const dimsRef = useRef({ w: 800, h: 600, scale: 1 });
  const nextIdRef = useRef(5000);
  const levelCfgRef = useRef(ALL_LEVELS[0]);
  const paletteRef = useRef(paletteForRealm(ALL_LEVELS[0].realm));
  const scoreRef = useRef(0);
  const gameStateRef = useRef("ready");

  // Persisted progress — loaded on mount
  const [level, setLevel] = useState(0); // 0-indexed
  const [totalScore, setTotalScore] = useState(0);
  const [best, setBest] = useState(0);

  const [gameState, setGameState] = useState("ready");
  const [score, setScore] = useState(0);
  const [showTypes, setShowTypes] = useState(false);
  const [newType, setNewType] = useState(null);
  const [showRealmIntro, setShowRealmIntro] = useState(false);
  const [showBossIntro, setShowBossIntro] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [audioOn, setAudioOn] = useState(true);

  const levelCfg = ALL_LEVELS[Math.min(level, ALL_LEVELS.length - 1)];
  const realm = levelCfg.realm;
  const total = levelCfg.total;
  const passThreshold = levelCfg.passThreshold;
  const passed = score >= passThreshold;

  // Sync refs
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => {
    levelCfgRef.current = levelCfg;
    paletteRef.current = paletteForRealm(levelCfg.realm);
  }, [level]); // eslint-disable-line

  // ── Load saved progress ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem("chain_reaction_save");
      if (raw) {
        const data = JSON.parse(raw);
        if (typeof data.level === "number") setLevel(data.level);
        if (typeof data.totalScore === "number") setTotalScore(data.totalScore);
        if (typeof data.best === "number") setBest(data.best);
        if (typeof data.audioOn === "boolean") setAudioOn(data.audioOn);
      }
    } catch (e) { /* ignore */ }
    setProgressLoaded(true);
  }, []);

  // Sync audio enabled flag
  useEffect(() => {
    setAudioEnabled(audioOn);
  }, [audioOn]);

  // ── Save progress ──
  useEffect(() => {
    if (!progressLoaded) return;
    try {
      localStorage.setItem(
        "chain_reaction_save",
        JSON.stringify({ level, totalScore, best, audioOn })
      );
    } catch (e) { /* ignore */ }
  }, [level, totalScore, best, audioOn, progressLoaded]);

  const resetBubbles = useCallback((lvlIdx) => {
    const { w, h, scale } = dimsRef.current;
    const cfg = ALL_LEVELS[Math.min(lvlIdx, ALL_LEVELS.length - 1)];
    bubblesRef.current = buildBubbles(cfg, w, h, scale);
    levelCfgRef.current = cfg;
    paletteRef.current = paletteForRealm(cfg.realm);
    nextIdRef.current = 5000;
  }, []);

  // ── Canvas sizing (full-window responsive) ──
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
      const scale = computeScale(rect.width, rect.height);
      dimsRef.current = { w: rect.width, h: rect.height, scale };
      if (bubblesRef.current.length === 0) resetBubbles(0);
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, [resetBubbles]);

  // ── Main animation loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frame = 0;

    const tick = () => {
      frame++;
      const { w, h, scale } = dimsRef.current;
      const bubbles = bubblesRef.current;
      const cfg = levelCfgRef.current;
      const palette = paletteRef.current;
      const realmLocal = cfg.realm;

      drawBackground(ctx, w, h, frame, realmLocal);

      // Update
      for (const b of bubbles) {
        if (b.state === "dead") continue;

        if (b.state === "alive") {
          if (b.type !== "anchor") {
            b.x += b.vx;
            b.y += b.vy;
          }
          b.wobblePhase += 0.04;

          // Teleporter: erratic direction changes
          if (b.type === "teleporter") {
            b.teleportTimer++;
            if (b.teleportTimer > 40 + Math.random() * 60) {
              b.teleportTimer = 0;
              // Random teleport
              if (Math.random() < 0.4) {
                b.x = rand(b.r + 10, w - b.r - 10);
                b.y = rand(b.r + 10, h - b.r - 10);
              } else {
                // Just change direction violently
                b.vx = rand(-1.5, 1.5);
                b.vy = rand(-1.5, 1.5);
              }
            }
          }

          // Magnet: attracts everything (except other magnets), repels magnets
          if (b.type === "magnet") {
            for (const other of bubbles) {
              if (other === b || other.state !== "alive") continue;
              if (other.type === "anchor") continue;
              const dx = b.x - other.x;
              const dy = b.y - other.y;
              const distSq = dx * dx + dy * dy;
              const dist = Math.sqrt(distSq);
              if (dist < 5) continue;

              if (other.type === "magnet") {
                // REPEL magnets away from each other
                if (dist < 220 * scale) {
                  const force = 0.12 * scale;
                  other.vx -= (dx / dist) * force;
                  other.vy -= (dy / dist) * force;
                }
              } else {
                // ATTRACT everything else
                if (dist < 200 * scale) {
                  const pull = 0.09 * scale;
                  other.vx += (dx / dist) * pull;
                  other.vy += (dy / dist) * pull;
                }
              }
              // Cap speed
              const spd = Math.sqrt(other.vx * other.vx + other.vy * other.vy);
              const maxSpd = other.type === "fast" ? 4 : other.type === "heavy" ? 0.9 : 1.8;
              if (spd > maxSpd) {
                other.vx = (other.vx / spd) * maxSpd;
                other.vy = (other.vy / spd) * maxSpd;
              }
            }
          }

          // Walls
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
          if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx); }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
          if (b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy); }
        } else if (b.state === "growing") {
          b.r += EXPANSION_SPEED_REF * scale;
          if (b.r >= b.maxR) {
            b.r = b.maxR;
            b.state = "holding";
            b.holdTimer = 0;
          }
        } else if (b.state === "holding") {
          b.holdTimer++;
          if (b.holdTimer >= cfg.hold) b.state = "shrinking";
        } else if (b.state === "shrinking") {
          const spd = (b.type === "bomb" ? SHRINK_SPEED_REF * 2 : SHRINK_SPEED_REF) * scale;
          b.r -= spd;
          if (b.r <= 0) {
            b.r = 0;
            // Splitter explodes twice (per request)
            if (b.type === "splitter" && b.splitsRemaining > 0) {
              const count = b.splitsRemaining === 2 ? 3 : 2; // 3 + 2 = 5 small bubbles total
              for (let k = 0; k < count; k++) {
                const small = makeBubble(nextIdRef.current++, w, h, "small", cfg, scale);
                small.x = b.x + rand(-12, 12);
                small.y = b.y + rand(-12, 12);
                small.vx = rand(-1.2, 1.2);
                small.vy = rand(-1.2, 1.2);
                small.state = "growing";
                small.r = 4 * scale;
                // If we still have more splits, mark these as splitters too
                if (b.splitsRemaining > 1) {
                  small.type = "splitter";
                  small.splitsRemaining = 1;
                }
                bubbles.push(small);
              }
              b.splitsRemaining = 0;
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

          b.hitSources.add(a.id);

          // Shield absorbs first hit
          if (b.type === "shield" && b.shieldUp) {
            b.shieldUp = false;
            playPop("shield", b.x / w);
            continue;
          }

          // Heavy needs 2 distinct hits
          if (b.type === "heavy") {
            b.hits++;
            if (b.hits < 2) {
              // First chain hit — quieter thunk to signal progress
              playPop("small", b.x / w);
              continue;
            }
          }

          // Teleporter warps when chain-hit (chaotic per request)
          if (b.type === "teleporter" && !b.hasTeleported) {
            b.hasTeleported = true;
            b.x = rand(b.r + 10, w - b.r - 10);
            b.y = rand(b.r + 10, h - b.r - 10);
          }

          b.state = "growing";
          playPop(b.type, b.x / w);
          setScore(s => s + 1);
        }
      }

      // Draw bubbles
      for (const b of bubbles) {
        if (b.state === "dead" || b.r <= 0) continue;
        drawBubble(ctx, b, frame, palette, scale);
      }

      // End of round detection
      if (gameStateRef.current === "resolving") {
        const anyActive = bubbles.some(
          b => b.state === "growing" || b.state === "holding" || b.state === "shrinking"
        );
        if (!anyActive) setGameState("done");
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // ── Click handler (also handles touch) ──
  const handlePointer = (e) => {
    resumeAudio(); // unlock audio on first gesture
    if (gameState !== "playing") return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    const cx = pt.clientX - rect.left;
    const cy = pt.clientY - rect.top;

    let hit = null;
    let hitDist = Infinity;
    for (const b of bubblesRef.current) {
      if (b.state !== "alive") continue;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < b.r + 6 && d < hitDist) {
        hit = b;
        hitDist = d;
      }
    }
    if (hit) {
      const { w } = dimsRef.current;
      const panX = hit.x / w;

      // Heavy: require 2 taps (per request)
      if (hit.type === "heavy") {
        hit.hits++;
        if (hit.hits < 2) {
          // First tap — play anchor-ish thunk to signal the hit registered
          playPop("anchor", panX);
          return;
        }
      }
      if (hit.type === "shield") hit.shieldUp = false;
      if (hit.type === "teleporter") hit.hasTeleported = true;
      hit.state = "growing";
      playPop(hit.type, panX);
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

  // ── Level navigation ──
  const startLevel = (lvlIdx) => {
    resumeAudio(); // unlock audio on any level start
    resetBubbles(lvlIdx);
    setScore(0);
    setLevel(lvlIdx);

    const n = lvlIdx + 1;
    const prevLvl = level;
    const prevN = prevLvl + 1;

    // Check for realm transition (entered a new realm)
    const newRealm = realmForLevel(n);
    const prevRealm = realmForLevel(prevN);
    const isRealmEntry = n === 1 || (newRealm.id !== prevRealm.id && lvlIdx > prevLvl);

    // Check for new type introduction
    const intro = TYPE_INFO.find(t => t.intro === n);

    // Check for boss
    const cfg = ALL_LEVELS[lvlIdx];

    if (isRealmEntry && lvlIdx > 0) {
      setShowRealmIntro(true);
      setNewType(null);
      setShowBossIntro(false);
      setGameState("ready");
    } else if (intro && lvlIdx > 0) {
      setNewType(intro);
      setShowRealmIntro(false);
      setShowBossIntro(false);
      setGameState("ready");
    } else if (cfg.boss && lvlIdx > 0) {
      setShowBossIntro(true);
      setNewType(null);
      setShowRealmIntro(false);
      setGameState("ready");
    } else {
      setNewType(null);
      setShowRealmIntro(false);
      setShowBossIntro(false);
      setGameState("playing");
    }
  };

  const dismissIntro = () => {
    setNewType(null);
    setShowRealmIntro(false);
    setShowBossIntro(false);
    setGameState("playing");
  };

  const nextLevel = () => {
    if (level + 1 >= 1000) {
      setGameState("gameover");
    } else {
      startLevel(level + 1);
    }
  };

  // Fail: go back to start of current 10-level round
  const retryRound = () => {
    const roundStart = levelCfg.roundStart - 1; // to 0-indexed
    startLevel(roundStart);
  };

  const restartGame = () => {
    if (!confirm("Erase all progress and restart from level 1?")) return;
    setTotalScore(0);
    setBest(0);
    try { localStorage.removeItem("chain_reaction_save"); } catch (e) { /* ignore */ }
    startLevel(0);
  };

  const typesInLevel = Object.keys(levelCfg.mix);
  const palette = paletteRef.current;

  return (
    <div style={{
      width: "100%", height: "100vh", minHeight: "100vh",
      background: realm.bg[2],
      fontFamily: realm.font,
      color: realm.accent,
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      {/* HUD */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        zIndex: 10, pointerEvents: "none",
        textShadow: `0 0 10px ${realm.accentGlow}`,
      }}>
        <div>
          <div style={{ fontSize: "9px", letterSpacing: "2px", opacity: 0.7, color: realm.accent }}>
            {realm.name} · LV {String(level + 1).padStart(4, "0")}
            {levelCfg.boss && <span style={{ color: realm.secondaryAccent, marginLeft: 6 }}>⚔ BOSS</span>}
          </div>
          <div style={{ fontSize: "13px", letterSpacing: "3px", opacity: 0.85, marginTop: 2 }}>
            {levelCfg.name}
          </div>
          <div style={{ fontSize: "22px", fontWeight: "bold", letterSpacing: "2px", marginTop: 2 }}>
            {String(score).padStart(2, "0")}
            <span style={{ fontSize: "11px", opacity: 0.5 }}> / {total}</span>
          </div>
          <div style={{ fontSize: "8px", opacity: 0.5, letterSpacing: "2px" }}>
            NEED {passThreshold}
          </div>
          <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap", maxWidth: "160px" }}>
            {typesInLevel.map(t => (
              <div key={t} title={t} style={{
                width: 7, height: 7, borderRadius: "50%",
                background: palette[t]?.core || "#fff",
                boxShadow: `0 0 4px ${palette[t]?.glow || "#fff"}`,
              }} />
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "8px", letterSpacing: "2px", opacity: 0.6 }}>PROGRESS</div>
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>
            {level + 1}<span style={{ opacity: 0.4 }}>/1000</span>
          </div>
          <div style={{ fontSize: "8px", letterSpacing: "2px", opacity: 0.6, marginTop: 4 }}>TOTAL</div>
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>{totalScore}</div>
          <div style={{ fontSize: "8px", letterSpacing: "2px", opacity: 0.6, marginTop: 4 }}>BEST</div>
          <div style={{ fontSize: "13px", fontWeight: "bold" }}>{best}</div>
          <button
            onClick={() => { resumeAudio(); setAudioOn(a => !a); }}
            style={{
              marginTop: 8,
              background: "transparent",
              border: `1px solid rgba(${hexToRgb(realm.accent)}, 0.4)`,
              color: realm.accent,
              fontSize: "10px",
              padding: "4px 8px",
              letterSpacing: "2px",
              fontFamily: realm.font,
              cursor: "pointer",
              pointerEvents: "auto",
              textShadow: `0 0 6px ${realm.accentGlow}`,
            }}
          >
            {audioOn ? "♪ ON" : "♪ OFF"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <canvas
          ref={canvasRef}
          onClick={handlePointer}
          onTouchStart={(e) => { e.preventDefault(); handlePointer(e); }}
          style={{
            display: "block", width: "100%", height: "100%",
            cursor: gameState === "playing" ? "crosshair" : "default",
            touchAction: "none",
          }}
        />

        {/* MAIN MENU */}
        {gameState === "ready" && !newType && !showRealmIntro && !showBossIntro && (
          <Overlay realm={realm}>
            <div style={{ fontSize: "10px", letterSpacing: "5px", opacity: 0.6, marginBottom: "10px", color: realm.accent }}>
              ONE CLICK · MAX CHAIN · 1000 LEVELS
            </div>
            <div style={{
              fontSize: "44px", fontWeight: "bold", letterSpacing: "4px", marginBottom: "10px",
              textShadow: `0 0 18px ${realm.accentGlow}, 0 0 36px ${realm.accentGlow}`,
              lineHeight: 1, color: realm.accent,
            }}>
              CHAIN<br/>REACTION
            </div>
            <div style={{ fontSize: "11px", opacity: 0.6, maxWidth: "320px", textAlign: "center", lineHeight: 1.6, marginBottom: "18px", fontStyle: "italic" }}>
              A pilot. Ten realms. One impossible journey home.
            </div>
            {level > 0 && (
              <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "14px" }}>
                resume at <span style={{ color: realm.accent, fontWeight: "bold" }}>LV {level + 1}</span> · {realm.name}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
              <Btn realm={realm} onClick={() => startLevel(level)}>◉ {level > 0 ? "CONTINUE" : "BEGIN"}</Btn>
              <Btn realm={realm} onClick={() => setShowTypes(true)} ghost>? TYPES</Btn>
              {level > 0 && <Btn realm={realm} onClick={restartGame} ghost>⟲ RESTART</Btn>}
            </div>
          </Overlay>
        )}

        {/* REALM INTRO */}
        {showRealmIntro && (
          <Overlay realm={realm}>
            <div style={{ fontSize: "10px", letterSpacing: "5px", opacity: 0.6, marginBottom: "14px" }}>
              ENTERING REALM {realm.index + 1} OF 10
            </div>
            <div style={{
              fontSize: "40px", fontWeight: "bold", letterSpacing: "4px", marginBottom: "6px",
              textShadow: `0 0 20px ${realm.accentGlow}, 0 0 45px ${realm.accentGlow}`,
              color: realm.accent, lineHeight: 1,
            }}>
              {realm.name}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, letterSpacing: "3px", marginBottom: "18px", color: realm.secondaryAccent }}>
              {realm.subtitle}
            </div>
            <div style={{ fontSize: "13px", opacity: 0.85, maxWidth: "340px", textAlign: "center", lineHeight: 1.6, marginBottom: "24px", fontStyle: "italic" }}>
              {realm.lore}
            </div>
            <Btn realm={realm} onClick={dismissIntro}>▸ CONTINUE</Btn>
          </Overlay>
        )}

        {/* BOSS INTRO */}
        {showBossIntro && (
          <Overlay realm={realm}>
            <div style={{ fontSize: "10px", letterSpacing: "5px", opacity: 0.6, marginBottom: "12px", color: realm.secondaryAccent }}>
              ⚔ BOSS ENCOUNTER ⚔
            </div>
            <div style={{
              fontSize: "38px", fontWeight: "bold", letterSpacing: "3px", marginBottom: "6px",
              textShadow: `0 0 20px ${realm.secondaryAccent}, 0 0 40px ${realm.secondaryAccent}`,
              color: realm.secondaryAccent, lineHeight: 1,
            }}>
              {levelCfg.name}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginBottom: "18px", color: realm.accent }}>
              {total} bubbles · clear {passThreshold} to advance
            </div>
            <Btn realm={realm} onClick={dismissIntro}>▸ ENGAGE</Btn>
          </Overlay>
        )}

        {/* NEW TYPE */}
        {newType && (
          <Overlay realm={realm}>
            <div style={{ fontSize: "10px", letterSpacing: "5px", opacity: 0.6, marginBottom: "14px" }}>
              NEW BUBBLE TYPE
            </div>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: palette[newType.type]?.core,
              boxShadow: `0 0 30px ${palette[newType.type]?.glow}, 0 0 60px ${palette[newType.type]?.glow}`,
              marginBottom: "14px",
            }} />
            <div style={{
              fontSize: "26px", fontWeight: "bold", letterSpacing: "4px", marginBottom: "8px",
              color: palette[newType.type]?.core,
              textShadow: `0 0 15px ${palette[newType.type]?.glow}`,
            }}>
              {newType.name}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.8, maxWidth: "320px", textAlign: "center", lineHeight: 1.6, marginBottom: "22px" }}>
              {newType.desc}
            </div>
            <Btn realm={realm} onClick={dismissIntro}>▸ GOT IT</Btn>
          </Overlay>
        )}

        {/* DONE */}
        {gameState === "done" && (
          <Overlay realm={realm}>
            <div style={{ fontSize: "10px", letterSpacing: "5px", opacity: 0.6, marginBottom: "8px" }}>
              {passed ? `${levelCfg.boss ? "BOSS DEFEATED" : "LEVEL CLEARED"}` : "CHAIN BROKEN"}
            </div>
            <div style={{
              fontSize: "52px", fontWeight: "bold", letterSpacing: "2px", marginBottom: "4px", lineHeight: 1,
              textShadow: passed ? `0 0 20px ${realm.accentGlow}, 0 0 40px ${realm.accentGlow}` : "0 0 20px #ff6ec7",
              color: passed ? realm.accent : "#ff6ec7",
            }}>
              {score}<span style={{ fontSize: "20px", opacity: 0.5 }}>/{total}</span>
            </div>
            <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "8px", marginBottom: "20px", maxWidth: "320px", textAlign: "center" }}>
              {passed
                ? (score === total ? "⟡ PERFECT ⟡" :
                   score >= total * 0.9 ? "outstanding." :
                   score >= total * 0.75 ? "impressive." : "onward.")
                : `needed ${passThreshold}. restart round ${Math.floor(levelCfg.roundStart / 10) + 1}.`}
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
              {passed ? (
                <Btn realm={realm} onClick={nextLevel}>
                  {level + 1 >= 1000 ? "★ ASCEND" : `▸ LV ${level + 2}`}
                </Btn>
              ) : (
                <Btn realm={realm} onClick={retryRound}>↻ LV {levelCfg.roundStart}</Btn>
              )}
              <Btn realm={realm} onClick={() => startLevel(level)} ghost>↺ THIS LV</Btn>
            </div>
          </Overlay>
        )}

        {/* GAME OVER (1000 cleared) */}
        {gameState === "gameover" && (
          <Overlay realm={realm}>
            <div style={{ fontSize: "10px", letterSpacing: "5px", opacity: 0.6, marginBottom: "12px" }}>
              THE JOURNEY ENDS
            </div>
            <div style={{
              fontSize: "42px", fontWeight: "bold", letterSpacing: "3px", marginBottom: "8px",
              textShadow: `0 0 25px ${realm.accent}, 0 0 60px ${realm.accent}`,
              color: realm.accent, lineHeight: 1,
            }}>
              YOU MADE IT<br/>HOME
            </div>
            <div style={{ fontSize: "12px", opacity: 0.75, maxWidth: "340px", textAlign: "center", lineHeight: 1.6, marginBottom: "20px", fontStyle: "italic" }}>
              A thousand chains across ten realms. The pilot lands, finally, where they started.
            </div>
            <div style={{ fontSize: "14px", opacity: 0.8, marginBottom: "4px" }}>
              final total: <span style={{ fontWeight: "bold", color: "#fff" }}>{totalScore}</span>
            </div>
            <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "22px" }}>
              best single chain: {best}
            </div>
            <Btn realm={realm} onClick={restartGame}>⟲ AGAIN</Btn>
          </Overlay>
        )}

        {/* TYPES REFERENCE */}
        {showTypes && (
          <Overlay realm={realm}>
            <div style={{ fontSize: "10px", letterSpacing: "5px", opacity: 0.6, marginBottom: "14px" }}>
              BUBBLE TYPES
            </div>
            <div style={{
              display: "flex", flexDirection: "column", gap: "7px",
              maxWidth: "440px", fontSize: "10px", marginBottom: "16px",
              maxHeight: "60vh", overflowY: "auto", padding: "4px 8px",
            }}>
              {TYPE_INFO.map(t => (
                <div key={t.type} style={{ display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                    background: palette[t.type]?.core,
                    boxShadow: `0 0 10px ${palette[t.type]?.glow}`,
                  }} />
                  <div style={{ fontWeight: "bold", letterSpacing: "2px", width: "88px", color: palette[t.type]?.core, fontSize: "10px" }}>
                    {t.name}
                  </div>
                  <div style={{ opacity: 0.75, flex: 1 }}>{t.desc}</div>
                  <div style={{ opacity: 0.4, fontSize: "8px", width: "36px", textAlign: "right" }}>L{t.intro}</div>
                </div>
              ))}
            </div>
            <Btn realm={realm} onClick={() => setShowTypes(false)}>◀ BACK</Btn>
          </Overlay>
        )}
      </div>
    </div>
  );
}

// ── Drawing ──────────────────────────────────────────────
function drawBackground(ctx, w, h, frame, realm) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h));
  grad.addColorStop(0, realm.bg[0]);
  grad.addColorStop(0.6, realm.bg[1]);
  grad.addColorStop(1, realm.bg[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Ambient particles — realm-specific color
  const particleCount = Math.floor(45 * (w * h) / (380 * 600));
  for (let i = 0; i < particleCount; i++) {
    const px = (i * 97 + frame * 0.3) % w;
    const py = (i * 53 + frame * 0.15) % h;
    const alpha = 0.04 + Math.sin(frame * 0.01 + i) * 0.03;
    ctx.fillStyle = realm.particle + alpha + ")";
    ctx.beginPath();
    ctx.arc(px, py, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBubble(ctx, b, frame, palette, scale) {
  const colors = palette[b.type] || palette.normal;
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
    ctx.strokeStyle = `rgba(255,255,255,${b.hits >= 1 ? 0.35 : 0.75})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x - displayR * 0.4, b.y); ctx.lineTo(b.x + displayR * 0.4, b.y);
    ctx.moveTo(b.x, b.y - displayR * 0.4); ctx.lineTo(b.x, b.y + displayR * 0.4);
    ctx.stroke();
    // Hit count indicator
    if (b.hits === 1 && b.state === "alive") {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, displayR * 0.95, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (b.type === "splitter") {
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(b.x, b.y, displayR * 0.45, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, b.y, displayR * 0.25, 0, Math.PI * 2); ctx.stroke();
    // Double-ring pips showing "2 explosions"
    if (b.splitsRemaining === 2 && b.state === "alive") {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath(); ctx.arc(b.x, b.y, displayR * 0.65, 0, Math.PI * 2); ctx.stroke();
    }
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
    ctx.strokeStyle = "rgba(255,85,119,0.55)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const a1 = (frame * 0.04 + i * 2.1);
      ctx.beginPath();
      ctx.arc(b.x, b.y, displayR * (0.3 + i * 0.2), a1, a1 + 1.2);
      ctx.stroke();
    }
  } else if (b.type === "shield") {
    if (b.shieldUp && b.state === "alive") {
      ctx.strokeStyle = "rgba(68,221,255,0.85)";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, displayR * 1.15, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(68,221,255,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, displayR * 1.25, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (b.type === "teleporter") {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(frame * 0.08);
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = "rgba(255,68,255,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, displayR * 0.7, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  } else if (b.type === "bomb") {
    ctx.strokeStyle = "rgba(255,238,68,0.65)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i + frame * 0.02;
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(a) * displayR * 0.5, b.y + Math.sin(a) * displayR * 0.5);
      ctx.lineTo(b.x + Math.cos(a) * displayR * 0.85, b.y + Math.sin(a) * displayR * 0.85);
      ctx.stroke();
    }
  }

  // Specular
  ctx.beginPath();
  ctx.arc(b.x - displayR * 0.35, b.y - displayR * 0.35, displayR * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${0.45 * alphaMul})`;
  ctx.fill();
}

// ── UI primitives ───────────────────────────────────────
function Overlay({ children, realm }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: `rgba(${hexToRgb(realm.bg[2])}, 0.86)`,
      backdropFilter: "blur(6px)",
      color: realm.accent, textAlign: "center", padding: "20px", zIndex: 20,
    }}>
      {children}
    </div>
  );
}

function Btn({ onClick, children, ghost = false, realm }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: ghost ? "transparent" : (hover ? realm.accent : "transparent"),
        color: ghost ? (hover ? realm.accent : `rgba(${hexToRgb(realm.accent)}, 0.7)`) : (hover ? realm.bg[2] : realm.accent),
        border: ghost ? `1px solid rgba(${hexToRgb(realm.accent)}, 0.4)` : `1px solid ${realm.accent}`,
        padding: "11px 22px", fontSize: "12px", letterSpacing: "3px",
        fontFamily: realm.font, cursor: "pointer",
        textShadow: hover && !ghost ? "none" : `0 0 8px ${realm.accentGlow}`,
        boxShadow: hover && !ghost ? `0 0 30px ${realm.accentGlow}` : `0 0 10px rgba(${hexToRgb(realm.accent)}, 0.2)`,
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}

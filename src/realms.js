// ═══════════════════════════════════════════════════════════
//  REALMS — 10 themed worlds of 100 levels each
// ═══════════════════════════════════════════════════════════

// Each realm defines: background gradient, particle style, accent color,
// HUD font, and a boss layout generator for the 10 boss levels.

export const REALMS = [
  {
    id: "space",
    name: "DEEP SPACE",
    subtitle: "the journey begins",
    bg: ["#0a1a2e", "#050a18", "#000308"],
    particle: "rgba(125, 249, 255, ",
    accent: "#7df9ff",
    accentGlow: "#7df9ff",
    secondaryAccent: "#ff6ec7",
    font: "'Courier New', monospace",
    bossFlavor: "ASTEROID",
    lore: "The void stretches endless. Your ship drifts past sleeping stars.",
  },
  {
    id: "candy",
    name: "CANDY COSMOS",
    subtitle: "sugar-drunk galaxy",
    bg: ["#3d1a4a", "#2a0d38", "#1a0525"],
    particle: "rgba(255, 182, 235, ",
    accent: "#ff9ed8",
    accentGlow: "#ff6ec7",
    secondaryAccent: "#ffee55",
    font: "'Courier New', monospace",
    bossFlavor: "GUMBALL",
    lore: "Nebulae of spun sugar. Comet trails of syrup. Everything is sticky.",
  },
  {
    id: "themepark",
    name: "THEME PARK",
    subtitle: "neon carnival",
    bg: ["#1a0a2e", "#0d0518", "#08030a"],
    particle: "rgba(255, 220, 80, ",
    accent: "#ffdc50",
    accentGlow: "#ff8800",
    secondaryAccent: "#ff3366",
    font: "'Courier New', monospace",
    bossFlavor: "CAROUSEL",
    lore: "Carnival lights pulse. Laughter echoes — you can't tell from where.",
  },
  {
    id: "horror",
    name: "HORROR LAND",
    subtitle: "something is watching",
    bg: ["#1a0508", "#0d0304", "#050202"],
    particle: "rgba(180, 40, 40, ",
    accent: "#ff3838",
    accentGlow: "#aa0000",
    secondaryAccent: "#88ff44",
    font: "'Courier New', monospace",
    bossFlavor: "WRAITH",
    lore: "The ship's lights flicker. Something moves beyond the glass.",
  },
  {
    id: "ocean",
    name: "OCEAN DEEP",
    subtitle: "the abyssal trench",
    bg: ["#001a33", "#000f20", "#000510"],
    particle: "rgba(80, 220, 255, ",
    accent: "#5ef0c0",
    accentGlow: "#2ee6a8",
    secondaryAccent: "#ffbb44",
    font: "'Courier New', monospace",
    bossFlavor: "LEVIATHAN",
    lore: "Pressure mounts. Bioluminescence. Things with too many eyes.",
  },
  {
    id: "volcanic",
    name: "VOLCANIC CORE",
    subtitle: "heart of the furnace",
    bg: ["#2a0a05", "#180503", "#0a0201"],
    particle: "rgba(255, 120, 40, ",
    accent: "#ff8844",
    accentGlow: "#ff4400",
    secondaryAccent: "#ffee00",
    font: "'Courier New', monospace",
    bossFlavor: "MAGMA",
    lore: "Heat warps the air. The ship's hull groans. Keep moving.",
  },
  {
    id: "crystal",
    name: "CRYSTAL CAVERNS",
    subtitle: "refracted halls",
    bg: ["#1a0a2a", "#0d0518", "#050210"],
    particle: "rgba(200, 160, 255, ",
    accent: "#c8a0ff",
    accentGlow: "#9944ff",
    secondaryAccent: "#44eeff",
    font: "'Courier New', monospace",
    bossFlavor: "PRISM",
    lore: "Every surface is a mirror. Your reflection blinks out of sync.",
  },
  {
    id: "clockwork",
    name: "CLOCKWORK CITY",
    subtitle: "the machine thinks",
    bg: ["#1f1005", "#120803", "#080402"],
    particle: "rgba(220, 170, 80, ",
    accent: "#d4a55a",
    accentGlow: "#aa7722",
    secondaryAccent: "#44ccaa",
    font: "'Courier New', monospace",
    bossFlavor: "AUTOMATON",
    lore: "Brass gears the size of moons. Tick. Tick. Tick.",
  },
  {
    id: "dream",
    name: "DREAM REALM",
    subtitle: "almost home",
    bg: ["#2a1a3a", "#1a0d28", "#0a0518"],
    particle: "rgba(255, 200, 240, ",
    accent: "#ffb8e8",
    accentGlow: "#d888ff",
    secondaryAccent: "#88ffdd",
    font: "'Courier New', monospace",
    bossFlavor: "MIRAGE",
    lore: "Nothing here stays fixed. You are close now. You can feel it.",
  },
  {
    id: "final",
    name: "FINAL DESTINATION",
    subtitle: "the light at the end",
    bg: ["#3a2a10", "#1f1508", "#0a0802"],
    particle: "rgba(255, 240, 180, ",
    accent: "#ffe888",
    accentGlow: "#ffaa00",
    secondaryAccent: "#ffffff",
    font: "'Courier New', monospace",
    bossFlavor: "ASCENSION",
    lore: "You made it. Just one last chain between you and home.",
  },
];

// Get realm for a given level (1-indexed)
export function realmForLevel(levelNum) {
  const idx = Math.min(Math.floor((levelNum - 1) / 100), REALMS.length - 1);
  return { ...REALMS[idx], index: idx };
}

// Is this a boss level? (every 10th)
export function isBossLevel(levelNum) {
  return levelNum % 10 === 0;
}

// The 10 bosses within a realm get progressively harder names
export function bossName(levelNum, realm) {
  const bossNum = ((levelNum - 1) % 100) / 10 + 1; // 1-10 within realm
  const suffixes = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return `${realm.bossFlavor} ${suffixes[Math.floor(bossNum) - 1]}`;
}

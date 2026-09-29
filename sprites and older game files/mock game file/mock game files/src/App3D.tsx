import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Box,
  Sphere,
  Cone,
  Html,
} from "@react-three/drei";
import * as THREE from "three";

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

type Character = { name: string; emoji: string; moves: Move[] };
type Position = { x: number; y: number };
type Bullet = Position & {
  direction: "left" | "right";
  isRat?: boolean;
  chargePower?: number;
  isQuickdraw?: boolean;
  isRicochet?: boolean;
  hasBounced?: boolean;
  isThorn?: boolean;
  isVRat?: boolean;
  vDir?: number;
  isPixie?: boolean;
};
type Block = Position & { health: number };
type Beam = Position & { direction: "left" | "right"; ttl: number };
type TimedEffect = Position & {
  ttl: number;
  effectType?:
    | "leafstorm"
    | "flyingsword"
    | "explosion"
    | "clawingsword"
    | "ratpack"
    | "ratstorm"
    | "tonguewhip"
    | "teleport"
    | "chorus"
    | "lilypad"
    | "dustdevil"
    | "sporecloud"
    | "croakbeam"
    | "vinesnare"
    | "poisondot"
    | "healpuddle"
    | "poisontrap"
    | "frozentile"
    | "brokentile"
    | "brokenwall"
    | "tadpole"
    | "vampmist"
    | "topple"
    | "poisontile"
    | "poisononly"
    | "e_sweep"
    | "e_beam"
    | "e_zone"
    | "healfont"
    | "stungleam"
    | "hammerwarning"
    | "hammerhit"
    | "zonesteal"
    | "silencebomb"
    | "mushpoisontrail"
    | "mushpoison_p"
    | "mushpoison_e";
  direction?: "left" | "right";
  damagePerTick?: number;
  hasDamaged?: boolean;
  dmg?: number;
};
type Bomb = Position;
type DelayBomb = Position & { timer: number };
type Boomerang = Position & {
  phase: "forward" | "backward";
  distanceTraveled: number;
  ttl: number;
};
type Turret = Position & {
  hp: number;
  owner: "player" | "enemy";
  shootTimer: number;
  isMushroom?: boolean;
  moveTimer?: number;
};
type Move = {
  name: string;
  manaCost: number;
  cooldown: number;
  description: string;
};
type EnemyDef = {
  type: string;
  emoji: string;
  hp: number;
  shootChance: number;
  speed: number;
  deck?: string[];
};

// ════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════

const GRID_SIZE = 4;
const MAX_SHOTS = 2;
const GAME_TICK = 50;
const OPPONENT_MOVE_INTERVAL = 5;
const MAX_HAND_SIZE = 2;
const MAX_MANA = 10;
const DELAY_BOMB_TIMER = 30;
const MAX_DECK_SIZE = 6;

const OW_TILE = 40;
const OW_COLS = 24;
const OW_ROWS = 18;
const ENCOUNTER_RATE = 0.2;

type Upgrades = { bulletDmg: number; cardBonuses: Record<string, number> };
const NPC_POS = { x: 11, y: 6 };
const TRAINER_POS = { x: 14, y: 3 };

// All character types available as trainer monsters (starters + wild)
const ALL_TRAINER_TYPES: {
  type: string;
  emoji: string;
  hp: number;
  shootChance: number;
  speed: number;
  allMoves: string[];
}[] = [
  {
    type: "cowboy",
    emoji: "🤠",
    hp: 100,
    shootChance: 0.3,
    speed: 5,
    allMoves: [
      "slash",
      "beam",
      "punch",
      "bomb",
      "lasso",
      "quickdraw",
      "dust devil",
      "ricochet",
    ],
  },
  {
    type: "hogglin",
    emoji: "🦔",
    hp: 90,
    shootChance: 0.25,
    speed: 6,
    allMoves: [
      "leafstorm",
      "flying sword",
      "wall",
      "clawingsword",
      "thorn shield",
      "vine snare",
      "spore cloud",
      "topple",
    ],
  },
  {
    type: "rat king",
    emoji: "🐀",
    hp: 80,
    shootChance: 0.35,
    speed: 4,
    allMoves: [
      "rat pack",
      "trash toss",
      "street swarm",
      "plague bite",
      "tunnel",
      "scavenge",
    ],
  },
  {
    type: "malipole",
    emoji: "🐸",
    hp: 85,
    shootChance: 0.2,
    speed: 5,
    allMoves: [
      "tongue whip",
      "random hop",
      "frog chorus",
      "lily pad trap",
      "mud slap",
      "croak blast",
      "spawn tadpole",
      "absorb",
    ],
  },
  {
    type: "grunt",
    emoji: "👾",
    hp: 100,
    shootChance: 0.3,
    speed: 5,
    allMoves: [
      "plasma shot",
      "shield bash",
      "overcharge",
      "emp blast",
      "barrier",
      "gravity well",
      "power surge",
      "topple",
    ],
  },
  {
    type: "slime",
    emoji: "🟩",
    hp: 60,
    shootChance: 0.15,
    speed: 8,
    allMoves: [
      "slime ball",
      "slime trail",
      "dissolve",
      "bounce",
      "goo trap",
      "absorb",
      "toxic wave",
      "venom spit",
    ],
  },
  {
    type: "bat",
    emoji: "🦇",
    hp: 45,
    shootChance: 0.4,
    speed: 3,
    allMoves: [
      "sonic screech",
      "wing slash",
      "sonar jam",
      "swoop",
      "blood drain",
      "shadow dive",
      "vampiric mist",
    ],
  },
  {
    type: "pixie",
    emoji: "🧚",
    hp: 75,
    shootChance: 0.25,
    speed: 5,
    allMoves: ["absorb", "healing font", "stunning gleam", "call family"],
  },
  {
    type: "giant",
    emoji: "🗿",
    hp: 120,
    shootChance: 0.15,
    speed: 7,
    allMoves: ["hammer down", "topple", "wall", "brick break", "zone steal"],
  },
  {
    type: "mushroom",
    emoji: "🍄",
    hp: 70,
    shootChance: 0.2,
    speed: 6,
    allMoves: ["absorb poison", "bomb", "silence bomb", "fairy ring"],
  },
];

// AI card effect categories: how the enemy executes each card (mirrored from player)
// AI card system removed — enemyUseCard handles each card individually as exact mirror of player version

const DESERT_TYPES = ["giant", "mushroom"];
const GRASSLAND_TYPES = ALL_TRAINER_TYPES.filter(
  (t) => !DESERT_TYPES.includes(t.type)
);
const DESERT_ONLY_TYPES = ALL_TRAINER_TYPES.filter((t) =>
  DESERT_TYPES.includes(t.type)
);

const generateTrainer = (
  zone: "grassland" | "desert" = "grassland"
): { name: string; team: EnemyDef[] } => {
  const names = [
    "RIVAL",
    "ACE",
    "MARSHAL",
    "SCOUT",
    "ENFORCER",
    "WARDEN",
    "TACTICIAN",
  ];
  const name = names[Math.floor(Math.random() * names.length)];
  const pool = zone === "desert" ? DESERT_ONLY_TYPES : GRASSLAND_TYPES;
  const pick = () => {
    const t = pool[Math.floor(Math.random() * pool.length)];
    const shuffled = [...t.allMoves].sort(() => Math.random() - 0.5);
    const deck = shuffled.slice(0, Math.min(6, shuffled.length));
    return {
      type: t.type,
      emoji: t.emoji,
      hp: Math.floor(t.hp * 1.5),
      shootChance: Math.min(0.5, t.shootChance + 0.1),
      speed: Math.max(3, t.speed - 1),
      deck,
    };
  };
  return { name, team: [pick(), pick()] };
};

const TL = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  TREE: 3,
  TALL_GRASS: 4,
  HOUSE: 5,
  FLOWER: 6,
  ROCK: 7,
  BRIDGE: 8,
  SIGN: 9,
} as const;

const WORLD_MAP: number[][] = [
  [3, 3, 3, 3, 3, 0, 0, 4, 4, 4, 0, 0, 0, 3, 3, 3, 0, 0, 4, 4, 0, 0, 3, 3],
  [3, 0, 0, 0, 3, 0, 4, 4, 0, 4, 4, 0, 0, 0, 3, 0, 0, 4, 4, 4, 0, 0, 0, 3],
  [3, 0, 6, 0, 0, 0, 4, 4, 4, 0, 0, 0, 6, 0, 0, 0, 4, 4, 0, 0, 0, 6, 0, 3],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0],
  [0, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 0, 0, 4, 0],
  [0, 4, 4, 0, 0, 6, 0, 0, 6, 0, 0, 6, 0, 0, 0, 0, 4, 0, 0, 4, 0, 0, 4, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 0, 0, 0, 0, 7],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 4, 4, 0, 0, 0, 4, 4, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 0, 0, 4, 4, 4, 0, 0],
  [0, 4, 4, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 7],
  [0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 7, 7],
  [0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 4, 4, 4, 4, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 6, 0, 3],
  [3, 0, 4, 4, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 3],
  [3, 3, 4, 4, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 7, 7, 0, 3, 3],
  [3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3],
];

const DESERT_MAP: number[][] = [
  [7, 7, 0, 0, 0, 0, 4, 4, 0, 0, 7, 7, 0, 0, 4, 4, 0, 0, 0, 0, 7, 7, 0, 0],
  [7, 0, 0, 4, 4, 0, 4, 0, 0, 0, 0, 7, 0, 4, 4, 0, 0, 0, 4, 0, 0, 7, 0, 0],
  [0, 0, 0, 4, 0, 0, 0, 0, 7, 0, 0, 0, 0, 4, 0, 0, 7, 0, 0, 0, 0, 0, 0, 7],
  [0, 4, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 4, 0],
  [0, 4, 4, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 4, 4, 0],
  [0, 0, 0, 0, 7, 0, 0, 4, 4, 4, 0, 0, 7, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 0, 0],
  [7, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 7, 0, 0, 7],
  [0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0],
  [0, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 4, 4, 0, 0],
  [0, 4, 0, 0, 7, 0, 0, 0, 4, 4, 0, 0, 7, 0, 4, 4, 4, 0, 0, 4, 4, 4, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 7],
  [0, 0, 7, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 7, 0, 0, 0, 4, 4, 0, 0, 0, 7, 7],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 0, 0, 0, 0],
  [7, 0, 0, 4, 0, 7, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 7],
  [0, 0, 4, 4, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 7, 0, 0, 0],
  [7, 0, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 7, 0, 0, 7, 7, 0, 0, 7],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// ════════════════════════════════════════════════════════════
// CHARACTER DEFINITIONS — descriptions show DMG + effects
// ════════════════════════════════════════════════════════════

const CHARACTERS: Character[] = [
  {
    name: "Cowboy",
    emoji: "🤠",
    moves: [
      {
        name: "slash",
        manaCost: 1,
        cooldown: 1000,
        description: "30 DMG. Hits 3 tiles in front.",
      },
      {
        name: "beam",
        manaCost: 3,
        cooldown: 1000,
        description: "20 DMG. Laser across entire enemy row.",
      },
      {
        name: "punch",
        manaCost: 1,
        cooldown: 1000,
        description: "40 DMG. Melee strike one tile ahead.",
      },
      {
        name: "bomb",
        manaCost: 4,
        cooldown: 1000,
        description: "40 DMG. Thrown explosive, detonates on contact.",
      },
      {
        name: "tractor beam",
        manaCost: 3,
        cooldown: 1000,
        description: "10 DMG. Pulls enemy 2 tiles closer.",
      },
      {
        name: "delay bomb",
        manaCost: 5,
        cooldown: 1000,
        description: "40 DMG center + 10 DMG AOE. 3s fuse timer.",
      },
      {
        name: "boomerang",
        manaCost: 3,
        cooldown: 1000,
        description:
          "30 DMG. Flies 4 forward, shifts 1 lane, returns straight. Intercept to catch!",
      },
      {
        name: "lasso",
        manaCost: 2,
        cooldown: 1000,
        description: "15 DMG + Stun. Pull enemy to grid edge.",
      },
      {
        name: "quickdraw",
        manaCost: 2,
        cooldown: 1000,
        description: "25 DMG. 2× speed bullet, travels fast.",
      },
      {
        name: "dust devil",
        manaCost: 3,
        cooldown: 1000,
        description: "20 DMG. Whirlwind hits all 4 adjacent tiles.",
      },
      {
        name: "ricochet",
        manaCost: 2,
        cooldown: 1000,
        description: "15 DMG. Bullet bounces back if it misses.",
      },
    ],
  },
  {
    name: "Hogglin",
    emoji: "🦔",
    moves: [
      {
        name: "leafstorm",
        manaCost: 5,
        cooldown: 1000,
        description: "20 DMG + Stun. Storm across entire row.",
      },
      {
        name: "flying sword",
        manaCost: 3,
        cooldown: 1000,
        description: "15 DMG. Homing sword sweeps across field.",
      },
      {
        name: "wall",
        manaCost: 4,
        cooldown: 1000,
        description: "No DMG. Place 4-block defensive column.",
      },
      {
        name: "clawingsword",
        manaCost: 2,
        cooldown: 1000,
        description: "30 DMG. Advancing slash across field.",
      },
      {
        name: "thorn shield",
        manaCost: 2,
        cooldown: 1000,
        description: "30 DMG retaliation. Blocks next hit, fires thorn bullet.",
      },
      {
        name: "vine snare",
        manaCost: 3,
        cooldown: 1000,
        description: "10 DMG + Long Stun. Vine trap on random enemy tile.",
      },
      {
        name: "spore cloud",
        manaCost: 4,
        cooldown: 1000,
        description: "2 DMG/tick for 4s. Lingering poison cloud.",
      },
      {
        name: "topple",
        manaCost: 2,
        cooldown: 1000,
        description: "40 DMG. Knock the wall in front of you at enemies.",
      },
    ],
  },
  {
    name: "Rat King",
    emoji: "🐀",
    moves: [
      {
        name: "rat pack",
        manaCost: 1,
        cooldown: 1000,
        description: "10 DMG each. Summon 2 rat minions.",
      },
      {
        name: "trash toss",
        manaCost: 2,
        cooldown: 1000,
        description: "10 DMG. Homing debris projectile.",
      },
      {
        name: "street swarm",
        manaCost: 5,
        cooldown: 1000,
        description: "10 DMG each. 4 homing rat swarm.",
      },
      {
        name: "plague bite",
        manaCost: 2,
        cooldown: 1000,
        description: "20 DMG + 5 DMG/s Poison for 5s. Same-row melee.",
      },
      {
        name: "tunnel",
        manaCost: 1,
        cooldown: 1000,
        description: "No DMG. Burrow to random safe tile.",
      },
      {
        name: "scavenge",
        manaCost: 0,
        cooldown: 1000,
        description: "No DMG. Restore 3 mana instantly.",
      },
    ],
  },
  {
    name: "Malipole",
    emoji: "🐸",
    moves: [
      {
        name: "tongue whip",
        manaCost: 2,
        cooldown: 1000,
        description: "15 DMG + Stun. Long-range tongue strike.",
      },
      {
        name: "random hop",
        manaCost: 3,
        cooldown: 1000,
        description: "5 DMG. Teleport enemy to random tile.",
      },
      {
        name: "frog chorus",
        manaCost: 4,
        cooldown: 1000,
        description: "Buff: ALL attacks deal 1-5× random DMG. Stacks.",
      },
      {
        name: "lily pad trap",
        manaCost: 3,
        cooldown: 1000,
        description: "10 DMG + Stun. Place 2 hidden trap tiles.",
      },
      {
        name: "mud slap",
        manaCost: 1,
        cooldown: 1000,
        description: "35 DMG + Stun. Melee hit 1 tile ahead only.",
      },
      {
        name: "croak blast",
        manaCost: 3,
        cooldown: 1000,
        description: "20 DMG/tile. Delayed beam sweeps across row.",
      },
      {
        name: "spawn tadpole",
        manaCost: 2,
        cooldown: 1000,
        description: "10 DMG. Zigzag tadpole across field.",
      },
      {
        name: "absorb",
        manaCost: 3,
        cooldown: 1000,
        description: "Heal 20 HP if enemy is stunned or poisoned.",
      },
      {
        name: "novice casts",
        manaCost: 3,
        cooldown: 1000,
        description: "2 tiles ahead become frozen, poison, or broken.",
      },
    ],
  },
];

const MONSTER_CHARACTERS: Character[] = [
  {
    name: "Grunt",
    emoji: "👾",
    moves: [
      {
        name: "plasma shot",
        manaCost: 1,
        cooldown: 1000,
        description: "15 DMG. Fast energy projectile.",
      },
      {
        name: "shield bash",
        manaCost: 1,
        cooldown: 1000,
        description: "30 DMG + Stun. Melee hit 1 tile ahead.",
      },
      {
        name: "overcharge",
        manaCost: 3,
        cooldown: 1000,
        description: "Buff: Next 3 shots deal 2× DMG.",
      },
      {
        name: "emp blast",
        manaCost: 4,
        cooldown: 1000,
        description:
          "15 DMG + Stun. Hits adjacent tiles. Clears all traps & effects.",
      },
      {
        name: "barrier",
        manaCost: 4,
        cooldown: 1000,
        description: "No DMG. Place 4-block defensive column.",
      },
      {
        name: "gravity well",
        manaCost: 3,
        cooldown: 1000,
        description: "10 DMG. Pulls enemy 2 tiles toward center.",
      },
      {
        name: "power surge",
        manaCost: 3,
        cooldown: 1000,
        description: "20 DMG. Beam across entire enemy row.",
      },
      {
        name: "topple",
        manaCost: 2,
        cooldown: 1000,
        description: "40 DMG. Knock the wall in front of you at enemies.",
      },
    ],
  },
  {
    name: "Slime",
    emoji: "🟩",
    moves: [
      {
        name: "slime ball",
        manaCost: 1,
        cooldown: 1000,
        description: "10 DMG + Poison. Hit 2 tiles ahead, leave poison trap.",
      },
      {
        name: "slime trail",
        manaCost: 2,
        cooldown: 1000,
        description:
          "Place 2 healing puddles on your grid. Heal 10 HP on contact.",
      },
      {
        name: "dissolve",
        manaCost: 4,
        cooldown: 1000,
        description: "2 DMG/tick for 4s. Acid pool on enemy tile.",
      },
      {
        name: "bounce",
        manaCost: 1,
        cooldown: 1000,
        description: "No DMG. Teleport to random safe tile.",
      },
      {
        name: "goo trap",
        manaCost: 3,
        cooldown: 1000,
        description: "10 DMG + Long Stun + Poison. Sticky trap on random tile.",
      },
      {
        name: "absorb",
        manaCost: 3,
        cooldown: 1000,
        description: "Heal 20 HP if enemy is stunned or poisoned.",
      },
      {
        name: "toxic wave",
        manaCost: 5,
        cooldown: 1000,
        description: "20 DMG + Stun. Wave across entire row.",
      },
      {
        name: "venom spit",
        manaCost: 2,
        cooldown: 1000,
        description: "Poison trap 4 tiles ahead of you.",
      },
    ],
  },
  {
    name: "Bat",
    emoji: "🦇",
    moves: [
      {
        name: "sonic screech",
        manaCost: 2,
        cooldown: 1000,
        description: "20 DMG. Beam across entire enemy row.",
      },
      {
        name: "wing slash",
        manaCost: 1,
        cooldown: 1000,
        description: "25 DMG. Melee hit 1 tile ahead.",
      },
      {
        name: "sonar jam",
        manaCost: 3,
        cooldown: 1000,
        description: "Buff: 2× mana regen + silence enemy for 2s.",
      },
      {
        name: "swoop",
        manaCost: 2,
        cooldown: 1000,
        description: "15 DMG. Sweeps from you toward the enemy.",
      },
      {
        name: "blood drain",
        manaCost: 3,
        cooldown: 1000,
        description: "10 DMG + Heal 10 HP. Same-row attack.",
      },
      {
        name: "shadow dive",
        manaCost: 1,
        cooldown: 1000,
        description: "10 DMG. Both fighters dash to the front row.",
      },
      {
        name: "vampiric mist",
        manaCost: 5,
        cooldown: 1000,
        description: "3 DMG/tick + Heal 2/tick. Draining cloud for 3s.",
      },
    ],
  },
  {
    name: "Pixie",
    emoji: "🧚",
    moves: [
      {
        name: "absorb",
        manaCost: 3,
        cooldown: 1000,
        description: "Heal 20 HP if enemy is stunned or poisoned.",
      },
      {
        name: "healing font",
        manaCost: 2,
        cooldown: 1000,
        description: "No DMG. Create heal tile: 5 HP/s for 5s.",
      },
      {
        name: "stunning gleam",
        manaCost: 4,
        cooldown: 1000,
        description: "20 DMG + Stun. Cone: 1 tile + 3 behind it.",
      },
      {
        name: "call family",
        manaCost: 5,
        cooldown: 1000,
        description:
          "Summon 2 turrets at back corners. 5 DMG shots, 15 HP each.",
      },
    ],
  },
  {
    name: "Giant",
    emoji: "🗿",
    moves: [
      {
        name: "hammer down",
        manaCost: 4,
        cooldown: 1000,
        description: "50 DMG cone after 1.5s delay. Frozen during wind-up.",
      },
      {
        name: "topple",
        manaCost: 2,
        cooldown: 1000,
        description: "40 DMG. Knock the wall in front of you at enemies.",
      },
      {
        name: "wall",
        manaCost: 2,
        cooldown: 1000,
        description: "No DMG. Place 4-block defensive column.",
      },
      {
        name: "brick break",
        manaCost: 2,
        cooldown: 1000,
        description: "Destroy wall in front. Heal 15 HP.",
      },
      {
        name: "zone steal",
        manaCost: 5,
        cooldown: 1000,
        description:
          "Steal nearest enemy column for 3s. Stun + 20 DMG on return.",
      },
    ],
  },
  {
    name: "Mushroom",
    emoji: "🍄",
    moves: [
      {
        name: "absorb poison",
        manaCost: 3,
        cooldown: 1000,
        description: "For 3s, stepping on poison heals 10 HP instead.",
      },
      {
        name: "bomb",
        manaCost: 1,
        cooldown: 1000,
        description: "20 DMG. Explodes when enemy steps on it.",
      },
      {
        name: "silence bomb",
        manaCost: 3,
        cooldown: 1000,
        description: "20 DMG + Silence 3s. Trap 2 tiles ahead.",
      },
      {
        name: "fairy ring",
        manaCost: 6,
        cooldown: 1000,
        description: "Place 2 mushroom turrets in center of enemy field.",
      },
    ],
  },
];

const CATCH_MOVE: Move = {
  name: "catch",
  manaCost: 3,
  cooldown: 1000,
  description: "Catch enemy below 20 HP. Chance scales with low HP.",
};

const ENEMY_TYPES: EnemyDef[] = [
  { type: "grunt", emoji: "👾", hp: 100, shootChance: 0.3, speed: 5 },
  { type: "slime", emoji: "🟩", hp: 60, shootChance: 0.15, speed: 8 },
  { type: "bat", emoji: "🦇", hp: 45, shootChance: 0.4, speed: 3 },
  { type: "pixie", emoji: "🧚", hp: 75, shootChance: 0.25, speed: 5 },
  { type: "giant", emoji: "🗿", hp: 120, shootChance: 0.15, speed: 7 },
  { type: "mushroom", emoji: "🍄", hp: 70, shootChance: 0.2, speed: 6 },
];

const generateEnemyWave = (): EnemyDef[] => {
  const count = Math.random() < 0.4 ? 1 : 2;
  return Array.from(
    { length: count },
    () => ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]
  );
};

// ════════════════════════════════════════════════════════════
// MONSTER SPRITE DATA
// ════════════════════════════════════════════════════════════

const SPRITE_BAT_IDLE =
  "data:image/gif;base64,R0lGODlh6ADWAKIEAFBmp////1DFvwAMAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpCMzNDODE2QTU3MjdFNjExQTFFMEZENjE1RjNDQTU2QiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFREQ0ODJEQzI3NTkxMUU2OUQzNUQ5OUM1MDUwRTNBMCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFREQ0ODJEQjI3NTkxMUU2OUQzNUQ5OUM1MDUwRTNBMCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkI3M0M4MTZBNTcyN0U2MTFBMUUwRkQ2MTVGM0NBNTZCIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkIzM0M4MTZBNTcyN0U2MTFBMUUwRkQ2MTVGM0NBNTZCIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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AWWtklWZtq46sJyMiqwa92dWu4Dvsu3UU+lOvn19FtW2cJvTnQTEViosF15ipYsZRxX6LYDbyYgrh75MV7Djrl4568X7iGDcuaThNg2JWuq8teCmYhtN+qrlq401mw4YXHhIS5R7+/4NwDbunAcD5xS5m/droGadS0+t1u7g6rD7YjesHbBw44+/g5ddtl34peWLZl53uibMRpIXWL//fjn36f/fmKZZbsWxdshnI7GXHVu8EbjPas41V59ujkBozmj3RdafhBamsw6H6AkYiWv+MVciOgou2OGEIP4n4lsGApJceyT6h+KGJQZIn4MC5HgcgoPMSCOOYNUIn44Y5RMUkgKuRoh1yh2ZYIpDukickn89WF45tWUkCJRRtghjUJfZpdh0m+HmpYxgKgcZX/KUiRZmaAYWYx5ChiklZR9SaVVN7aG2nXp85KknhxrC1uehl8lWp3mEFqpTmAhhSJafUZI4YV13SjppbF4mN16mv22aVqd/rCbemitiqqJRdkJWoUlDTklSq6vZB+Eko4J445q2OglBiE3qdYmxHCA7TohtHW4C5AwWnmISDsqmkl8N07qzLKraduvtt+CGK+645JZr7rnopqvuuuy26+678MYr77z01mvvvfjmq+++/Pbr778AByzwwAQXbPDBCCes8MIMN+zwwxBHLPHEFFds8cUYZ6zxxhx37PHHIKuQAAA7";
const SPRITE_BAT_ATTACK =
  "data:image/gif;base64,R0lGODlh6ADWAKIEAFDFv1Bmp////wAMAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpCMzNDODE2QTU3MjdFNjExQTFFMEZENjE1RjNDQTU2QiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDowOUE3REQxNTJCNzMxMUU2QTRDN0ZFMDg2Q0RGMkI5MiIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowOUE3REQxNDJCNzMxMUU2QTRDN0ZFMDg2Q0RGMkI5MiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkM1NEE0MjdDNzEyQkU2MTE5MjQ0RTI1RDE2ODkxM0M3IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkIzM0M4MTZBNTcyN0U2MTFBMUUwRkQ2MTVGM0NBNTZCIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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";
const SPRITE_BAT_ATTACK_2 =
  "data:image/gif;base64,R0lGODlh6ADWAKIEAFBmp1DFvwAMAP///////wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpCMzNDODE2QTU3MjdFNjExQTFFMEZENjE1RjNDQTU2QiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpEOTAyNTQxRTJCNzcxMUU2Qjc5M0RBMzMwNEM2Q0Q5NSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpEOTAyNTQxRDJCNzcxMUU2Qjc5M0RBMzMwNEM2Q0Q5NSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkQ3QUEyQkFFNzcyQkU2MTE5MjQ0RTI1RDE2ODkxM0M3IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkIzM0M4MTZBNTcyN0U2MTFBMUUwRkQ2MTVGM0NBNTZCIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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";
const SPRITE_BAT_HIT =
  "data:image/gif;base64,R0lGODlh6ADWAKIEAFBmp////1DFvwAMAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpCMzNDODE2QTU3MjdFNjExQTFFMEZENjE1RjNDQTU2QiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpEODlDMzc2OTJCNzgxMUU2OTA5QzlGRTM0QTFEQTExNyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpEODlDMzc2ODJCNzgxMUU2OTA5QzlGRTM0QTFEQTExNyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkRCQUEyQkFFNzcyQkU2MTE5MjQ0RTI1RDE2ODkxM0M3IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkIzM0M4MTZBNTcyN0U2MTFBMUUwRkQ2MTVGM0NBNTZCIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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";
const SPRITE_GRUNT_IDLE =
  "data:image/gif;base64,R0lGODlhOAEZAbMMADFhbKurog+nRaXvPERERPjo3HlARKZqQVWcovv//////wAMAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpGNDFFMzQ2NDc1MzBFNjExOTc4Qzg0RERERUZENjRCRSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo4NEVGN0I0MjMwNzYxMUU2ODI3QUE2NTlBRDg2OEIwNyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo4NEVGN0I0MTMwNzYxMUU2ODI3QUE2NTlBRDg2OEIwNyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkY0MUUzNDY0NzUzMEU2MTE5NzhDODRERERFRkQ2NEJFIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkY0MUUzNDY0NzUzMEU2MTE5NzhDODRERERFRkQ2NEJFIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8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";
const SPRITE_GRUNT_ATTACK =
  "data:image/gif;base64,R0lGODlhOAEZAbMMADFhbA+nRauroqXvPFWcovjo3ERERHlARKZqQfv//wAMAP///////wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpGNDFFMzQ2NDc1MzBFNjExOTc4Qzg0RERERUZENjRCRSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo3MUVGM0Q0MzMwN0YxMUU2QTVGMUM4NjMzRDI0MkIyNCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo3MUVGM0Q0MjMwN0YxMUU2QTVGMUM4NjMzRDI0MkIyNCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjcyNTVFNUEwN0MzMEU2MTE5NzhDODRERERFRkQ2NEJFIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkY0MUUzNDY0NzUzMEU2MTE5NzhDODRERERFRkQ2NEJFIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8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";
const SPRITE_GRUNT_GUARD =
  "data:image/gif;base64,R0lGODlhOAEZAbMMAKurojFhbA+nRaXvPPjo3HlARERERKZqQVWcovv//////wAMAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpGNDFFMzQ2NDc1MzBFNjExOTc4Qzg0RERERUZENjRCRSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFQjM1NDA2ODMwODIxMUU2QjQ5OENFNzg2NEE0OTcwQyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFQjM1NDA2NzMwODIxMUU2QjQ5OENFNzg2NEE0OTcwQyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjdBMTM2NjFGODAzMEU2MTE5NzhDODRERERFRkQ2NEJFIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkY0MUUzNDY0NzUzMEU2MTE5NzhDODRERERFRkQ2NEJFIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8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";
const SPRITE_GRUNT_HIT =
  "data:image/gif;base64,R0lGODlhOAEZAbMMADFhbA+nRauroqXvPPv//3lARFWcoqZqQURERPjo3P///wAMAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpGNDFFMzQ2NDc1MzBFNjExOTc4Qzg0RERERUZENjRCRSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFQ0E1MUNBRjMwODQxMUU2QkJBREJFMEU0RDMzMTlGMiIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFQ0E1MUNBRTMwODQxMUU2QkJBREJFMEU0RDMzMTlGMiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjdFMTM2NjFGODAzMEU2MTE5NzhDODRERERFRkQ2NEJFIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkY0MUUzNDY0NzUzMEU2MTE5NzhDODRERERFRkQ2NEJFIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8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";
const SPRITE_SLIME_IDLE =
  "data:image/gif;base64,R0lGODlh7wDVAKIEAAAMAFBmp////1DFv////wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpGNTZGRjc3MjA5MkNFNjExQjc5RThGRUFFOURCRDkwMCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo4QkIxQzIwRjJDMEYxMUU2QkY1OEUzNDcyQTFFMTFDQyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo4QkIxQzIwRTJDMEYxMUU2QkY1OEUzNDcyQTFFMTFDQyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkEyNjI3NUQ5MEUyQ0U2MTFCNzlFOEZFQUU5REJEOTAwIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkY1NkZGNzcyMDkyQ0U2MTFCNzlFOEZFQUU5REJEOTAwIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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";
const SPRITE_SLIME_ATTACK =
  "data:image/gif;base64,R0lGODlh7wDVAKIEAFBmpwAMAP///1DFv////wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpGNTZGRjc3MjA5MkNFNjExQjc5RThGRUFFOURCRDkwMCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoxNzhDNjhENTJDMTExMUU2QkJDOUJEMzgxQUZDNEEwMiIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxNzhDNjhENDJDMTExMUU2QkJDOUJEMzgxQUZDNEEwMiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkE1NjI3NUQ5MEUyQ0U2MTFCNzlFOEZFQUU5REJEOTAwIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkY1NkZGNzcyMDkyQ0U2MTFCNzlFOEZFQUU5REJEOTAwIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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";
const SPRITE_SLIME_ATTACK2 =
  "data:image/gif;base64,R0lGODlh7wDVAKIFAP///wAMAFDFv1BmpwAAAP///wAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpGNTZGRjc3MjA5MkNFNjExQjc5RThGRUFFOURCRDkwMCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDowNkQ1OEE4NzJDMzgxMUU2OTE5OEM1QTE0MDcyNkM2MyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowNkQ1OEE4NjJDMzgxMUU2OTE5OEM1QTE0MDcyNkM2MyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjEwQjk0M0ZDMzYyQ0U2MTFCOEEzRDBGOEYzREQxNkRBIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkY1NkZGNzcyMDkyQ0U2MTFCNzlFOEZFQUU5REJEOTAwIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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";
const SPRITE_SLIME_HIT =
  "data:image/gif;base64,R0lGODlh7wDVAKIEAFBmp////1DFvwAAAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpGNTZGRjc3MjA5MkNFNjExQjc5RThGRUFFOURCRDkwMCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoyMDY0M0ZBRTJDMzkxMUU2QjYyMjk1RTkyREYyRUFBOCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyMDY0M0ZBRDJDMzkxMUU2QjYyMjk1RTkyREYyRUFBOCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkM4QTI3MkVFMzgyQ0U2MTFCOEEzRDBGOEYzREQxNkRBIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkY1NkZGNzcyMDkyQ0U2MTFCNzlFOEZFQUU5REJEOTAwIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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";

const SPRITE_COWB_IDLE =
  "data:image/gif;base64,R0lGODlhFQHtAJEDANk4PAAMAPqFQ////yH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2RERCMDZDMEUzMkJFNjExQjc5RThGRUFFOURCRDkwMCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo5NjMzNjFGMzJCRTYxMUU2OEUxNUQzM0Y3QUQ4OEY2RSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo5NjMzNjFGMjJCRTYxMUU2OEUxNUQzM0Y3QUQ4OEY2RSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjcwREIwNkMwRTMyQkU2MTFCNzlFOEZFQUU5REJEOTAwIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjZEREIwNkMwRTMyQkU2MTFCNzlFOEZFQUU5REJEOTAwIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5k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";
const SPRITE_COWB_ATTACK =
  "data:image/gif;base64,R0lGODlhFQHtAKIGAPqFQwAMANk4PP/hzf94Cf+5yP///wAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2RERCMDZDMEUzMkJFNjExQjc5RThGRUFFOURCRDkwMCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo0NzY5MThEQzJDMDExMUU2QTEyNkVCRTE2QkE3MzQ3QyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo0NzY5MThEQjJDMDExMUU2QTEyNkVCRTE2QkE3MzQ3QyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjk1QjY2NUM1RkQyQkU2MTFCNzlFOEZFQUU5REJEOTAwIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjZEREIwNkMwRTMyQkU2MTFCNzlFOEZFQUU5REJEOTAwIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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5qnnnnz26eefgAYq6KCEFmrooYgmquiijDbq6KOQRirppJRWaumlmGaq6aacdurpp6CGKuqopJZq6qmopqrqqqy26uqrsMYq66y01mrrrbjmquuuvPbq66/ABivssMQWa+yxyCar7LIdzDbr7LPQRivttNRWa+212Gar7bbcduvtt+BKkQAAIfkECQoABgAsAAAAABUB7QAAA/9outz+MMpJq7046827/2AojmRpnmiqrmzrvnAsz3Rt33iu73zv/8CgcEgsGo/IpHLJbDqf0Kh0Sq1ar9isdsvter/gsHhMLpvP6LR6zW673/C4fE6v2+/4vH7P7/v/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXawGam5ydm5h5nqKjmqBypKikpmypogAArQGrZ6Svtre4sKmzZK65v7+ovGC+wMa4nAKdw13Fx8+6mgLKnMxantDZr5wA1NXWV53a45uv08vgVOLj2uXm3qXpUevs2e7v6PJO3PXtmrfT4Onbx6/fs4Ldzn0bmISewWP33imMx/BIJwEPD0ZMGHD/YUUiFzMac8hxoqyPIJNhFBlsY8mJKFNKm8YSGUKAAb3FHKJyZc1o/37l7HhyJ5BNOX9iAzYUptEfSAOydJarqc6nPXr67EdVaNNPWHlElWqwq9ecHsPiGEuW3NJsX8GqzcGWptug7KymnVujrl17ePPGpcjXht+/I13C1Su3cN+ZVjUGHmf1qmPDkJtKNljZ8mUah9vmUgyt897PMLRGHj15ceXGqGWoXn2LNNPOAmM/DoBbNFBtvT3rlh1a8zbbtoLnHj5jdufjrXEpz8c8hnPc15WbLFrdenbGxYN76g76++DM2uERJu89/Hn0vcez3w0f+0Xx8ueXd//e+Sj9/jd4kp56sZwGYHv8oVUgdQfSVx9+sTSogygDvpafhGtRWCFRBmKImYADiuJhEK2Ax+CIPiyoCopGqAgbi0UUCOOMNNZo44045qjjjjz26OOPQAYp5JBEFmnkkUgmqeSSTDbp5JNQRinllFRWaeWVWGap5ZZcdunll2CGKeaYZJZp5plopqnmmmy26eabcMYp55x01mnnnXjmqeeefPbp55+ABirooIQWauihiCaq6KKMNuroo5BGKumklFZq6aWYZqrpppx26umnoIYq6qiklmrqqaimquqqrLbq6quwxirrrLTWauutuOaq66689urrr8AGK+ywxBZr7LHIIpsAACH5BAkKAAYALAAAAAAVAe0AAAP/aLrc/jDKSau9OOvNu/9gKI5kaZ5oqq5s675wLM90bd94ru987//AoHBILBqPyKRyyWw6n9CodEqtWq/YrHbL7Xq/4LB4TC6bz+i0es1uu9/wuHxOr9vv+Lx+z+/7/4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8iwBMvMzc3JTc7S09BJ09fU1UPNA93eA9jP2kDc3+bd4QTjPuXn5+nrO8zu9N7h8Tjt9e7Y+Db6+/hJ81cDYMB3AwnKMHjQXDaFLxg2tPcQIguJE9FVtJgC/2NGcBs5mvD48ZpIFCQ/gnR28oQzlftCtgTRrADMmAlnikgJM6dOmsxs3qzn82eHmkMDFjWqgefNpUwvIE2KU1zUpkGpKmV5FUNNoVrpQe0aIWgBsGEFMiNr4WvaqsvYUvh69i3RtXIl0EVr95vVvAquna3bFyHevOEGEy7s92/XxIoXM6YYlyzkyJInr1T32OzZZZgVa25cOarn0KhHU+Zs9DTq0KpXM3X9GnNsjax10q4d+bbjk7t5i479m2NwzHv5Ti4O8TSB18mVM2ZO0PnzwYJtEy8t8uvlAtcH36Y8syY27eMNl0+HPr3Dw93P93YvFr7xabDp1+e+Pvxw/f9qzQbaZ9fBlFla1DU3IHjhqfQfgvYBt6BnHym2jF0JVjfhghVidyGE/MU34F4ThefUQRniw96DAnn4YVgpqviddLhZ+KJWMcooX2j4ufhWjjrG5Qxy2Xn4Y4RXpdOjkRolBaSESlpHAEVOImkZNdLYOGWTQz3J1pA+cvmUlYA1ACaBW4JUZYhlPrDXPGL2xGabDpxZzo0lkUnnAmcyiKecc+7JQJ9wjuklYskVmuehgEWnaEMyCVrnbi9tFamkZlIa5T2YVnDcpiZ1Old0Qm26mahtRbdobqhO0CeNarHa6qi0wSXrrLR+GiquGYA6Fq+e+norsFjBQ+yxyCar7LJrzDbr7LPQRivttNRWa+212Gar7bbcduvtt+CGK+645JZr7rnopqvuuuy26+678MYr77z01mvvvfjmq+++/Pbr778AByzwwAQXbPDBCCes8MIMN+zwwxBHLPHEFFds8cUYZ6zxxhx37PEuCQAAIfkECQoABgAsAAAAABUB7QAAA/9outz+MMpJq7046827/2AojmRpnmiqrmzrvnAsz3Rt33iu73zv/8CgcEgsGo/IpHLJbDqf0Kh0Sq1ar9isdsvter/gsHhMLpvP6LR6zW673/C4fE6v2+/4vH7P7/v/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6eogBO3u7+7rK/D09fIj9fn68fcb+//6+mGoN6CgwYMFAbYTSIEgwocJ4Q2wxxCCQ4gYJU6EV9H/AT2MICO6O8ixo4KPIUO+Q1iyIsqUIFeSbNnvJcyMI1nSXKfxpsqcOt/VBOozJtGZQnkeLQpRZtOd5pwyxdkOZAF66XpOfbj04dWk56RuRUoA5ld+Ybtu1YqxgFuw5dROZdv2LVpyYsfatOr2bNqqYw3u5WuXwN+yMBUCvtnXb9R2BX4q3Nr47jh3kanuCzyg8sLHBDJzHcy5seO4kEULzsvZoGnL4jC7JYu4tdfXn1GHni1yse2Dpgv/bdz79+3gsMPJ7svadnDmufGmhh7aOPDnZw2Dxl3demfs2Q9T520cfGHtundnJ9/a/Hl0y98RL+3+NOjd8t0Trv8evuz80vwFCB5c960n4IHcoedfPQg2GJ48+TiIIIELwiOhgBRmxeCF7kGlzoYcYuehUhaGmGB0DIFoIlYmnUSPidmhaFKEDubTokc0BhjQjQ8ohtw+PEqgGEBBWjCkjUVecKSMSTbp5JNQRinllFRWaeWVWGap5ZZcdunll2CGKeaYZJZp5plopqnmmmy26eabcMYp55x01mnnnXjmqeeefPbp55+ABirooIQWauihiCaq6KKMNuroo5BGKumklFZq6aWYZqrpppx26umnoIYq6qiklopIAgAh+QQJCgAGACwAAAAAFQHtAAAD/2i63P4wykmrvTjrzbv/YCiOZGmeaKqubOu+cCzPdG3feK7vfO//wKBwSCwaj8ikcslsOp/QqHRKrVqv2Kx2y+16v+CweEwum8/otHrNbrvf8Lh8Tq/b7/i8fs/v+/+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2C4B29zd3Nk93uLj4DXj5+jf5S3p7ejrKuMA8/T18+7b8Cby9v333gDI6RPBz59BgAG9DQQhzqDDf9zqKVzIoeHDh93sTaSIwf/iRYcZJW7kSMHjx4MRNY4kCQHhSYwpVXZjKSHkS5jbUM6k6cDmTZAx+4nj2cDnT39G6wkYStSAy6NCc15cupNoUqgQA3ykqs5qUKxZtU4VwDVA069gnzokW9arVLBhxY4l25Xl1Z8mH7Ll6lYuTnc399YlyU3A33ZQBefjWRgoYrCKzTLeZhhpXrgA9vKdHIBsVLSY52kezLGwZ3pqQ4sevZim6coJQYfWTLe1Xcpss6ruR7u2ZNe42d7F3Nu3W9addystXvV258iwdxf3/dv5c66npU9vy/l6t+zEt3PnLPx19MTiN/elnn5t+sjVgeP+/r7+9ubdy9rfTxt/d2/b/AU4XlMKnCMgf/71Rd+B7yV41jgMprcSgQWKE+F9DlII4YXIkUYhAxtyWJZtHz4QYoRMlVjTifudo2IF6LTo4osW4HNdee/Q2JGN7ejYAY8z+vgjkPEJaeSRSCap5JJMNunkk1BGKeWUVFZp5ZVYZqnlllx26eWXYIYp5phklmnmmWimqeaabLbp5ptwxinnnHTWaeedeOap55589unnn4AGKuighBZq6KGIJqrooow26uijkEYq6aSUVmrppZhmqummnHbq6aeghirqqKSWauqpqKaq6qqsppAAACH5BAUKAAYALAAAAAAVAe0AAAP/aLrc/jDKSau9OOvNu/9gKI5kaZ5oqq5s675wLM90bd94ru987//AoHBILBqPyKRyyWw6n9CodEqtWq/YrHbL7Xq/4LB4TC6bz+i0es1uu9/wuHxOr9vv+Lx+z+/7/4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TVZQHY2drZ1kDb3+DdOODk5dziMObq5egt4ADw8fLw69jtKe/z+vTbAOH3JfLtG9jP3zaAI74NXMgvm7yDCD8oZMhQ2zyIETdMpLjQ/+JDjBkvbORI0OFFkCEnFCRZ0eRJbSkreGTZEltJmDEjzKTZ0aW+bzkh7OS5b6g8AUCDMlhJ9KdNikhxKlVgtGnDAByjnptqoGpTpgMFiJWq1KfVq1izjt0a1CvPkQvFrg3A1S1LuHHlss1pN169pyTlaq2LTUDNdU0F742ZzfBNc2cBKLY3tfFjs5ElT6ZbubDjj5gzwxM8uHMAuaABiz5KenHKxmL99rVKei7h06gNql49unbpsp71hhbt27bp1oV5s/ZNlm/wuZ95F5/LGXhw2Mo1T2/OGLZW3NKnU+fa9br36InFG7+NW5t69Mvfjyfv/rv8++q5t21cH7//zd/V0UfOfwR+R14DAxbon36mbaMgfgyy19+D20Uo4XMU1obSgUt9k6GGG3LYoYMfUkeZiDp5+GFSKEqQIIHktCjTi/KxI6MFf4Fo440i/aUOjx34GCOQHgh5IpFIJqnkkkw26eSTUEYp5ZRUVmnllVhmqeWWXHbp5ZdghinmmGSWaeaZaKap5ppstunmm3DGKeecdNZp55145qnnnnz26eefgAYq6KCEFmrooYgmquiijDbq6KOQRirppJRWaumlmGaq6aacdurpp6CGKuqopJZq6qmopqrqqqy26uqrZCYAADs=";
const SPRITE_COWB_ATTACK2 =
  "data:image/gif;base64,R0lGODlhFQHtAKIEAPqFQ7AtQgAMANk4PP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2RERCMDZDMEUzMkJFNjExQjc5RThGRUFFOURCRDkwMCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpBRDgxMjM2MzJDMEIxMUU2QURBRkZCQjRCMUREMjc5NiIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpBRDgxMjM2MjJDMEIxMUU2QURBRkZCQjRCMUREMjc5NiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkYxNkZGNzcyMDkyQ0U2MTFCNzlFOEZFQUU5REJEOTAwIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjZEREIwNkMwRTMyQkU2MTFCNzlFOEZFQUU5REJEOTAwIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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vozh6sHzeG9kQJDaRKokua8exnHZVMoUwFLmR5jXZtoUSO7lyoE4qemkGZGoT3tAd7YMCq3egKcDkEKUetTo0p9LozmFyrUjVX0Vr8p8ilLVwhBbuaq9+NXnzZlQmaLSSVGl2rtdH1plqzOu3FNDyxKwi7dwXpZF4ZL9a6rc4sDwDEu+63HA1KF+BbAiJxky58mgn3a0nFhxVM2bx4U2Hbq1aIiveWL22+qz69u4c5MGcDjfY9OCAdvWTbx463tcIf92Ndy48+d5k89ux1w19OvYpfc9zXhu8+zgiZMLQD7AVurVBYQH7zv3uPLwI3NHnV79euMPb7+HH1/dclj/jt2X20Wu7ccfeev894o5At5G0moGHsigggsG2OBkiEF4YHn+PTbLhBcWhhhvoEUooYXoxQLiYiGOSGJnJvY3XHC1oWidiPoU5+KLhsXIIYgpAsiOZALptiOPhY23oXkWcmdLgoYhZKSLEAqwZIdOPtkkXlLGdRyVJSrJH5ZZamlflEV6GdqOVVp5IpDdVXgjjgFJlyRUYLZWzps2xlnjnHS25xdec46I254/kkljfc8ByiKeLKnlKKGEeVjLd+5NWuiD2rWZ1qJ/NqrpmbFZdBemSYqUGX2yoFrglqdxCZuksPYYj3asqjipfqOSuhZAqZI5mXyr0lKrnrW6iiyU/9iBataxwxILbZhpiZqrnL6+yhqvlRrnrHDT2orerYfOJt634Co7Hz8LEKutueX66V24v63jgLueBhbvtX9mCyNBEQibI60oeeZvvfymtqu4QTawYqn4IPyXwSIZu/C/CTPw8G45AtzBUJdeHGzG7V5c51keyHSLurh+y/KpDWNDMckav1wsOAZfsDHBKH8DckMUa2RC0EIPrXLRSCet9NJMN+3001BHLfXUVFdt9dVYZ6311lx37fXXYIct9thkl2322WinrfbabLft9ttwxy333HTXbffdeOet99589+3334AHLvjghBdu+OGIJ6744ow37vjjkEcu+eSUV2755RGYZ6755px37vnnoIcuetoJAAA7";
const SPRITE_COWB_HIT =
  "data:image/gif;base64,R0lGODlhFQHtAKIEAPqFQwAMAAAAANk4PP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2RERCMDZDMEUzMkJFNjExQjc5RThGRUFFOURCRDkwMCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo3QzY4NTBBRDJDMEQxMUU2QjhFOUFDMzVBMjdDMTNFQSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo3QzY4NTBBQzJDMEQxMUU2QjhFOUFDMzVBMjdDMTNFQSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkYxNkZGNzcyMDkyQ0U2MTFCNzlFOEZFQUU5REJEOTAwIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjZEREIwNkMwRTMyQkU2MTFCNzlFOEZFQUU5REJEOTAwIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8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tl/HrK+t8mN9kbfxkx7J4V4Hd3nx46gnthMurznx2LL9vZtOz3pz7MO1f1PO3Lt55+B9I29GHsD59/Abw8Q2O779+2jTsieNvz9+df8D/JZMff/l5h98AAp4DIH2DXTgexIhw2CDDj7onYLFTBjfRRbCFaExGiLIYYdCfQgif++tRGKJGA4TYooqrpgRNeudSBiFMXbITV823rhhTTpuw8yLMOZ4Hzo7DYliTtXpBmRVSEaZpJKU5aePk0YKJaWQ9FVpZXe0ZQmllNt5+aWB6FV4HpJl+igfgExC5N809yzZmXthJvSgNHWa6R2cWKo555Tj+emfmtEMSugzdt4n0IzSwBXpmIvu52YAayaKHknaUIoppebwp6l3k8aF5jZKdQpqoT6Oal2p1DU5wDQ4hfNqNKH66aqksF4565a7psonqy7BqqWqm/4KLKn/w3Z5o7HF2mrqPMDS2pw2uT4bLKfS8sMlZNtq9K2z0V7b7T50SmCtsOmSy625SU7qbbMRQBstvc4wGC6kuBIgrz7YTrDusfhaSti+yk75rzzj1jvwvZVayu2nBDNAKz0NO/ywuP0Sy/G27frb6ToZqyvtx20GVdHAIYtM5gbA9tnSymyCiw4INf/TTs42BxyCOMkhF85nRBdt9NFIJ6300kw37fTTUEct9dRUV2311VhnrfXWXHft9ddghy322GSXbfbZaKet9tpst+3223DHLffcdNdt991456333nz37fffgAcu+OCEF2744YgnrvjijDfu+OOQRy755JRXbvnlEZhnrvnmnHfu+eeghy660gkAADs=";
const SPRITE_RAT_IDLE =
  "data:image/gif;base64,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";
const SPRITE_RAT_ATTACK =
  "data:image/gif;base64,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";
const SPRITE_RAT_HIT =
  "data:image/gif;base64,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";
const SPRITE_BULLET =
  "data:image/gif;base64,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";

const SPRITE_RAT_ATTACK2 =
  "data:image/gif;base64,R0lGODdh1QCsAHcAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJFAAAACwAAAAA1QCsAIIAAAAADAD/6EjghEH/REYyJS3///+GJicD/wi63P4wykmrvTjrzbv/YCiOZGmeaKqubOu+cCzPdG3feK7vfO//wKBwSCwaj8ikcslsOp/QqHRKrVqv2Kx2y+16v+CweEwum8/otHrNbrvf8Lh8Tq/b7/i8fs/v+/+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbI5AbW2t7azI7i8vKK9ASjAw7ecxL4iwwLLzALAmMfDILzN1c29lcrV0dzd1Na4lNrWzN7m3NvFkb0D7e7t5M7n3gT1vem5j+zv/PD4AfUCBsQlsCABXgLvlVPHiFe/h/6u2TI4cCLFihYx2pJYq/+RQ4gg/108mHHkrYLfljFEhAuky4gqSxqUSfFkQlwcF92COKyfyIs0a9YSWotjMJa2eB57By6ovaEjn0JFuXHh0UM7+XljatTk1Kg2bxaViLRWv14F0hb4CFPeV6oAo5J8KzUAWaxJ3/FSyzdt1rZh4cqdS/dWzkJ/293qy9hv3gE/Z9KtS1CyXauGHiu21bjz2gBcrcaFO5rwMKKiCSVe7Lnx48ikKROzfNmtarN6a7X2jBuy0dIacZKrTDl1oNW6d3d+LRq46arxmqdE5gd5AOW8QQP2Fn34OLf5+mgewBm7697/vndPD93on/HJzTNmzr79+vvdw/PRXF5+X83/+K2nXoD67cFffP451ptvATZFTIOYVbdgfwm25A6E/1wY01gNFqjHgddVaKGGGI7IIHjdgPfehAhix5Y784xo2IbzAAKifyZuFmNW39xiwI8G+PhjODayGKKLieloC5BBCgmkhUs2eVktTA4ZQJUe7mfkkdklSR4uVUoZppTaUfnklFdimeaZV62oHYwtzudlL2OKqSZuZloZ0513CmJdazl+Seeda7JZpplVRUnmmiu5mVucCi6o5KBWOrkonDPWOAh8FH42nqB57igjdJr6KSlrkb6JaZ6ViuoTjdxkBiIwD4FJqKhvSkdMWaoScxYvYeIqbEeJcBooqLa2OmyM/zrNquqjaS4rbZaIGVurpdMKC8mnSimqbLbmrCPptcB+C243knAL7bnTTqIusuzGS92m6sprrzS3jQsvrkxS+u2thSbbqJvj7tivt8qOaamhwbJKJr36xthwoQlPTHGrEwN83LuTHnOwt/4uSnG5FYtMrIT6unQvuxGi/OxL5K68Iz4EvwzzzRjmrLNtNd/sM4k7By3gyeLlmLLPQiedH9FFO3ssRPHIbN+GEK/b00sOSl1by0X2Wl40If0mM81VY7qcr/w0JyKkcnKoYtk6KkdraKjKV3eXtQ3sqNl2JyZagp5yiTfXpnotuNwAwio14RsbDvhndGtNKtONP/r4gv+6rsx415YDjrni3hwg+uiip0h1tY57rqp0pLd+wC2uk25L7JO3WTi0qkc+e+yy18J76b67XrushrN99uqw/j767rwz33velHO+LuLjNac88AEo7/zyHFLbtM13/+el9ddv37r5r3cf/fc2C4o31MmXH3zz8z9vXNft89122CjWE7v/GWmdVPwnOqlIh2Aw6wb/iOMV54gFNaBDmc/AtsDAAGUyGIEgirw3By+BBG0VdMoDG6hB9xjoaD/DGawGI8K5lNCEePBgCrGWHhZicICWiRoH4cCxa2kFfllzoGBIKBa3wdAOMozZi0ITRLlYMDgD2pwcPCiAbi2xLfW5V3T/duiGTzVDieNb2sqYSDYkjssav7qKF8Uor1d5x3YdlBQ5tBKeNW7xXm50UAyfFQ86nsyOOtRWAwJ1RzhOkY9oXFWbABnEHT3gim80JA/lmEhkDbJ6hexIqRxwrKzdIXFi81CS2BiMc0ygk0eMIxk3mKVRBvKP6KLA0+4XR+SBbn0AcGUkL3mMC6DydHQA5bwk4LdG8hJfvlziXYKJHlrKkj6Z4yQyMbAPEnExDfTR2ymbGU1pPoMD1fTNNdGQFRptoJy6IiY2PsAWYNZyVR3ISzrVOcx4onOc5FynPbVzwGdqc5+geVsd6qkBeaKImvhEqD4HissM7GSDPFhounbVEgMiWWKauigBQTNKgoRytBUJAAAh+QQJDwAAACwFAEAAhABrAIIAAAAADAD/6EjghEH/REYyJS3///+GJicD/wi63P4wyklruDjjyrv/YNhoJCmeqJWlUemabHy+m/wKeC64ck/RvBRJR9SVfEjHDQdsOpdETXJaKkaf2Oe1NrVpBuDwwLrLZgnoqnHVZZHEcHAxg67XNfY8gWRXM9ltIl9xhHMYeneHiImKjBhrF4EzGISVcpABi3uNmnR9GpiSIBmWpVuZnReajnlDOVyiKheltKepqKubuJ8XobGytAODYYaqi5zHyGmPr5G/PwGlNGK2ybu317oBV88TlIRO1Ji3udqIGWvdLbPgGQXv8KTE4+fGq3itzH8B6g/fYhrgCXwnbww9PcqWlai3rRm/fgz+hXE3sGIBdpccZjPn6P8FQ40QF0gEc8GiyX/VECrCorLXvpAKME4sadIixlMboeDk5bKMM4gySQaoefKmxmwuyOB05RPWr5EYiBaddxSIUis0MP18GpSm1IootSa9SmbsKXVBhQ39CtboUn1k45J1KgnqWrYCR8qda3bvy2d28eZN6xer1cI+uwUWfDGtQcT7omVEV5huoMV4C4pDPOxxUy2AYkmMmnmkWjNvhPZEbfmyTNJfNatmLc9VBgO4DdzGLQXta69EZZ/ezZt48W8Yjv/JnfsCc91bAf++GzxtiefQA2DPLtl584bemYc/DnR6bOsktmfHXlv79+Xix2cvL1m1VNMv2Cd/3t49s/3/3LnHHX0AAWdTVzTEZ9wwtpkR0miwtVXfbN/R9g9lnznxIILUDTahavxZSFhkGsKkWYTxoCdghSLWVxUNMEU0XYf4Achii7TFKOOHFDX24XDj4diijjvCQVGNQiYZGpEnumCkklASqQSEqc20IpQWSukPh0iGiKWDWo5ApYorBvhlE2FOyWEc6R13ZolpivljO29mGeeWcz5Zp513ypnnbHui1icEphUY6KHRSecYoIjuuWGeUCponJle2qgBi/RBipqk+tnI4naTridpP8Ix2kSnncrnJqieinrjQ6KVKoyp+d0oqadtvnrrq4l20VkwQDbaokNcFQqslcKasUWx/4seawlk0ELWGhWyOltItNjKNW0SVQplbRzZhnvVttw26eSxZQlrGKyKGgpEMMWou6xvEx75biVvBTovvYYW9QK4JDLmY4f+NhQZgVae1+1jPQrWcE0YLtluwg5rppHAA7MVca/F9suYxSQ2SuyjHgss04uHjoywfRifHDKiKpNqXssTouzEATjnjLMWf618GsaNbUaCzkQfkEHROmOAtD7kulYvihrXTCLSRCtNtdEXLL0ax7E+DXV1Un92dc5WU1120luzy6+7BEsY1FFj75z11WeTnfajcz480K8MHx133VXPHbjBTVNr7NcEGQv334JrHYDjIClmLMUSPksiGv9I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";
const SPRITE_HOG_IDLE =
  "data:image/gif;base64,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";
const SPRITE_HOG_ATTACK =
  "data:image/gif;base64,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";
const SPRITE_HOG_ATTACK2 =
  "data:image/gif;base64,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";
const SPRITE_HOG_HIT =
  "data:image/gif;base64,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";

const SPRITE_FROG_IDLE =
  "data:image/gif;base64,R0lGODlh6QDPALMMAEQ3W9NsT6VRhP/oSFWcovv//9RtT+mnSH0qP/8/RP///wAMAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo1QzkyOEE4MUQyMkNFNjExQkJDRUQyREZBNEVGQzJBQSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoyRDgzNjI1RDJDRDYxMUU2OTk2QzkyRkUyNTZBN0ZBQyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyRDgzNjI1QzJDRDYxMUU2OTk2QzkyRkUyNTZBN0ZBQyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjYwOTI4QTgxRDIyQ0U2MTFCQkNFRDJERkE0RUZDMkFBIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjVDOTI4QTgxRDIyQ0U2MTFCQkNFRDJERkE0RUZDMkFBIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8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";
const SPRITE_FROG_ATTACK =
  "data:image/gif;base64,R0lGODlh6QDPALMMAEQ3W6VRhNNsT//oSFWcovv//9RtT+mnSH0qP/8/RP///wAAAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo1QzkyOEE4MUQyMkNFNjExQkJDRUQyREZBNEVGQzJBQSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoxMkQ3MzY1QjJEN0IxMUU2QTQ4RkU1QkYxRTYxMDQ0NCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxMkQ3MzY1QTJEN0IxMUU2QTQ4RkU1QkYxRTYxMDQ0NCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjIyMEEwMUU1NzMyREU2MTFCNkMxOUU4NzcxOEU4NUQyIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjVDOTI4QTgxRDIyQ0U2MTFCQkNFRDJERkE0RUZDMkFBIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8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";
const SPRITE_FROG_ATTACK2 =
  "data:image/gif;base64,R0lGODlh6QDPALMNAEQ3W9NsT6VRhFWcov/oSPv//9RtT30qP/8/ROmnSAAMAP///wAAAP///wAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo1QzkyOEE4MUQyMkNFNjExQkJDRUQyREZBNEVGQzJBQSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFMzEyQzFCQTJEMDIxMUU2QjUyREZFN0FDOTNEMDhEMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFMzEyQzFCOTJEMDIxMUU2QjUyREZFN0FDOTNEMDhEMSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjc3RkU2RkRCMDIyREU2MTFCQkNFRDJERkE0RUZDMkFBIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjVDOTI4QTgxRDIyQ0U2MTFCQkNFRDJERkE0RUZDMkFBIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8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";
const SPRITE_FROG_HIT =
  "data:image/gif;base64,R0lGODlh6QDPALMMAEQ3W9NsT//oSFWcoqVRhPv//9RtT30qP/8/ROmnSP///wAAAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo1QzkyOEE4MUQyMkNFNjExQkJDRUQyREZBNEVGQzJBQSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo3QUEyM0NBNjJEN0QxMUU2QjM2RUMyNUU3RjY3RDNEQyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo3QUEyM0NBNTJEN0QxMUU2QjM2RUMyNUU3RjY3RDNEQyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkQ3RkQ4MjU1N0IyREU2MTFCNkMxOUU4NzcxOEU4NUQyIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjVDOTI4QTgxRDIyQ0U2MTFCQkNFRDJERkE0RUZDMkFBIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8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";

const SPRITE_PIXIE_IDLE =
  "data:image/gif;base64,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";
const SPRITE_PIXIE_ATTACK =
  "data:image/gif;base64,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";
const SPRITE_PIXIE_ATTACK2 =
  "data:image/gif;base64,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";
const SPRITE_PIXIE_HIT =
  "data:image/gif;base64,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";
const SPRITE_GIANT_IDLE =
  "data:image/gif;base64,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";
const SPRITE_GIANT_ATTACK =
  "data:image/gif;base64,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";
const SPRITE_GIANT_ATTACK2 =
  "data:image/gif;base64,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";
const SPRITE_GIANT_HIT =
  "data:image/gif;base64,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";
const SPRITE_MUSH_IDLE =
  "data:image/gif;base64,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";
const SPRITE_MUSH_ATTACK =
  "data:image/gif;base64,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";
const SPRITE_MUSH_ATTACK2 =
  "data:image/gif;base64,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";
const SPRITE_MUSH_HIT =
  "data:image/gif;base64,R0lGODdhwACZAHcAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJDwAAACwAAAAAwACZAIMAAAAADAD/REbu8fqiKkhVnKJEN1sxYWyrq6IAAAAAAAAAAAAAAAAAAAAAAAAAAAAE/xDISau9OOvNu/9gKI5kaZ5oqq5s675wLM90bd94ru987//AoHBILBqPyKRyyWw6n9CodEqtWq/YrHbL7Xq/4LB4TC6bz+i0es1uu9/wuHxOr9vv+Lx+z+/7/4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeNAaqrrK2qqCGusrOusBa0uLmzp7q9vq2gv6sCxAPGx8jGwq+ZvsTP0MnS08+9lbrQ2c/T3MnZupG52uMC3ebH47mptNrI4+fn5OXqiLjZ1Pfw3eTI9ISzBAJGw5dPnzd+3GgBmlUgoMCCxuQVM4gOYcJdfRg2fCix4zZ4Hv/hyeIjq4DJjQQ8qoRYUaXIkXhKnkSZcqXNm+1eArvjaqZJhzUttsRJVCcrOz190nwHkmjRbjDnJJ0JlONEfTYjOi0njRiBWnKmUq06kOKAjge3kvu6E04rAkqrOuRqdihLrTnd2WR71C2rgCflAqVbF+/ds2X3eQwI1s1fwZBPFrZ7VW9lcyoZt2XzGLLcmZMR3z3MbTHfVW86ewaqdDJTw4SxSnTYeM3b1axb183qei3tvpxV44arVLJsl73HVd2s5vZnmsSLG8e8MrRoaHJrN18leGxu6QXiVQ+tPDtw284BB34OfrrlkOSzQWa+nXvVn5Hb+6Qs0br83L+h1ob/LMN9p99Y4yXH3kb0pQFQgeodCB1yFOGXH34NokELhBG2J5dXVrEk4WrenYfehhw6FFeKC47omXenOaYLizTiJqGFJEJnooOrGGAALjXauN6L+gUZ44A9+vhjLkbeB2OOT7KY4RmsKOnjjE2u2CSNU5pRpZVX+kKjlltyqN2JAYCppDAc+lSmlF1qmKSay6jy5p3LxcmjKmqGWaedggWAZ4FR1eHKmq2A+SeWZeKyRy999rkoivMt44cukUY66aYKCUJLpqD6yemk/8wSaqaj/iJqAIbgciqdX646KazMtJrLq0vOiSutaWq6YyG+8BrrrlYmKumvh6TKJ7HF6ooo/7KJKMtsrss+C+0jo75apya4HODttwco22kzrIBrLrjinmmJK+e2i+4vqLSCwLwIuGuvueqOIi+99N5rLwJ6euIKvwT36+8B8wbMycAFN2wwuAUrTO4qDQfg8MUVX7swxRFbjPHH9Ep8Dccdg2wywBpjworDqmBMsssiS7Jyxx5n/DLN+ap8M787z8KyowLvHHLLKA+879AkpzzJzD/jgnTNRycs4MZENy0LzgwTPPUmTFtds9dCSx101Sd/fPXPY39d9tpNp60223BLzWracdct99ydRG132Uov3fXeIPdNid6Aey3K2YVjjXcoiCdetOCX5MK2NfGmO64tlm9tyxQFm27u+eeghy766KSXbvrpqIsRAQAh+QQJCgAAACwAACEAhgBpAIIAAABEN1vu8fr/REaiKkj7szarq6IAAAAD/wi63P4wykmrvTjrzbv/YCiOZGmeaKqubOu+cCzPb2Df+E3vXu7/QBtvKAkajz7iECkQBAbQqHQKBSplxqa2Se12g9cWcEv2mr3JsMlHbmvPcGpaLWK7y/H89Ef/5KB3b3qDezl9HH9SeISMcjiHGDlcjZR6hpAUkpOVUUg/ZnOYDpqbjZ5IaJeiDKQClUAEsbIEP7SfhTqrCjiArow+s8HCsTeyt1KPuryvwMPOxDbCici5mMuUzc/axcE+uKLXiqWO3NrmtgHO01VCkOG9grjl59vRz+/VajddbfLz9PfsBbRBrZ0+glT6daoF0Ny/YeHyKdnHb4s/HA0HpjtHkf+dwYlPvFgsCCujtIfqEHoM0zFPNmMo6WGU2VEij5ZnGHabaZInR5UDPt4ECuflSYENYw5cCJIoqBw/N2ZUujRogKaDoEaVShPpT1srhwIdt5DqTq8aey6zGQOHG3Jo68VF6hNgIrY1bgQiydUuN4YY42oMideF3r1lBTu0d0qrXLBWr+44fCdx36nRGpudiRBvgc8rKFeOrJgmuiNdBRJM1uCz6wIpRL/V6TddsVqOIeY+LVTB69cnZM82Kpcx17q6ifNp/VkL8BLC8dAubhymZuTQVC14TcY1dBuBJk1PqfW6p7M2Xd/xTgJ8eI/Y0XM2T783APVu2NdxP5q0UiP/2eFgwIAEBkHggUdAgF8b+oUQXTxIzFISbwdWaOGFF7KmYHP5gTbCg5s0tpiAGJZo4oAaOrBgdx7uFwBipB1F34k0lljYfRwy2KKD/C0SI3mN1Shkhvb5luMWDar4G2wTRCdPUkYMKSWCRRq5ZJLMXdlkj2SZJeERU4Z5I45aRnDlcxCIlsplyUU5JJgY4iVFmRsW0CGTD7jlyxelBegmjafE2ZsXFqzIIp4NvEPOiEgAel2FKZ5BgaGHRoDTACH2GaQBAQhqXoESzflaFBNQWmmeRI20GTA/cOrpjNpFcSWpZh653o6spCqIl6z64KqF9VnBgKxL0lpneE1guYBT/5my2c1rfpJIZX0AaKcAsb8Z+4Cpp6JaVJ8ELBmtDZAGWwG2rml7bHjK7hJSTs7KciZv5E5L3wXoqrvurYiO4lQh2qzoWqv2mofBqPrWauedW767pjOGDpwDsOZWMOsAGZyJpqWXFgSxrRJLi2KwkpV65gYa98vxi/F4/GXEn/lasMEmc7jxwXRmwiVcPsBcgMygklyykgsjiathO1+Eg8ZAjyz00FnqqLIYSSst75IEO/10erYK0C4LsvFZy29AzLx11N22pabYn5qNmkZoJ3s0DHruCW8QHpV7SmpZ/kaEJJzgoneEUBL9NRaKYtPp4BNitu3hM3jzS9NaN16bLv/+HsMz5Zy+XVuVq5Bc7Q0UB4FZipmDc0qu9bod0+pFjNmH34mSXrrp4yKxMtSinMz64rdvvdyy1kKS8u+vCn+dLtwZjajtRCrvidO9d+31jtAHL33Z1Btv/fXPZ8/49kDLvgO34LNuI/mtozgtJug3KP74Qtdo/vnfJymy9iQ7yjsdlMLS/vhXH/8tYApqOF7m2pc8A7nNRLnoQgJzVrv5Ra91wCNgBt9nhgnebIEbDFMDGai1KCwCc2kaoAiJdKKOvAUKq1DWxFZIQ6eZUCEYg98HR2fBGtpPCDc8ofdoB0IfTimC8LCbDovWLs4ZMXgHJNQSnTM3d83wieNrgAQ5q8fEKhLvilgMRRRhiDkKppB7NBweCiVARAv86U1iXCMbvdiwTxlBjmo7Gx4RV7E9NkV3fgzkEBIAACH5BAkFAAAALAAAIQCHAGkAgwAAAAAMAO7x+v9ERqIqSEQ3W1WcojFhbPuzNqurogAAAAAAAAAAAAAAAAAAAAAAAAT/EMhJq7046827/2AoWkFpnmiqjmzrtmosz29t23Our3fvbzKBYEAsGo9II+/H/KmE0GFySi2mmtjXMyqseqvXrNiz5UqThLR6zW4XCaixPJMyR5HtvH4fn/vrdmdEe4SFbSd+coB2R4Z6M3l9iU0oRIxGjjsxkSaTTJVGd298mjtskp41J11epKWap52pqiZQVa6vJgUFkGuIszC1tmiPKrvHxyjIy5tqssAiq8PEscrL17wB2Ncpzs/QZMKs1L4n29u658go3gHgHyZF442c6erc2vfJJuXvHfFf6tnTt64EwX0B2vnTALDVIXMH8eWLWELhwgsnkgwTaDAis44H/094u0iiYagoD615LDiRoMg0JUhWMCkPigED1SCuZOnxJZyYMgHQrCngJs52KnfuGqiP3U93MjNqLGq0nDGlS0G6fPnNn9SpVZFeVcr0Xreu74YeCfs0B9ay51Q8JfmVHMwUEnfCjXsW6EK1o6zqZNlya2GzfaF6BTxI8N6sK7U2zXFRnN2xfClKRiyDbgAu9Bwfxvb442h06cIs/gy6sWjNpFOfRi371+JLKUvnzYa34+DYWm3fNjOAo958xtwCLywcnDibR19HnthbOWGJitOy5nIz92zEWV+ZPo0WWgkzbO/qNhveXIz2SRFm1849PV6s2eCTn7F8vvnz0HXn2P9bEOVyH3b+/ReAUQxG19Z3fBmYi3whIOFECQ2ydaBmEnZYngZT+GBChg5uaFhtuRyg4ooHdAZCFT1gSKJom9GG4gkstmhCjjyy2BwHRSAg5JBF4CBjhmKZSJg1KPTo5JM5fnhBkEMSSYSRCyKJlHw1jtUklGA+6ReQRFRp5QBYztgOgpsd9mWYcEY5JohlmolAkbRkyWA1Ng6UQ5yAypnglHVWiacWRwpolTodBuqojoNaQKWhV+a5J58n6vDoijII6sGkZ6bp4KJkdRqngSpKKSkVN/DjSqkxANqoqqta2GpFr/b056kezkmmES8eOhOuaii63pKxhtkrrT0kgRH/sQRceqx+yULpoVDM2sDqsAkVG9ZvEf4ZgJgSUuBrE0ZQiqa50EYbHbh9GpRCi052+MIxFRZ65roSuFpMjYzqUq2gr9yLzAegmnmov/9CeJ2pBBfcAjaf6qtwpdh2iwtFyJbA47KRanCMGvj+ameo/babG2ctQZwqyCFjMHIaJW+QsLoTMGxcfwUUwdubnOoQbswXzFwznQOcLKSwOue0Q89KqBAxZuF2AOw1FSd9srAZX+r0e7skIbWP/IV0bgUWHpz11hjnnOioD842qRVAy3BczCHuku+2JempqFjnzE0E0JAqOVnIoHKNcIgYjOg1jdiIjUICZFPNMuIWK541/7AMvc3Rb0eoQPkBCdjNoaoJa06J43/TqALdkycge+lgs7kEBqm3PcYJ6eEi14Ozz26dxEijnAgKcDvScPCyw3w7oUcA45TyvjNPu/OokBC9gk0bIoP112P/o9uqeyKD7zGAL75qfRM9ybJuB6D++uNnfPZqOjwrv/X0Z29/tkEBQgnm178cXC+AiNof/wr4vea5D4F0GCABGZgC4d0PggJU4AILGKXgAXAhtuob+Bwovid58IIyYRy3RkhC7DnphA98B4y4pcEJgqxHzPsgNG6mOBOw0IKayOHYVLRBDErgZkvT3Ql+KEQfMjF8TSKgEQGAxDvpLmNPzCIL07fBGKgCo4o9dKIWx0jGA04RjFe0XxnX+EQd7tBiSeQXDdlIxyJOcQJeiKAY60hHVemNJHxr3BL5uEb/TUBtF3EWB2JHyCyyrwJYu2MG99hIG0bKaH+UpB4pWUkoSmlmNMukJgXJyEY+zwKgJMDRzihHGjbQkTTYQCpXiUHOkbKAH9iGJkPYOeeNIJJ3pFL5XFmuidGylnUa5igRyMtl7lKZzoRgGqNJzWqyIAIAIfkECRQAAAAsAgAjAIUAZgCDAAAAAAwA7vH6/0RGoipIRDdbVZyiMWFsq6uiAAAAAAAAAAAAAAAAAAAAAAAAAAAABP8QyEmrvTjrzbv/YChiQWmeaHqObOuKaizPwWvfLq3vKO7/mZlAEBgYj8ik8qgCOoGpoXS4rFqRqae2hZp6r+BrdkvunLzfKmHNbrvfR0KvTLd00dTle8/vz+t0Z3gCSn2Gh28rgFtRaIWIfDN7f4s/jVNJkGs8KpMmlZYnRmlxhpw7bpSgXKJIhEiHp5ypn6s5JnlqfrInBQWSbYq2MLi5j54pvsrKKMvOMcElw8QlmMfRKs7aviXb2ilswtMcgsaltM3e2ybqzyfh0uPkxeZGidnt6wH5y+/w8htMHKlnD1svfvr2IfxlAl4NgBcEhrnHbmFCiwwDOIRop0SYART/u2H8JnKhPzkPOUpolURKQYMKR7qLifBkPJUsXU0JWVIms578bN6EKLGlFAMG0B30+ZNmUH+1iHpcchQpzIpMuQHNh2LT0HE5dSK16jBZ1owYwUUFW1TJkLFX0zHF+rTr2mltl8AtO8Mn3brv7toKm4mn04yH66ZV+3XwVF1xE27lmlidDnmEYUW2/LddZ88zANLTsxl05YsmK45hS+ol39P9Ph+czFm1qlX0XLr2uhQwyW4ie0uO3Rh3ADy7UQqnvJUdDW/CxQ2r5ggZbdNOnT+feVi68eNeyF6VuVQWd+jFQVEPn1QpbNNNtZuVIVk0+Cl7+Z61vVwr/d/pVbLe/1v5KffZYv7xEhxNt32HX4EGvlcbWogp2MtqHqzhhAljddgeb9dhp9CCFtIQQhtQlOBhfmYtNhsKB8QYY4nebfBGKAGs+GGEEnJH4gkyygjkjLxkuMZLPqioY1w9VjhiCkFGKeWUUjZ4ARtI3sDhkiDiI1k6UFIp5phCBkgBllnasKWHBsU3mZcwkimnmDVWgCZIGmqpJJsOAdhZd3HOKWiUgl15Iw5rQnigl06GOWiZjhKako0oJrmneH3WJsujm5b5ARsp5gihcqnxICiNdS6yZSQhihgolahaKWAJprSKXgxjxpqqerTu0qSbKtCpq0or9cqGeAfeKoOwqBI7Qf9Dx+6VrJ+4ThkrQKBWAO0aHYJYqg6SNjuOG9oay+2H/X0J3KtEXjvMHhRsa91IF7J7ype23JktAPLO+62TVe6A3Sp3ZtlvSBYxOGS4fYkISsF4ElCsRrW22lukkDas6aR1QJztwe4pm93CQQrMHMcdH6mZxBNXzIOPAVi7ncgoc5CnC/rezO+l1v2nzBoAH4BAyRpTa6ahOrMAb7yX7tjlezDJOLTQMxtdswaH4lxpuaKOKtc2IcWIwNhjF201CGju24LaTHeN6WuHpc2b2GQjYDbMdUYlN8tkJOr001jtbULdZN8NLIbPgkNuIImyCoxBhJftM3E7cN0V232vCQn/NHxFbvfkCfLAdOHSJM04h5rEcoLnuoZWLOlHZw5y6l2y3voOdReq6uW0y2D77TQQHvvpivccw+/A+5778MQrOHEAnn+evAqR646X6JZHL/30QVbPvLMRDR4991J6fzX4ZpSgveS3R/k7+iysvv72qHb/PvzUQD8//TMIH6z21sNfEOS3P+WNDwXzC6AASSC+/TkQeQlU4ALDp74HWvCC7Jvgmfg2wAZi8IMA/B62MNcRD4LwhBnUIACy1sEKohCFEuTI3uZhwhc+UFbEyhkHW6g/GzoQcfjToQcQ6MMI7gp8SxsiEYu4PCBOcHEhWCITm6BCC5BQiQR8YQxG4IsqMQaEEyGUAQuW4UUNTE+EFtBGGb84LBd4Y43p4wQQ3ghHAaqxjgskIx4n2MU9+tEDEQAAOw==";
const MONSTER_SPRITES: Record<
  string,
  { idle: string; attack: string; attack2: string; hit: string }
> = {
  Bat: {
    idle: SPRITE_BAT_IDLE,
    attack: SPRITE_BAT_ATTACK,
    attack2: SPRITE_BAT_ATTACK_2,
    hit: SPRITE_BAT_HIT,
  },
  Grunt: {
    idle: SPRITE_GRUNT_IDLE,
    attack: SPRITE_GRUNT_ATTACK,
    attack2: SPRITE_GRUNT_GUARD,
    hit: SPRITE_GRUNT_HIT,
  },
  Slime: {
    idle: SPRITE_SLIME_IDLE,
    attack: SPRITE_SLIME_ATTACK,
    attack2: SPRITE_SLIME_ATTACK2,
    hit: SPRITE_SLIME_HIT,
  },
  Cowboy: {
    idle: SPRITE_COWB_IDLE,
    attack: SPRITE_COWB_ATTACK,
    attack2: SPRITE_COWB_ATTACK2,
    hit: SPRITE_COWB_HIT,
  },
  RatKing: {
    idle: SPRITE_RAT_IDLE,
    attack: SPRITE_RAT_ATTACK,
    attack2: SPRITE_RAT_ATTACK2,
    hit: SPRITE_RAT_HIT,
  },
  Hogglin: {
    idle: SPRITE_HOG_IDLE,
    attack: SPRITE_HOG_ATTACK,
    attack2: SPRITE_HOG_ATTACK2,
    hit: SPRITE_HOG_HIT,
  },
  Malipole: {
    idle: SPRITE_FROG_IDLE,
    attack: SPRITE_FROG_ATTACK,
    attack2: SPRITE_FROG_ATTACK2,
    hit: SPRITE_FROG_HIT,
  },
  Pixie: {
    idle: SPRITE_PIXIE_IDLE,
    attack: SPRITE_PIXIE_ATTACK,
    attack2: SPRITE_PIXIE_ATTACK2,
    hit: SPRITE_PIXIE_HIT,
  },
  Giant: {
    idle: SPRITE_GIANT_IDLE,
    attack: SPRITE_GIANT_ATTACK,
    attack2: SPRITE_GIANT_ATTACK2,
    hit: SPRITE_GIANT_HIT,
  },
  Mushroom: {
    idle: SPRITE_MUSH_IDLE,
    attack: SPRITE_MUSH_ATTACK,
    attack2: SPRITE_MUSH_ATTACK2,
    hit: SPRITE_MUSH_HIT,
  },
};

const SPRITE_SCALE: Record<string, number> = {
  Giant: 1.2,
  Mushroom: 1,
  Bat: 1,
  Grunt: 1,
  Slime: 1,
  Cowboy: 1,
  RatKing: 0.65,
  Hogglin: 0.65,
  Malipole: 1,
  Pixie: 1,
};
const SPRITE_FLIP: Record<string, number> = {
  Giant: 1,
  Mushroom: 1,
  Bat: 1,
  Grunt: 1,
  Slime: 1,
  Cowboy: 1,
  RatKing: 1,
  Hogglin: 1,
  Malipole: -1,
  Pixie: 1,
};

const getMonsterName = (emoji: string): string | null => {
  if (emoji === "👾") return "Grunt";
  if (emoji === "🟩") return "Slime";
  if (emoji === "🦇") return "Bat";
  if (emoji === "🤠") return "Cowboy";
  if (emoji === "🐀") return "RatKing";
  if (emoji === "🦔") return "Hogglin";
  if (emoji === "🐸") return "Malipole";
  if (emoji === "🧚") return "Pixie";
  if (emoji === "🗿") return "Giant";
  if (emoji === "🍄") return "Mushroom";
  return null;
};

const ALL_CHARS = [...CHARACTERS, ...MONSTER_CHARACTERS];

const getDefaultDeck = (charName: string): string[] => {
  const ch = ALL_CHARS.find((c) => c.name === charName);
  if (!ch) return [];
  return ch.moves.slice(0, MAX_DECK_SIZE).map((m) => m.name);
};

// ════════════════════════════════════════════════════════════
// 3D COMPONENTS
// ════════════════════════════════════════════════════════════

const Tile3D: React.FC<{
  x: number;
  y: number;
  isPlayerGrid: boolean;
  color: string;
  highlight?: boolean;
  effectColor?: string;
}> = ({ x, y, isPlayerGrid, color, highlight, effectColor }) => (
  <Box
    position={[x + (isPlayerGrid ? GRID_SIZE : 0), 0, y]}
    args={[0.9, 0.1, 0.9]}
    castShadow
    receiveShadow
  >
    <meshStandardMaterial
      color={effectColor || color}
      emissive={effectColor || (highlight ? color : "#000000")}
      emissiveIntensity={effectColor ? 0.7 : highlight ? 0.5 : 0}
    />
  </Box>
);

const Character3D: React.FC<{
  x: number;
  y: number;
  emoji: string;
  isOpponent?: boolean;
  stunned?: boolean;
  isCharging?: boolean;
  frenzy?: boolean;
  animState?: "idle" | "attack" | "attack2" | "hit";
}> = ({
  x,
  y,
  emoji,
  isOpponent = false,
  stunned,
  isCharging,
  frenzy,
  animState = "idle",
}) => {
  const monsterName = getMonsterName(emoji);
  const sprites = monsterName ? MONSTER_SPRITES[monsterName] : null;
  const spriteUrl = sprites
    ? stunned
      ? sprites.hit
      : sprites[animState]
    : null;
  return (
    <group position={[x + (isOpponent ? 0 : GRID_SIZE), 0.8, y]}>
      {spriteUrl ? (
        <Html center sprite transform={false} style={{ pointerEvents: "none" }}>
          <img
            src={spriteUrl}
            alt={monsterName || ""}
            style={{
              width: 80 * (SPRITE_SCALE[monsterName || ""] || 1),
              height: 80 * (SPRITE_SCALE[monsterName || ""] || 1),
              imageRendering: "pixelated",
              transform: `scaleX(${
                (isOpponent ? 1 : -1) * (SPRITE_FLIP[monsterName || ""] || 1)
              })`,
              filter: stunned
                ? "brightness(0.5) saturate(0.3)"
                : frenzy
                ? "brightness(1.4) hue-rotate(90deg)"
                : "none",
              transition: "filter 0.15s",
            }}
          />
        </Html>
      ) : (
        <>
          <Sphere args={[0.3, 16, 16]} castShadow>
            <meshStandardMaterial
              color={
                stunned
                  ? "#808080"
                  : frenzy
                  ? "#00ff00"
                  : isOpponent
                  ? "#4444ff"
                  : "#ff4444"
              }
              emissive={frenzy ? "#00ff00" : "#000000"}
              emissiveIntensity={frenzy ? 0.8 : 0}
            />
          </Sphere>
          <Text
            position={[0, 0.5, 0]}
            fontSize={0.4}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            {stunned ? "😵" : emoji}
          </Text>
        </>
      )}
      {isCharging && (
        <Sphere args={[0.4, 16, 16]}>
          <meshStandardMaterial
            color="#ffff00"
            transparent
            opacity={0.3}
            emissive="#ffff00"
            emissiveIntensity={1}
          />
        </Sphere>
      )}
    </group>
  );
};

const Projectile3D: React.FC<{
  x: number;
  y: number;
  type:
    | "normal"
    | "rat"
    | "charged"
    | "opponent"
    | "quickdraw"
    | "ricochet"
    | "thorn";
  direction: "left" | "right";
}> = ({ x, y, type, direction }) => {
  const getColor = () => {
    switch (type) {
      case "rat":
        return "#ff9900";
      case "charged":
        return "#00ff00";
      case "opponent":
        return "#4444ff";
      case "quickdraw":
        return "#ff4444";
      case "ricochet":
        return "#ffaa00";
      case "thorn":
        return "#44cc44";
      default:
        return "#ffff00";
    }
  };
  const colorTint = getColor();
  const hueMap: Record<string, string> = {
    "#ff9900": "hue-rotate(-30deg) saturate(2)",
    "#00ff00": "hue-rotate(100deg) saturate(2)",
    "#4444ff": "hue-rotate(200deg) saturate(2)",
    "#ff4444": "hue-rotate(-20deg) saturate(1.5)",
    "#ffaa00": "hue-rotate(-10deg) saturate(2)",
    "#44cc44": "hue-rotate(80deg) saturate(2)",
    "#ffff00": "none",
  };
  return (
    <group position={[x, 0.4, y]}>
      <Html center sprite transform={false} style={{ pointerEvents: "none" }}>
        <img
          src={SPRITE_BULLET}
          alt="bullet"
          style={{
            width: 48,
            height: 36,
            imageRendering: "pixelated",
            transform: `scaleX(${direction === "left" ? -1 : 1})`,
            filter: hueMap[colorTint] || "none",
          }}
        />
      </Html>
      <pointLight color={colorTint} intensity={2} distance={2} />
    </group>
  );
};

const Effect3D: React.FC<{
  x: number;
  y: number;
  type: string;
  ttl: number;
}> = ({ x, y, type, ttl }) => {
  const scale = Math.min(1, ttl / 10);
  const getColor = () => {
    switch (type) {
      case "explosion":
        return "#ff0000";
      case "leafstorm":
        return "#00ff00";
      case "flyingsword":
      case "clawingsword":
        return "#9900ff";
      case "ratpack":
      case "ratstorm":
        return "#ff9900";
      case "tonguewhip":
        return "#ff00ff";
      case "teleport":
        return "#00ffff";
      case "chorus":
        return "#00ff00";
      case "lilypad":
        return "#88ff88";
      case "dustdevil":
        return "#c4a060";
      case "sporecloud":
        return "#88cc44";
      case "croakbeam":
        return "#44aaff";
      case "vinesnare":
        return "#33aa33";
      case "silencebomb":
        return "#9966cc";
      case "mushpoisontrail":
        return "#66cc33";
      case "poisondot":
        return "#99ff00";
      case "healfont":
        return "#88ffaa";
      case "stungleam":
        return "#ffffaa";
      case "hammerwarning":
        return "#ff4400";
      case "hammerhit":
        return "#ff0000";
      case "zonesteal":
        return "#4488ff";
      case "silencebomb":
        return "#9966cc";
      case "mushpoisontrail":
        return "#66cc33";
      case "healpuddle":
        return "#44ff88";
      case "poisontrap":
      case "poisontile":
      case "mushpoison_p":
      case "mushpoison_e":
        return "#aa44ff";
      case "frozentile":
        return "#88ddff";
      case "brokentile":
        return "#8B4513";
      case "brokenwall":
        return "#654321";
      case "tadpole":
        return "#44cc88";
      case "vampmist":
        return "#880044";
      case "topple":
        return "#ff6600";
      case "e_sweep":
        return "#ff2266";
      case "e_beam":
        return "#ff4488";
      case "e_zone":
        return "#cc2244";
      default:
        return "#ffffff";
    }
  };
  return (
    <Sphere position={[x, 0.5, y]} args={[0.3 * scale, 16, 16]} castShadow>
      <meshStandardMaterial
        color={getColor()}
        transparent
        opacity={0.6}
        emissive={getColor()}
        emissiveIntensity={1}
      />
    </Sphere>
  );
};

const Block3D: React.FC<{ x: number; y: number; health: number }> = ({
  x,
  y,
  health,
}) => (
  <Box position={[x, 0.4, y]} args={[0.8, 0.8, 0.8]} castShadow>
    <meshStandardMaterial color={health > 1 ? "#ff8800" : "#ff4400"} />
  </Box>
);

const TrapTile3D: React.FC<{
  x: number;
  y: number;
  type: string;
  ttl: number;
}> = ({ x, y, type, ttl }) => {
  const getColor = () => {
    switch (type) {
      case "healfont":
        return "#88ffaa";
      case "healpuddle":
        return "#ffcc00";
      case "poisontrap":
      case "poisontile":
      case "poisononly":
      case "mushpoison_p":
      case "mushpoison_e":
        return "#9933cc";
      case "frozentile":
        return "#66ccff";
      case "brokentile":
        return "#888888";
      case "brokenwall":
        return "#555555";
      case "vinesnare":
        return "#33aa33";
      case "silencebomb":
        return "#9966cc";
      case "mushpoisontrail":
        return "#66cc33";
      case "lilypad":
        return "#88ff88";
      case "vampmist":
        return "#880044";
      case "sporecloud":
        return "#88cc44";
      default:
        return "#ffffff";
    }
  };
  const pulse = Math.sin(ttl * 0.3) * 0.15 + 0.55;
  return (
    <Box position={[x, 0.02, y]} args={[0.9, 0.04, 0.9]}>
      <meshStandardMaterial
        color={getColor()}
        transparent
        opacity={pulse}
        emissive={getColor()}
        emissiveIntensity={0.6}
      />
    </Box>
  );
};

const Beam3D: React.FC<{
  y: number;
  direction: "left" | "right";
  side: "player" | "opponent";
}> = ({ y, side }) => {
  const startX = side === "player" ? GRID_SIZE : 0;
  const endX = side === "player" ? GRID_SIZE * 2 : GRID_SIZE;
  return (
    <Box
      position={[(startX + endX) / 2, 0.3, y]}
      args={[GRID_SIZE, 0.1, 0.3]}
      castShadow
    >
      <meshStandardMaterial
        color="#9900ff"
        emissive="#9900ff"
        emissiveIntensity={1}
        transparent
        opacity={0.7}
      />
    </Box>
  );
};

// ════════════════════════════════════════════════════════════
// 3D GAME SCENE
// ════════════════════════════════════════════════════════════

const GameScene3D: React.FC<{
  playerPos: Position;
  opponentPos: Position;
  playerBullets: Bullet[];
  opponentBullets: Bullet[];
  blocks: Block[];
  turrets: Turret[];
  beams: Beam[];
  explosionEffects: TimedEffect[];
  bombs: Bomb[];
  delayBombs: DelayBomb[];
  boomerang: Boomerang | null;
  tractorBeam: Beam | null;
  selectedCharacter: Character;
  opponentStunned: number;
  isCharging: boolean;
  malipoleFrenzyActive: boolean;
  lilyPadTraps: TimedEffect[];
  tongueWhipActive: TimedEffect | null;
  slash: TimedEffect[];
  punch: TimedEffect | null;
  lasso: TimedEffect | null;
  enemyEmoji: string;
  playerAnimState: "idle" | "attack" | "attack2" | "hit";
  opponentAnimState: "idle" | "attack" | "attack2" | "hit";
  enemy2Pos?: Position;
  enemy2Emoji?: string;
  enemy2Stunned?: number;
  enemy2AnimState?: "idle" | "attack" | "attack2" | "hit";
  enemy2HP?: number;
  zoneStealTimer: number;
  zoneStealOwner: "player" | "enemy" | null;
  zoneStealCol: number;
}> = (props) => {
  const {
    playerPos,
    opponentPos,
    playerBullets,
    opponentBullets,
    blocks,
    turrets,
    beams,
    explosionEffects,
    bombs,
    delayBombs,
    boomerang,
    tractorBeam,
    selectedCharacter,
    opponentStunned,
    isCharging,
    malipoleFrenzyActive,
    lilyPadTraps,
    tongueWhipActive,
    slash,
    punch,
    lasso,
    enemyEmoji,
    playerAnimState,
    opponentAnimState,
    enemy2Pos,
    enemy2Emoji,
    enemy2Stunned,
    enemy2AnimState,
    enemy2HP,
    zoneStealTimer,
    zoneStealOwner,
    zoneStealCol,
  } = props;

  // Build a lookup of tile colors from traps + tile-based effects
  const tileEffectMap = useMemo(() => {
    const m: Record<string, string> = {};
    const colorFor = (etype: string): string | null => {
      switch (etype) {
        case "healfont":
          return "#88ffaa";
        case "healpuddle":
          return "#ccaa00";
        case "poisontrap":
        case "poisononly":
        case "poisontile":
        case "mushpoison_p":
        case "mushpoison_e":
          return "#9933cc";
        case "frozentile":
          return "#3399dd";
        case "brokentile":
          return "#777777";
        case "brokenwall":
          return "#444444";
        case "vinesnare":
          return "#228822";
        case "lilypad":
          return "#cc6600";
        case "vampmist":
          return "#880044";
        case "sporecloud":
          return "#668833";
        case "e_zone":
          return "#cc2244";
        default:
          return null;
      }
    };
    lilyPadTraps.forEach((t) => {
      const c = colorFor(t.effectType || "lilypad");
      if (c) m[`${t.x},${t.y}`] = c;
    });
    explosionEffects.forEach((e) => {
      const c = colorFor(e.effectType || "");
      if (c) m[`${e.x},${e.y}`] = c;
    });
    return m;
  }, [lilyPadTraps, explosionEffects]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[GRID_SIZE, 5, GRID_SIZE]} intensity={0.5} />
      {Array.from({ length: GRID_SIZE * 2 }, (_, x) =>
        Array.from({ length: GRID_SIZE }, (_, y) => {
          const isPlayerGrid = x >= GRID_SIZE;
          const localX = isPlayerGrid ? x - GRID_SIZE : x;
          let highlight = false;
          if (isPlayerGrid && localX === playerPos.x && y === playerPos.y)
            highlight = true;
          if (!isPlayerGrid && localX === opponentPos.x && y === opponentPos.y)
            highlight = true;
          if (
            enemy2Pos &&
            !isPlayerGrid &&
            localX === enemy2Pos.x &&
            y === enemy2Pos.y
          )
            highlight = true;
          const ec = tileEffectMap[`${x},${y}`];
          // Zone steal tile coloring
          let tileColor = isPlayerGrid ? "#ff4444" : "#4444ff";
          if (zoneStealTimer > 0 && x === zoneStealCol) {
            if (zoneStealOwner === "player" && !isPlayerGrid) {
              tileColor = "#7799ff"; // lighter blue - player claimed it
            } else if (zoneStealOwner === "enemy" && isPlayerGrid) {
              tileColor = "#ff9999"; // lighter red - enemy claimed it
            }
          }
          return (
            <Tile3D
              key={`tile-${x}-${y}`}
              x={localX}
              y={y}
              isPlayerGrid={isPlayerGrid}
              color={tileColor}
              highlight={highlight}
              effectColor={ec}
            />
          );
        })
      )}
      <Character3D
        x={playerPos.x}
        y={playerPos.y}
        emoji={selectedCharacter.emoji}
        isCharging={isCharging}
        frenzy={malipoleFrenzyActive}
        animState={playerAnimState}
      />
      <Character3D
        x={opponentPos.x}
        y={opponentPos.y}
        emoji={enemyEmoji}
        isOpponent
        stunned={opponentStunned > 0}
        animState={opponentAnimState}
      />
      {enemy2Pos && enemy2Emoji && (enemy2HP ?? 0) > 0 && (
        <Character3D
          x={enemy2Pos.x}
          y={enemy2Pos.y}
          emoji={enemy2Emoji}
          isOpponent
          stunned={(enemy2Stunned ?? 0) > 0}
          animState={enemy2AnimState ?? "idle"}
        />
      )}
      {playerBullets.map((b, i) => {
        let ptype:
          | "normal"
          | "rat"
          | "charged"
          | "opponent"
          | "quickdraw"
          | "ricochet"
          | "thorn" = "normal";
        if (b.isRat) ptype = "rat";
        else if (b.chargePower) ptype = "charged";
        else if (b.isQuickdraw) ptype = "quickdraw";
        else if (b.isRicochet) ptype = "ricochet";
        else if (b.isThorn) ptype = "thorn";
        return (
          <Projectile3D
            key={`pb-${i}`}
            x={b.x}
            y={b.y}
            type={ptype}
            direction={b.direction}
          />
        );
      })}
      {opponentBullets.map((b, i) => (
        <Projectile3D
          key={`ob-${i}`}
          x={b.x}
          y={b.y}
          type="opponent"
          direction="right"
        />
      ))}
      {blocks.map((b, i) => (
        <Block3D key={`bl-${i}`} x={b.x} y={b.y} health={b.health} />
      ))}
      {turrets.map((t, i) => (
        <group key={`turret-${i}`} position={[t.x, 0.5, t.y]}>
          <mesh>
            <boxGeometry
              args={t.isMushroom ? [0.4, 0.6, 0.4] : [0.5, 0.8, 0.5]}
            />
            <meshStandardMaterial
              color={
                t.isMushroom
                  ? t.owner === "player"
                    ? "#cc8844"
                    : "#884422"
                  : t.owner === "player"
                  ? "#88ddaa"
                  : "#dd8888"
              }
            />
          </mesh>
          {t.isMushroom ? (
            <mesh position={[0, 0.45, 0]}>
              <sphereGeometry
                args={[0.35, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial
                color={t.owner === "player" ? "#ff6644" : "#cc3322"}
              />
            </mesh>
          ) : (
            <mesh
              position={[t.owner === "player" ? -0.3 : 0.3, 0.2, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.08, 0.08, 0.4, 8]} />
              <meshStandardMaterial color="#555" />
            </mesh>
          )}
          <Html position={[0, 0.6, 0]} center style={{ pointerEvents: "none" }}>
            <div
              style={{
                fontSize: "0.6rem",
                color: "#fff",
                background: "rgba(0,0,0,0.5)",
                padding: "1px 3px",
                borderRadius: 2,
                whiteSpace: "nowrap",
              }}
            >
              {t.hp}HP
            </div>
          </Html>
        </group>
      ))}
      {beams.map((b, i) => (
        <Beam3D
          key={`bm-${i}`}
          y={b.y}
          direction={b.direction}
          side="opponent"
        />
      ))}
      {tractorBeam && (
        <Beam3D
          y={tractorBeam.y}
          direction={tractorBeam.direction}
          side="opponent"
        />
      )}
      {explosionEffects.map((e, i) => {
        const tileTypes = ["vampmist", "brokenwall", "sporecloud"];
        if (tileTypes.includes(e.effectType || "")) return null; // rendered via tile color
        return (
          <Effect3D
            key={`ef-${i}`}
            x={e.x}
            y={e.y}
            type={e.effectType || "explosion"}
            ttl={e.ttl}
          />
        );
      })}
      {tongueWhipActive && (
        <Effect3D
          x={tongueWhipActive.x}
          y={tongueWhipActive.y}
          type="tonguewhip"
          ttl={tongueWhipActive.ttl}
        />
      )}
      {slash.map((s, i) => (
        <Effect3D
          key={`sl-${i}`}
          x={s.x}
          y={s.y}
          type="flyingsword"
          ttl={s.ttl}
        />
      ))}
      {punch && (
        <Effect3D x={punch.x} y={punch.y} type="explosion" ttl={punch.ttl} />
      )}
      {lasso && (
        <Effect3D x={lasso.x} y={lasso.y} type="tonguewhip" ttl={lasso.ttl} />
      )}
      {bombs.map((b, i) => (
        <Sphere
          key={`bo-${i}`}
          position={[b.x, 0.3, b.y]}
          args={[0.25, 16, 16]}
          castShadow
        >
          <meshStandardMaterial color="#333333" />
        </Sphere>
      ))}
      {delayBombs.map((b, i) => (
        <group key={`db-${i}`} position={[b.x, 0.3, b.y]}>
          <Sphere args={[0.25, 16, 16]} castShadow>
            <meshStandardMaterial
              color="#ff00ff"
              emissive="#ff00ff"
              emissiveIntensity={0.5}
            />
          </Sphere>
          <Text position={[0, 0.5, 0]} fontSize={0.2} color="white">
            {Math.ceil(b.timer / 10)}
          </Text>
        </group>
      ))}
      {boomerang && (
        <group position={[boomerang.x, 0.5, boomerang.y]}>
          <Sphere args={[0.3, 16, 16]} castShadow>
            <meshStandardMaterial
              color="#ffcc00"
              emissive="#ffaa00"
              emissiveIntensity={1}
            />
          </Sphere>
          <pointLight color="#ffcc00" intensity={3} distance={3} />
        </group>
      )}
    </>
  );
};

// ════════════════════════════════════════════════════════════
// OVERWORLD TILE RENDERER
// ════════════════════════════════════════════════════════════

const OW_GRASS =
  "data:image/gif;base64,R0lGODdhQABAAHcAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQIKAAAACwAAAAAQABAAIE3lG6Z5VC/5VAAAAAC/4wtecvtDwVLlC4pg4K8+1NZz/aVZRaSYIiYroPFaMO+dqRUtKjd/tXqAYGqnyszDBqXoB6GCY0Ip9GqdQG4arGA7Nbq/V7DDLL4jP5ku+nfus30ys3wV5deP7A5bLzP7/GWdveXdweIVdaBaMNotNf44NgwCUUYIJhnh9mnqcbJCem5eFgpaSAaVUpoSqm1t9palqqKiXoZuUb7qAvqxjr66RvMJ0s8fCxsTLw8upvs0Aw93ShNfY3t+ZytlskNWvqd2Clua11+3JvNiJSOiq6Ifgh/69FuaGvOcR/svcOviVU7FDyYkZEA4IkGgAHNCHDI0BCZNyIitqGTkE0OiwcXcYFKEaAAADs=";
const OW_FLOWER =
  "data:image/gif;base64,R0lGODdhQABAAHcAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEKAAAACwAAAAAQABAAII3lG778jaZ5VC/5VDXe7oAAAAAAAAAAAAD/zi6KyMwykkne1fFzDPUVQhUj+Nh29etWhlO45tKjGOa64fLsezrllKrZSsCe7xRD/QLsYAUpACgnFabTqcwGK1Sp1GIFKsFxc6SLzgd6Y3JpNZV7aa6eXCfa620e69hbWp5JEVnD190dmKEjSqMf46SejZ+lpOYFHt3d5mYA3OeoiJidJkEqGKoq42Xo6upsKyEi2dvcLK5qbRSt7i6smxNgKLAuXl9vo26Abprw6MTsgHUzovP0T/Txm2MFcqTxtZomLPa4rJ+3r+xsE3ou1aJxFYv4u/wtvPY56jN7v3uybM0qFuIVdT+EcACb6GgfeCk+TOHj9WxNAS90ZMgsP5fBIAPCRa0hy6byHo7KDQUVWueugYqg10clSyjCykXQZrM+OggxWyQRLoBtW7KT6ClTpLrIwjpNzCXOjmFU/NaKKlTYQyspy8rMldNvfr4o65pRLFCI4kddtKg13giXJY9Ww6uVrVks+p82lIuXTIWj4bVhyRRUUkl3XIdifJvwIkAR6q7tvXwMlgJ92IsBXXgXH4Mt2lOihIjRMqXZ34zpZEzVMckBcOoRaNvqHCjLZRV4WtjnmB4FqcsjBqxOaZhSizRyBqo76RVFORFvvPWHhWgqu422RTFDgZCPUcDpATDhdppm4OWREU59gzpBxXOZIvGivjF17fShONCAgAh+QQIKAAAACwAAAAAQABAAII3lG778jaZ5VC/5VDXe7oAAAAAAAAAAAAD/zi6LP4wSsmGqOrhzfP8wGRd2GU6Y6eO3xS2FdRY2bq1z4uHNItSqV7sRMIJdMeQjobyGZszj8eBPOasAKUE6Yx0m6QhJDsum6tPXC0ceWmpVKTOvUyLSpZ5lswnt9x2agsUfDl7SVZwhmiBXoMse29bjI2NUm1KfomVnHd/imadoj+TmZSjqItxhamtV6+bnASzD7O2qHSaora0vLeduaeBvsS0o5KpxcQuT5mxo8rLnMitxQHFkcJbrrW8Ad/YptrPrr7Xyq+nrNzRxUmHO9q/T+3L4vESvAK+afXGi+tWkWvXz98kLCDQeONHz+CYbGhO2fp2joAdfxZLUTMycf9ewVvSMMEDhIPgx27/NMIjhzIaN5F9mjDC+PKKODKDyiwLWfMmHycvpOmrqVHDFwdDiYJ4p+mRnxAelcLMRmUA1Y1SVWoyFSqrkUNaYnoNdK8NqHFjmZZZmTZe2URo22KJtEqXXLdyuEpN6VYt07iy+H4K9ndvVLxb6QYMbDHpV0SJ6ZYz+QcsXIh2GXd0/PCdVsm7vIE7PBUORM+AIxCrKFiklQwjxUJz14wt5Lm2OzGsTaiKs2qcH2tAaJNlpd1prEJBNgd4668vphy8+2kBSb/GubHNab0PZlBKM5vo4RNz6kaRgjxSYN48LFc42Wxo7x48riM+OtAH/f4YOSEDDCQAADs=";
const OW_FLOWER_WHITE =
  "data:image/gif;base64,R0lGODdhQABAAHcAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEKAAAACwAAAAAQABAAII3lG778jaZ5VC/5VD///8AAAAAAAAAAAAD/zi6KyMwykkne1fFzDPUVQhUj+Nh29etWhlO45tKjGOa64fLsezrllKrZSsCe7xRD/QLsYAUpACgnFabTqcwGK1Sp1GIFKsFxc6SLzgd6Y3JpNZV7aa6eXCfa620e69hbWp5JEVnD190dmKEjSqMf46SejZ+lpOYFHt3d5mYA3OeoiJidJkEqGKoq42Xo6upsKyEi2dvcLK5qbRSt7i6smxNgKLAuXl9vo26Abprw6MTsgHUzovP0T/Txm2MFcqTxtZomLPa4rJ+3r+xsE3ou1aJxFYv4u/wtvPY56jN7v3uybM0qFuIVdT+EcACb6GgfeCk+TOHj9WxNAS90ZMgsP5fBIAPCRa0hy6byHo7KDQUVWueugYqg10clSyjCykXQZrM+OggxWyQRLoBtW7KT6ClTpLrIwjpNzCXOjmFU/NaKKlTYQyspy8rMldNvfr4o65pRLFCI4kddtKg13giXJY9Ww6uVrVks+p82lIuXTIWj4bVhyRRUUkl3XIdifJvwIkAR6q7tvXwMlgJ92IsBXXgXH4Mt2lOihIjRMqXZ34zpZEzVMckBcOoRaNvqHCjLZRV4WtjnmB4FqcsjBqxOaZhSizRyBqo76RVFORFvvPWHhWgqu422RTFDgZCPUcDpATDhdppm4OWREU59gzpBxXOZIvGivjF17fShONCAgAh+QQIKAAAACwAAAAAQABAAII3lG778jaZ5VC/5VD///8AAAAAAAAAAAAD/zi6LP4wSsmGqOrhzfP8wGRd2GU6Y6eO3xS2FdRY2bq1z4uHNItSqV7sRMIJdMeQjobyGZszj8eBPOasAKUE6Yx0m6QhJDsum6tPXC0ceWmpVKTOvUyLSpZ5lswnt9x2agsUfDl7SVZwhmiBXoMse29bjI2NUm1KfomVnHd/imadoj+TmZSjqItxhamtV6+bnASzD7O2qHSaora0vLeduaeBvsS0o5KpxcQuT5mxo8rLnMitxQHFkcJbrrW8Ad/YptrPrr7Xyq+nrNzRxUmHO9q/T+3L4vESvAK+afXGi+tWkWvXz98kLCDQeONHz+CYbGhO2fp2joAdfxZLUTMycf9ewVvSMMEDhIPgx27/NMIjhzIaN5F9mjDC+PKKODKDyiwLWfMmHycvpOmrqVHDFwdDiYJ4p+mRnxAelcLMRmUA1Y1SVWoyFSqrkUNaYnoNdK8NqHFjmZZZmTZe2URo22KJtEqXXLdyuEpN6VYt07iy+H4K9ndvVLxb6QYMbDHpV0SJ6ZYz+QcsXIh2GXd0/PCdVsm7vIE7PBUORM+AIxCrKFiklQwjxUJz14wt5Lm2OzGsTaiKs2qcH2tAaJNlpd1prEJBNgd4668vphy8+2kBSb/GubHNab0PZlBKM5vo4RNz6kaRgjxSYN48LFc42Wxo7x48riM+OtAH/f4YOSEDDCQAADs=";
const OW_TALL_GRASS =
  "data:image/gif;base64,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";
const OW_ROCK =
  "data:image/gif;base64,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";
const OW_TREE =
  "data:image/gif;base64,R0lGODdhQABAAHcAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEKAAAACwAAAAAQABAAIEyPDlSSyQ3lG6Z5VAC/5yPJrsqCaNMb7SJ2dO4x+pl2naF5gGeqDWWCQDHgAeOltm2xjzvcqzShUi5FGIEHBKNk0aR6WjBMiznZtW85Q49xY8BgCpWHIr5WZr6frBG93O0beVXkHrA/k7flKe2WDU2kcfmI+HHUKVTw9RDmIeXNRenmALl+PgT2cHhcoQlkSl6xymo8jJKuLlD1YqRmsl6GueJgAmr6jiLkgjBgxu7C+cLPMpKeupka1H8iFeYfIXaTLgAGXST/SxAnWctIzzGyN39Rc43S3Jcbn6Oju3izg4Gnh5oJN8tH24zza66q5etf86Q8WpihKCxSOhqleGi0BuQhp4e7vgWUca3D/+1IoRhkbGdQRYmwmAMaZLZMA+/8kXkwEcMsTYuCXaKGcIcSpoWQQ3ayWYLBJlrgAYVSIulzZPeyHF89bKmToMdISqUCnDoJaOwTnAtlvOZya+icmokW/adVZpoY7iE6hZryJMMf2qUG/VaqF8mpeINI4qeXrsaRI5iepepiiRF2gTu2w6xWo9vKpyUzBaN4JGDVk0LAHozZJ6Nk3D2CBd0gCeqSSPRNISZWkyqQ2uoHYBviX2MD/VcCwC38Naw7UA7+IebMl9igw/HnYT5wClEKlnpKON57egseXWagz279no4+iFaPl088dw8opXRXKsLG/bk3VvSrE2WVdD1PXMTQmqdEJ2tFY44+MBXEjiTlZdAAQAh+QQIKAAAACwAAAAAQABAAIEyPDlSSyQ3lG6Z5VAC/5yPJrsqCaNMb7SJ2dO4x+pl2nZFQDiBKEKOKgLEQ3ye6TFaqOsaNU4T0FaWXKjFk4xktk6Dc0QaP8IFQKhTFp8bXEaX9MGC1euL5YWi0Ty1zEeLlX83XC5574Les3icwZTSpte2pYDhl/jGR1HIsNUDUnJgo2hJByH1xCK1llB5aen0OOl5NhaaunNIBJEa2nrqOfF6OdOq9CgBWivahMtZKtb7KgY8S0lcm1yJu0lpoaya6Nz1KW0rRB2btXeFrTgXeGy9BR6uzehcNHzuB5h+fDiZ7h7kR274Um8fJw95ph8sYLpQCRSVS9C1gwhv/XKQqSAchomsPHSwr+ADM/8ULZ2SSItExz9ZqOw4wY+iFVmyXHEcKYcUo5YuxY2c4qVDDTkvb2q4SBPODIs+ceZEBPPSyog0VRJVaiUi0oNPQ2EBKosJVWkJXSbtteIrthA774kdqPNPyrP4Lhrsyfbbtl1q48b0h8nrvbUdbQ6hVdYMX77vUgFqCLhCzyqE6/JzgS+sDC535SoV/EfwWslNJKWr6niQXyKYFEcDECD1YTKfRfvrEzZt6gCDZse8M9fJaVozZs8e4TtA2RL8+thgqWZhjODMbUf2FtnOvJXlYBhH3Tz4X1fKwXDJk5VGdt/bPXQGj1758vGvdxgZZOjTdfHkUY9b0QNgIe7z7UcfjyWRaM8Ahl17xkRRioBB/WIgQewEIxoKbf3z4AEFAAA7";
const OW_WATER =
  "data:image/gif;base64,R0lGODdhQABAAHcAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEKAAAACwAAAAAQABAAIFbbuFjm/9fzeT///8C/4wNp8ttogSUrjqAk92HektxQZJpYgUF0pou07SYSpkhp8uuKqz2MDaKkWiyW0QyyPl6OyHwQKyJWszV4MraKR9RTbcIeimRSUE5J0hIojNi8EHFiXPJ6xmtBaSHUETploVmZld2t7ZCMwJkkthAleIhODiZo4ex9qcYo5kWIpelZUVoJqgXsieF8tERKclCOIrZKdaTyqAjGnAWivtah8RiuQqxiMI7iGXoSgYsCKdj+XYL41unLHkdjJe2o+f40gRLuiz4i7hcxeTSJCpO/k7OGvesZZ0Nj4/ueGyX7//exJGhfv8KbvPk4p7BhZDU3bpzRiFDgDiONZvIUJUrif8YJTn0sYyjQSzx4GixKJIhR1YWO5JL2QKSy3yxPDqcM3MjMoUPvuUMSWkXLZNHfmIjaajKvJ5G0RR6FQikz6btSP0i2OFjS6pVx+nQ+oxruaS4NIqlQ7DV1JcXO/ZrGbBo2HYwCxJdusTpTiszB9Rac/LWM1iE6wKEZgJvzJ2Ef9Z6wgFnY3MugaA6wbdQRMod/fABAZKMPb6dUaUCEwFOrFEk/wWc0AiysR5PDW9Jp8nS58gQ/CbzapeCGmJBvDRArWuvy03FkG/wrcL2h699ZiiSLc3YQtwMjHuR7dyA308ls1ooUsxPdvFrxyA0cgEKdlXsiBrBe57RBuo9I6dFw8/cE7bAB9oj5sXnWSMEhsESd+cluCBvob13AWRShBehMzwgaAMJEU4xF4UcfkggTiSe6EAcq6DIIogtvggWjDL2d0IBACH5BAgoAAAALAAAAABAAEAAgVtu4WOb/1/N5P///wL/jA2ny22iBJQNOgdyunzRf0zdlWhbcI7eI7WWGFooZ2Yq5+ZtIH42VqqlbgwdiGUxIRhC5UjGQw6Mnx2kiWjWHDKrVzKlug5bDVkoSHU9VV1YnCufNuZlhLfuUd/wHYpu96f2pRclNsDXJwFQFSiYQIGHV9iWgwimmMa4aDMElTaZJ3mIeLkp9qcJeMdjo3c05nbpwniaw/LjqTAUMVG5F0cFuVsUVYGU2eeqI0nE8sAzEJCYbBRqVWzc+6Jd7c08uhbO/UD9fQ4TEjOKjI7eXMHtPh8byVrvS/8NDRWv/+9HnR+ABI9dI9jHHDZ/CRHOghPjFxyF7igGPIiwYbJt/xkVlbIIrV1HYB8hdhvpUcCsN4bsRcqH0tLKW+qKpPwXhg/LJy+MWKxWSqXKKUS7kGsnEmVQoUeNgthTFGDOMZNWVPWVlKm+khdhiUTGdehWmkesMnOD6ae3qn8MUgXL9JLaPlXnXICJpFyLpfpaOekgEQLfh/PwYMFhLKi0sHMV0anzBFG5xdNyNkYFitPfu5GkTViM6V+UOXV4bTNQiiO9XXQWZeGsEnW0A5epwKuFKwgOe7Lb1S6kbcYqZ9JQJ8JI9mmDEs448EH+Ml/I5Y+an5zLZvoC5oKI3Sg+bW9PfvFqzmB9vu1dBeDZeO33UgVp0yHbt7/KT9w6Zz+EM1woTtQUd8DA2zPG9ENdaf0Fdx87wa3wVoHbnXHYApL1cgMlb9GQRScO3IcgYgRKuF1/pVn3BHIdpMAcfSgeA1OI1L3Y3EB50YjjbgeSmGOP47HSY5CGCElkhs4UAAA7";

const BATTLE_BG =
  "data:image/png;base64,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";

const ISO_ANGLE = 55; // degrees of tilt for 2.5D perspective
const ISO_SCALE = 0.82;

const OverworldTile: React.FC<{
  type: number;
  x: number;
  y: number;
  animFrame: number;
  isDesert?: boolean;
}> = ({ type, x, y, animFrame, isDesert }) => {
  const base: React.CSSProperties = {
    position: "absolute",
    left: x * OW_TILE,
    top: y * OW_TILE,
    width: OW_TILE,
    height: OW_TILE,
    imageRendering: "pixelated",
    overflow: "visible",
    zIndex: type === TL.TREE || type === TL.ROCK ? y + 1 : 0,
    filter: isDesert
      ? "sepia(80%) saturate(200%) hue-rotate(-10deg) brightness(1.1)"
      : "none",
    transformStyle: "preserve-3d",
  };
  const img = (src: string, style?: React.CSSProperties) => (
    <img
      src={src}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
        display: "block",
        ...style,
      }}
    />
  );

  // Billboard style: counter-rotate to face camera so sprites aren't squished
  const billboard: React.CSSProperties = {
    transform: `rotateX(-${ISO_ANGLE}deg)`,
    transformOrigin: "bottom center",
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
  };

  // Elevated object (trees, rocks) - stands up from ground
  const elevated = (src: string, height: number, shadowOpacity = 0.25) => (
    <div style={base}>
      {img(OW_GRASS)}
      {/* Shadow on ground */}
      <div
        style={{
          position: "absolute",
          bottom: 2,
          left: "15%",
          width: "70%",
          height: "30%",
          borderRadius: "50%",
          background: `rgba(0,0,0,${shadowOpacity})`,
          filter: "blur(3px)",
        }}
      />
      {/* Elevated sprite billboarded toward camera */}
      <div
        style={{
          ...billboard,
          height: OW_TILE + height,
          bottom: 0,
        }}
      >
        {img(src, { height: "100%", width: "100%" })}
      </div>
    </div>
  );

  switch (type) {
    case TL.GRASS:
      return <div style={base}>{img(OW_GRASS)}</div>;
    case TL.TALL_GRASS:
      return (
        <div style={base}>
          {img(OW_TALL_GRASS)}
          {/* Animated grass blades effect */}
          <div
            style={{
              ...billboard,
              height: OW_TILE + 6,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 3,
                fontSize: 8,
                color: "#ff6b35",
                fontWeight: "bold",
                fontFamily: "'Courier New', monospace",
                textShadow: "0 0 4px rgba(255,107,53,0.6)",
                animation: "blink 1.5s infinite",
              }}
            >
              !
            </div>
          </div>
        </div>
      );
    case TL.WATER: {
      const shimmer =
        Math.sin(animFrame * 0.15 + x * 0.5 + y * 0.3) * 0.08 + 0.92;
      return (
        <div style={{ ...base, opacity: shimmer }}>
          {img(OW_WATER)}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(${
                135 + animFrame * 2
              }deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)`,
              pointerEvents: "none",
            }}
          />
        </div>
      );
    }
    case TL.TREE:
      return elevated(OW_TREE, 20, 0.3);
    case TL.FLOWER:
      return (
        <div style={base}>
          {img((x + y) % 2 === 0 ? OW_FLOWER : OW_FLOWER_WHITE)}
        </div>
      );
    case TL.ROCK:
    case TL.ROCK:
      return <div style={base}>{img(OW_ROCK)}</div>;
  }
};

// ════════════════════════════════════════════════════════════
// LOADOUT SCREEN
// ════════════════════════════════════════════════════════════

const LoadoutScreen: React.FC<{
  character: Character;
  selectedMoves: string[];
  onToggleMove: (n: string) => void;
  onClose: () => void;
}> = ({ character, selectedMoves, onToggleMove, onClose }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.85)",
      zIndex: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
    }}
  >
    <div
      style={{
        background: "#e3decb",
        border: "4px solid #080808",
        padding: "2rem",
        width: 800,
        maxHeight: "85vh",
        overflow: "auto",
        boxShadow: "16px 16px 0 rgba(0,0,0,0.3)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #080808",
          paddingBottom: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "Impact, sans-serif",
              fontSize: "2.5rem",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "-1px",
            }}
          >
            LOADOUT
          </h2>
          <span
            style={{ fontSize: "0.7rem", opacity: 0.6, letterSpacing: "2px" }}
          >
            {character.emoji} {character.name.toUpperCase()} // SELECT UP TO{" "}
            {MAX_DECK_SIZE} CARDS
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "Impact, sans-serif",
              fontSize: "2rem",
              color:
                selectedMoves.length === MAX_DECK_SIZE ? "#4d9a2a" : "#080808",
            }}
          >
            {selectedMoves.length}/{MAX_DECK_SIZE}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#080808",
              color: "#e3decb",
              border: "none",
              padding: "0.5rem 1.5rem",
              cursor: "pointer",
              fontFamily: "Impact, sans-serif",
              fontSize: "1rem",
              letterSpacing: "2px",
              marginTop: "0.5rem",
            }}
          >
            CLOSE [P]
          </button>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
        }}
      >
        {[...character.moves, CATCH_MOVE].map((move) => {
          const isSel = selectedMoves.includes(move.name);
          const canAdd = selectedMoves.length < MAX_DECK_SIZE;
          const isCatch = move.name === "catch";
          return (
            <div
              key={move.name}
              onClick={() => {
                if (isSel || canAdd) onToggleMove(move.name);
              }}
              style={{
                background: isSel ? "#d4e8c2" : isCatch ? "#e8e0f0" : "white",
                border: `2px solid ${
                  isSel ? "#4d9a2a" : isCatch ? "#6644aa" : "#080808"
                }`,
                padding: "0.75rem",
                cursor: isSel || canAdd ? "pointer" : "not-allowed",
                opacity: !isSel && !canAdd ? 0.4 : 1,
                transition: "all 0.1s",
                position: "relative",
                boxShadow: isSel
                  ? "4px 4px 0 rgba(77,154,42,0.3)"
                  : isCatch
                  ? "4px 4px 0 rgba(102,68,170,0.2)"
                  : "4px 4px 0 rgba(0,0,0,0.1)",
              }}
            >
              {isSel && (
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 6,
                    fontSize: "0.7rem",
                    color: "#4d9a2a",
                    fontWeight: "bold",
                  }}
                >
                  ✓
                </div>
              )}
              {isCatch && (
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    left: 6,
                    fontSize: "0.6rem",
                    color: "#6644aa",
                    fontWeight: "bold",
                  }}
                >
                  🪤
                </div>
              )}
              <div
                style={{
                  width: "100%",
                  height: 36,
                  background: isCatch ? "#3a2266" : "#1a1a1a",
                  marginBottom: "0.4rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "1.2rem",
                    color: "#d4d0c8",
                  }}
                >
                  {move.manaCost}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "Impact, sans-serif",
                  fontSize: "0.9rem",
                  textTransform: "uppercase",
                  marginBottom: "0.3rem",
                  color: isCatch ? "#6644aa" : "#080808",
                }}
              >
                {move.name}
              </div>
              <div
                style={{ fontSize: "0.6rem", lineHeight: "1.3", opacity: 0.7 }}
              >
                {move.description}
              </div>
              <div
                style={{
                  fontSize: "0.55rem",
                  borderTop: "1px solid #ccc",
                  paddingTop: "0.3rem",
                  marginTop: "0.3rem",
                  opacity: 0.5,
                }}
              >
                {isCatch ? "UNIVERSAL CARD" : `COST: ${move.manaCost} MANA`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════
// BATTLE COMPONENT
// ════════════════════════════════════════════════════════════

const BattleScreen: React.FC<{
  selectedCharacter: Character;
  persistentHP: number;
  activeDeck: Move[];
  onBattleEnd: (result: "win" | "lose", remainingHP: number) => void;
  onCatchMonster: (monsterName: string) => void;
  caughtMonsterNames: string[];
  upgrades: Upgrades;
  trainerWave?: EnemyDef[];
}> = ({
  selectedCharacter,
  persistentHP,
  activeDeck,
  onBattleEnd,
  onCatchMonster,
  caughtMonsterNames,
  upgrades,
  trainerWave,
}) => {
  const sequential = !!trainerWave;
  const [enemyWave] = useState<EnemyDef[]>(
    () => trainerWave || generateEnemyWave()
  );
  const [waveIdx, setWaveIdx] = useState(0);
  const waveTransitioning = useRef(false);
  const currentEnemy = enemyWave[sequential ? waveIdx : 0];
  const currentEnemy2 = sequential
    ? null
    : enemyWave.length > 1
    ? enemyWave[1]
    : null;
  const [playerPos, setPlayerPos] = useState<Position>({ x: 3, y: 1 });
  const [opponentPos, setOpponentPos] = useState<Position>({ x: 0, y: 1 });
  const [playerHP, setPlayerHP] = useState(persistentHP);
  const [opponentHP, setOpponentHP] = useState(enemyWave[0].hp);
  const [opponentMaxHP, setOpponentMaxHP] = useState(enemyWave[0].hp);
  // Second enemy (if present)
  const [opponent2Pos, setOpponent2Pos] = useState<Position>({
    x: Math.floor(Math.random() * GRID_SIZE),
    y: Math.floor(Math.random() * GRID_SIZE),
  });
  const [opponent2HP, setOpponent2HP] = useState(currentEnemy2?.hp ?? 0);
  const [opponent2MaxHP] = useState(currentEnemy2?.hp ?? 0);
  const [opponent2Stunned, setOpponent2Stunned] = useState(0);
  const [playerBullets, setPlayerBullets] = useState<Bullet[]>([]);
  const [opponentBullets, setOpponentBullets] = useState<Bullet[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [turrets, setTurrets] = useState<Turret[]>([]);
  const [beams, setBeams] = useState<Beam[]>([]);
  const [punch, setPunch] = useState<TimedEffect | null>(null);
  const [slash, setSlash] = useState<TimedEffect[]>([]);
  const [bombs, setBombs] = useState<Bomb[]>([]);
  const [delayBombs, setDelayBombs] = useState<DelayBomb[]>([]);
  const [tractorBeam, setTractorBeam] = useState<Beam | null>(null);
  const [boomerang, setBoomerang] = useState<Boomerang | null>(null);
  const [lasso, setLasso] = useState<TimedEffect | null>(null);
  const [opponentStunned, setOpponentStunned] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [tickCount, setTickCount] = useState(0);
  const [playerMana, setPlayerMana] = useState(5);
  const [hand, setHand] = useState<Move[]>([]);
  const [deck, setDeck] = useState<Move[]>([...activeDeck]);
  const [explosionEffects, setExplosionEffects] = useState<TimedEffect[]>([]);
  const [chargeTime, setChargeTime] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [malipoleFrenzyActive, setMalipoleFrenzyActive] = useState(false);
  const [malipoleFrenzyTimer, setMalipoleFrenzyTimer] = useState(0);
  const [malipoleBulletHits, setMalipoleBulletHits] = useState(0);
  const [tongueWhipActive, setTongueWhipActive] = useState<TimedEffect | null>(
    null
  );
  const [lilyPadTraps, setLilyPadTraps] = useState<TimedEffect[]>([]);
  const [thornShieldActive, setThornShieldActive] = useState(false);
  const [poisonDotTimer, setPoisonDotTimer] = useState(0);
  const [catchAnim, setCatchAnim] = useState<
    null | "attempting" | "success" | "fail" | "toostrong" | "already"
  >(null);
  const [catchTimer, setCatchTimer] = useState(0);
  const [silenceTimer, setSilenceTimer] = useState(0);
  const [playerFrozenTimer, setPlayerFrozenTimer] = useState(0);
  const [zoneStealTimer, setZoneStealTimer] = useState(0);
  const [zoneStealOwner, setZoneStealOwner] = useState<
    "player" | "enemy" | null
  >(null);
  const [zoneStealCol, setZoneStealCol] = useState(-1);
  const [absorbPoisonTimer, setAbsorbPoisonTimer] = useState(0);
  const [enemySilenceTimer, setEnemySilenceTimer] = useState(0);
  const [giantStrikeCooldown, setGiantStrikeCooldown] = useState(0);
  const [manaBoostTimer, setManaBoostTimer] = useState(0);
  const [enemyMana, setEnemyMana] = useState(5);
  const [enemyBuffTimer, setEnemyBuffTimer] = useState(0);
  const [enemyDotTimer, setEnemyDotTimer] = useState(0); // DOT damage on player from enemy cards
  const [enemyCardMsg, setEnemyCardMsg] = useState(""); // Shows what card enemy just used
  const [playerAnimState, setPlayerAnimState] = useState<
    "idle" | "attack" | "attack2" | "hit"
  >("idle");
  const [opponentAnimState, setOpponentAnimState] = useState<
    "idle" | "attack" | "attack2" | "hit"
  >("idle");
  const [opponent2AnimState, setOpponent2AnimState] = useState<
    "idle" | "attack" | "attack2" | "hit"
  >("idle");
  const playerAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponent2AnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPlayerAnim = useCallback(
    (state: "attack" | "attack2" | "hit", durationMs = 500) => {
      setPlayerAnimState(state);
      if (playerAnimTimer.current) clearTimeout(playerAnimTimer.current);
      playerAnimTimer.current = setTimeout(
        () => setPlayerAnimState("idle"),
        durationMs
      );
    },
    []
  );

  const triggerOpponentAnim = useCallback(
    (state: "attack" | "attack2" | "hit", durationMs = 400) => {
      setOpponentAnimState(state);
      if (opponentAnimTimer.current) clearTimeout(opponentAnimTimer.current);
      opponentAnimTimer.current = setTimeout(
        () => setOpponentAnimState("idle"),
        durationMs
      );
    },
    []
  );
  const triggerOpponent2Anim = useCallback(
    (state: "attack" | "attack2" | "hit", durationMs = 400) => {
      setOpponent2AnimState(state);
      if (opponent2AnimTimer.current) clearTimeout(opponent2AnimTimer.current);
      opponent2AnimTimer.current = setTimeout(
        () => setOpponent2AnimState("idle"),
        durationMs
      );
    },
    []
  );

  // Upgrade helpers
  const baseBulletDmg = 2 + upgrades.bulletDmg;
  const cardBonus = useCallback(
    (name: string) => (upgrades.cardBonuses[name] || 0) * 3,
    [upgrades]
  );
  const dotBonus = useCallback(
    (name: string) => upgrades.cardBonuses[name] || 0,
    [upgrades]
  );

  const battleEndRef = useRef(false);
  const playerHPRef = useRef(persistentHP);
  const opponentPosRef = useRef(opponentPos);
  const prevOpponentPosRef = useRef(opponentPos);
  const opponent2PosRef = useRef(opponent2Pos);
  const prevOpponent2PosRef = useRef(opponent2Pos);
  const playerPosRef = useRef(playerPos);
  useEffect(() => {
    playerHPRef.current = playerHP;
  }, [playerHP]);
  useEffect(() => {
    playerPosRef.current = playerPos;
  }, [playerPos]);
  useEffect(() => {
    opponentPosRef.current = opponentPos;
  }, [opponentPos]);
  useEffect(() => {
    opponent2PosRef.current = opponent2Pos;
  }, [opponent2Pos]);

  // ── DUAL ENEMY HELPERS ──
  const nearestEnemyPos = useCallback((): Position => {
    const a1 = opponentHP > 0;
    const a2 = currentEnemy2 && opponent2HP > 0;
    if (a1 && a2)
      return opponentPos.x >= opponent2Pos.x ? opponent2Pos : opponentPos;
    if (a1) return opponentPos;
    if (a2) return opponent2Pos;
    return opponentPos;
  }, [opponentHP, opponent2HP, opponentPos, opponent2Pos, currentEnemy2]);

  // Returns 0 for enemy1, 1 for enemy2, -1 for no hit
  const findHitEnemy = useCallback(
    (x: number, y: number): number => {
      if (
        opponentHP > 0 &&
        opponentPosRef.current.x === x &&
        opponentPosRef.current.y === y
      )
        return 0;
      if (
        currentEnemy2 &&
        opponent2HP > 0 &&
        opponent2PosRef.current.x === x &&
        opponent2PosRef.current.y === y
      )
        return 1;
      return -1;
    },
    [opponentHP, opponent2HP, currentEnemy2]
  );

  const dmgEnemy = useCallback(
    (slot: number, dmg: number) => {
      if (slot === 0) {
        setOpponentHP((p) => Math.max(0, p - dmg));
        triggerOpponentAnim("hit", 350);
      } else {
        setOpponent2HP((p) => Math.max(0, p - dmg));
        triggerOpponent2Anim("hit", 350);
      }
    },
    [triggerOpponentAnim, triggerOpponent2Anim]
  );

  const dmgEnemySilent = useCallback((slot: number, dmg: number) => {
    if (slot === 0) setOpponentHP((p) => Math.max(0, p - dmg));
    else setOpponent2HP((p) => Math.max(0, p - dmg));
  }, []);

  const stunEnemySlot = useCallback((slot: number, ticks: number) => {
    if (slot === 0) setOpponentStunned(ticks);
    else setOpponent2Stunned(ticks);
  }, []);

  // Check hit against all enemies using refs (for game loop)
  const findHitEnemyRef = (x: number, y: number): number => {
    if (
      opponentHP > 0 &&
      opponentPosRef.current.x === x &&
      opponentPosRef.current.y === y
    )
      return 0;
    if (
      currentEnemy2 &&
      opponent2HP > 0 &&
      opponent2PosRef.current.x === x &&
      opponent2PosRef.current.y === y
    )
      return 1;
    return -1;
  };

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      if (gameOver) return;
      if (playerFrozenTimer > 0) return;
      // Zone steal movement bounds
      const minX =
        zoneStealOwner === "player" && zoneStealTimer > 0
          ? -1
          : zoneStealOwner === "enemy" && zoneStealTimer > 0
          ? 1
          : 0;
      setPlayerPos((p) => ({
        x: Math.max(minX, Math.min(GRID_SIZE - 1, p.x + dx)),
        y: Math.max(0, Math.min(GRID_SIZE - 1, p.y + dy)),
      }));
    },
    [gameOver, playerFrozenTimer, zoneStealOwner, zoneStealTimer]
  );

  const fireBullet = useCallback(
    (isPlayer: boolean) => {
      if (gameOver) return;
      if (isPlayer) {
        if (selectedCharacter.name === "Malipole") {
          if (isCharging) {
            if (playerBullets.length >= MAX_SHOTS) return;
            const cl = Math.min(3, Math.floor(chargeTime / 10));
            if (cl > 0)
              setPlayerBullets((p) => [
                ...p,
                {
                  x: playerPos.x + GRID_SIZE - 1,
                  y: playerPos.y,
                  direction: "left",
                  chargePower: cl,
                },
              ]);
            setChargeTime(0);
            setIsCharging(false);
          } else setIsCharging(true);
          return;
        } else if (selectedCharacter.name === "Rat King") {
          if (isCharging) {
            if (chargeTime >= 30 && playerBullets.length < MAX_SHOTS - 1) {
              setPlayerBullets((p) => [
                ...p,
                {
                  x: playerPos.x + GRID_SIZE - 1,
                  y: playerPos.y,
                  direction: "left",
                  isVRat: true,
                  vDir: -1,
                },
                {
                  x: playerPos.x + GRID_SIZE - 1,
                  y: playerPos.y,
                  direction: "left",
                  isVRat: true,
                  vDir: 1,
                },
              ]);
            }
            setChargeTime(0);
            setIsCharging(false);
          } else setIsCharging(true);
          return;
        } else if (selectedCharacter.name === "Giant") {
          // Giant Strike: melee hit 2 tiles ahead, 25 DMG, 4s cooldown
          if (giantStrikeCooldown > 0) return;
          setGiantStrikeCooldown(80); // 4 seconds at 50ms tick
          const gsX =
            playerPos.x <= 1
              ? GRID_SIZE - 2 + playerPos.x
              : playerPos.x - 2 + GRID_SIZE;
          setExplosionEffects((p) => [
            ...p,
            { x: gsX, y: playerPos.y, ttl: 5, effectType: "explosion" },
          ]);
          const gsHit = findHitEnemyRef(gsX, playerPos.y);
          if (gsHit >= 0) {
            dmgEnemy(gsHit, 25);
          }
          triggerPlayerAnim("attack", 400);
          return;
        } else if (selectedCharacter.name === "Mushroom") {
          // Mushroom: charge 3s then spawn turret
          if (isCharging) {
            if (chargeTime >= 60) {
              // Spawn mushroom turret 1 tile ahead
              const stX = playerPos.x + GRID_SIZE - 1;
              setTurrets((p) => [
                ...p,
                {
                  x: stX,
                  y: playerPos.y,
                  hp: 8,
                  owner: "player",
                  shootTimer: 0,
                  isMushroom: true,
                  moveTimer: 0,
                },
              ]);
              setExplosionEffects((p) => [
                ...p,
                { x: stX, y: playerPos.y, ttl: 6, effectType: "chorus" },
              ]);
              triggerPlayerAnim("attack", 400);
            }
            setChargeTime(0);
            setIsCharging(false);
          } else setIsCharging(true);
          return;
        } else if (selectedCharacter.name === "Hogglin") {
          if (blocks.length >= MAX_SHOTS) return;
          setBlocks((p) => [
            ...p,
            { x: playerPos.x + GRID_SIZE - 1, y: playerPos.y, health: 2 },
          ]);
        } else {
          if (playerBullets.length >= MAX_SHOTS) return;
          setPlayerBullets((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE - 1,
              y: playerPos.y,
              direction: "left",
            },
          ]);
          triggerPlayerAnim("attack", 400);
        }
      } else {
        // Enemy basic fire
        if (currentEnemy?.type === "giant") {
          // Giant enemy: melee hit 2 tiles ahead (toward player)
          const egsX = opponentPos.x + 2;
          if (egsX < GRID_SIZE * 2) {
            setExplosionEffects((p) => [
              ...p,
              { x: egsX, y: opponentPos.y, ttl: 5, effectType: "explosion" },
            ]);
            if (
              egsX === playerPosRef.current.x + GRID_SIZE &&
              opponentPos.y === playerPosRef.current.y
            ) {
              setPlayerHP((h) => Math.max(0, h - 25));
            }
          }
          triggerOpponentAnim("attack", 500);
          return;
        }
        if (currentEnemy?.type === "mushroom") {
          // Mushroom enemy: spawn turret at current pos + 1
          const estX = opponentPos.x + 1;
          if (estX < GRID_SIZE * 2) {
            setTurrets((p) => [
              ...p,
              {
                x: estX,
                y: opponentPos.y,
                hp: 8,
                owner: "enemy",
                shootTimer: 0,
                isMushroom: true,
                moveTimer: 0,
              },
            ]);
          }
          triggerOpponentAnim("attack", 500);
          return;
        }
        if (opponentBullets.length >= MAX_SHOTS) return;
        setOpponentBullets((p) => [
          ...p,
          { x: opponentPos.x, y: opponentPos.y, direction: "right" },
        ]);
        triggerOpponentAnim("attack", 500);
      }
    },
    [
      gameOver,
      playerBullets,
      opponentBullets,
      playerPos,
      opponentPos,
      selectedCharacter,
      blocks,
      isCharging,
      chargeTime,
      triggerOpponentAnim,
      triggerPlayerAnim,
      giantStrikeCooldown,
      currentEnemy,
    ]
  );

  const fireEnemy2Bullet = useCallback(() => {
    if (
      gameOver ||
      !currentEnemy2 ||
      opponent2HP <= 0 ||
      opponentBullets.length >= MAX_SHOTS ||
      silenceTimer > 0
    )
      return;
    setOpponentBullets((p) => [
      ...p,
      { x: opponent2Pos.x, y: opponent2Pos.y, direction: "right" },
    ]);
    triggerOpponent2Anim("attack", 500);
  }, [
    gameOver,
    currentEnemy2,
    opponent2HP,
    opponentBullets,
    opponent2Pos,
    silenceTimer,
    triggerOpponent2Anim,
  ]);

  const useMove = useCallback(
    (moveName: string) => {
      if (gameOver) return;
      if (enemySilenceTimer > 0) return; // Silenced by enemy
      const move = hand.find((m) => m.name === moveName);
      if (!move || playerMana < move.manaCost) return;
      setPlayerMana((p) => p - move.manaCost);
      setHand((p) => p.filter((m) => m !== move));
      // Boomerang returns to hand on catch, so don't add it back to deck
      if (moveName !== "boomerang") setDeck((p) => [...p, move]);

      // Trigger player attack sprite animation (alternate attack/attack2)
      if (
        moveName !== "catch" &&
        moveName !== "tunnel" &&
        moveName !== "bounce" &&
        moveName !== "scavenge"
      ) {
        triggerPlayerAnim(Math.random() > 0.5 ? "attack" : "attack2", 600);
      }

      // ── CATCH CARD ──
      if (moveName === "catch") {
        // Determine which enemy to catch (nearest alive)
        const cNep = nearestEnemyPos();
        const catchSlot =
          opponentHP > 0 && cNep.x === opponentPos.x && cNep.y === opponentPos.y
            ? 0
            : 1;
        const catchTarget = catchSlot === 0 ? currentEnemy : currentEnemy2;
        const catchHP = catchSlot === 0 ? opponentHP : opponent2HP;
        if (!catchTarget) return;
        const monsterName =
          catchTarget.type.charAt(0).toUpperCase() + catchTarget.type.slice(1);
        if (caughtMonsterNames.includes(monsterName)) {
          setCatchAnim("already");
          setCatchTimer(40);
          return;
        }
        if (catchHP > 20) {
          setCatchAnim("toostrong");
          setCatchTimer(40);
          return;
        }
        setCatchAnim("attempting");
        setCatchTimer(60);
        const chance = 0.9 - (catchHP - 1) * (0.5 / 19);
        setTimeout(() => {
          if (Math.random() < chance) {
            setCatchAnim("success");
            setCatchTimer(80);
            onCatchMonster(monsterName);
            // Kill the caught enemy
            if (catchSlot === 0) setOpponentHP(0);
            else setOpponent2HP(0);
            setTimeout(() => {
              setCatchAnim(null);
            }, 2000);
          } else {
            setCatchAnim("fail");
            setCatchTimer(40);
          }
        }, 1500);
        return;
      }

      // ── MALIPOLE MOVES ──
      if (selectedCharacter.name === "Malipole") {
        switch (moveName) {
          case "tongue whip": {
            const wx = playerPos.x + GRID_SIZE - 3;
            setTongueWhipActive({
              x: wx,
              y: playerPos.y,
              ttl: 2,
              effectType: "tonguewhip",
            });
            if (
              opponentHP > 0 &&
              opponentPos.x <= wx &&
              opponentPos.y === playerPos.y
            ) {
              setOpponentHP((p) => Math.max(0, p - 15));
              setOpponentStunned(20);
            }
            if (
              currentEnemy2 &&
              opponent2HP > 0 &&
              opponent2Pos.x <= wx &&
              opponent2Pos.y === playerPos.y
            ) {
              setOpponent2HP((p) => Math.max(0, p - 15));
              setOpponent2Stunned(20);
            }
            break;
          }
          case "random hop": {
            const nep = nearestEnemyPos();
            const hopSlot =
              opponentHP > 0 &&
              nep.x === opponentPos.x &&
              nep.y === opponentPos.y
                ? 0
                : 1;
            dmgEnemySilent(hopSlot, 5);
            const rx = Math.floor(Math.random() * GRID_SIZE),
              ry = Math.floor(Math.random() * GRID_SIZE);
            setExplosionEffects((p) => [
              ...p,
              { x: nep.x, y: nep.y, ttl: 5, effectType: "teleport" },
              { x: rx, y: ry, ttl: 5, effectType: "teleport" },
            ]);
            const hopPos = { x: rx, y: ry };
            if (hopSlot === 0) {
              setOpponentPos(hopPos);
              opponentPosRef.current = hopPos;
            } else {
              setOpponent2Pos(hopPos);
              opponent2PosRef.current = hopPos;
            }
            break;
          }
          case "frog chorus": {
            setMalipoleFrenzyActive(true);
            setMalipoleFrenzyTimer(50);
            const ce: TimedEffect[] = [];
            for (let i = 0; i < GRID_SIZE; i++)
              ce.push({
                x: i,
                y: Math.floor(Math.random() * GRID_SIZE),
                ttl: 10,
                effectType: "chorus",
              });
            setExplosionEffects((p) => [...p, ...ce]);
            break;
          }
          case "lily pad trap": {
            const spots = [
              { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) },
              { x: 1, y: 1 },
              { x: 1, y: GRID_SIZE - 2 },
              { x: GRID_SIZE - 2, y: 1 },
              { x: GRID_SIZE - 2, y: GRID_SIZE - 2 },
            ];
            const sel = spots.sort(() => Math.random() - 0.5).slice(0, 2);
            setLilyPadTraps((p) => [
              ...p,
              ...sel.map((s) => ({
                x: s.x,
                y: s.y,
                ttl: 100,
                effectType: "lilypad" as const,
              })),
            ]);
            break;
          }
          // Mud slap: melee 1 tile ahead, 35 DMG + stun
          case "mud slap": {
            const meleeX =
              playerPos.x === 0 ? GRID_SIZE - 1 : playerPos.x - 1 + GRID_SIZE;
            setExplosionEffects((p) => [
              ...p,
              { x: meleeX, y: playerPos.y, ttl: 4, effectType: "explosion" },
            ]);
            {
              const msHit = findHitEnemy(meleeX, playerPos.y);
              if (msHit >= 0) {
                dmgEnemy(msHit, 35);
                stunEnemySlot(msHit, 10);
              }
            }
            break;
          }
          // Croak blast: sweeping beam like flying sword with delay between tiles
          case "croak blast": {
            // Spawn at right edge of opponent grid, moves left 1 tile every 3 ticks
            setExplosionEffects((p) => [
              ...p,
              {
                x: GRID_SIZE,
                y: playerPos.y,
                ttl: GRID_SIZE * 3 + 1,
                effectType: "croakbeam",
              },
            ]);
            break;
          }
          // Spawn tadpole: zigzag motion across field, despawns at back wall
          case "spawn tadpole": {
            setExplosionEffects((p) => [
              ...p,
              {
                x: GRID_SIZE,
                y: playerPos.y,
                ttl: GRID_SIZE * 3 + 1,
                effectType: "tadpole",
              },
            ]);
            break;
          }
          // Absorb: heal 20 HP if enemy stunned or poisoned (same as slime)
          case "absorb": {
            if (
              opponentStunned > 0 ||
              opponent2Stunned > 0 ||
              poisonDotTimer > 0
            ) {
              setPlayerHP((p) => Math.min(100, p + 20));
              setExplosionEffects((p) => [
                ...p,
                {
                  x: playerPos.x + GRID_SIZE,
                  y: playerPos.y,
                  ttl: 8,
                  effectType: "chorus",
                },
              ]);
            } else {
              setPlayerMana((p) => Math.min(p + 1, MAX_MANA));
              setExplosionEffects((p) => [
                ...p,
                {
                  x: playerPos.x + GRID_SIZE,
                  y: playerPos.y,
                  ttl: 3,
                  effectType: "explosion",
                },
              ]);
            }
            break;
          }
          // Novice casts: 2 tiles ahead become random frozen/poison/broken
          case "novice casts": {
            const nc1 = GRID_SIZE - 1,
              nc2 = GRID_SIZE - 2; // 2 enemy tiles closest to player
            [nc1, nc2].forEach((tx) => {
              const roll = Math.random();
              let etype: "frozentile" | "poisononly" | "brokentile";
              if (roll < 0.33) etype = "frozentile";
              else if (roll < 0.66) etype = "poisononly";
              else etype = "brokentile";
              setLilyPadTraps((p) => [
                ...p,
                { x: tx, y: playerPos.y, ttl: 120, effectType: etype },
              ]);
            });
            setExplosionEffects((p) => [
              ...p,
              { x: nc1, y: playerPos.y, ttl: 5, effectType: "explosion" },
              { x: nc2, y: playerPos.y, ttl: 5, effectType: "explosion" },
            ]);
            break;
          }
        }
        return;
      }

      // ── ALL OTHER MOVES ──
      switch (moveName) {
        case "beam":
          setBeams((p) => [
            ...p,
            { x: playerPos.x, y: playerPos.y, direction: "left", ttl: 1 },
          ]);
          break;
        case "punch": {
          const px =
            playerPos.x === 0 ? GRID_SIZE - 1 : playerPos.x - 1 + GRID_SIZE;
          setPunch({ x: px, y: playerPos.y, ttl: 1 });
          break;
        }
        case "slash": {
          const bx =
            playerPos.x === 0 ? GRID_SIZE - 1 : playerPos.x - 1 + GRID_SIZE;
          setSlash(
            [
              { x: bx, y: playerPos.y - 1, ttl: 1 },
              { x: bx, y: playerPos.y, ttl: 1 },
              { x: bx, y: playerPos.y + 1, ttl: 1 },
            ].filter((s) => s.y >= 0 && s.y < GRID_SIZE)
          );
          break;
        }
        case "bomb": {
          const bx2 =
            playerPos.x <= 1
              ? GRID_SIZE - 2 + playerPos.x
              : playerPos.x - 2 + GRID_SIZE;
          setBombs((p) => [...p, { x: bx2, y: playerPos.y }]);
          break;
        }
        case "tractor beam":
          setTractorBeam({
            x: playerPos.x + GRID_SIZE - 1,
            y: playerPos.y,
            direction: "left",
            ttl: 1,
          });
          break;
        case "delay bomb": {
          const dbx =
            playerPos.x <= 1
              ? GRID_SIZE - 2 + playerPos.x
              : playerPos.x - 2 + GRID_SIZE;
          setDelayBombs((p) => [
            ...p,
            { x: dbx, y: playerPos.y, timer: DELAY_BOMB_TIMER },
          ]);
          break;
        }
        case "boomerang":
          setBoomerang({
            x: playerPos.x + GRID_SIZE - 1,
            y: playerPos.y,
            phase: "forward",
            distanceTraveled: 0,
            ttl: 60,
          });
          break;
        case "lasso":
          setLasso({ x: playerPos.x + GRID_SIZE - 4, y: playerPos.y, ttl: 1 });
          break;
        case "leafstorm": {
          const lse: TimedEffect[] = [];
          for (let i = 0; i < GRID_SIZE; i++) {
            lse.push({
              x: i,
              y: playerPos.y,
              ttl: 15,
              effectType: "leafstorm",
            });
            if (
              opponentHP > 0 &&
              opponentPos.x === i &&
              opponentPos.y === playerPos.y
            ) {
              setOpponentHP((p) => Math.max(0, p - 20));
              setOpponentStunned(15);
            }
            if (
              currentEnemy2 &&
              opponent2HP > 0 &&
              opponent2Pos.x === i &&
              opponent2Pos.y === playerPos.y
            ) {
              setOpponent2HP((p) => Math.max(0, p - 20));
              setOpponent2Stunned(15);
            }
          }
          setExplosionEffects((p) => [...p, ...lse]);
          break;
        }
        case "flying sword": {
          const fsTarget = nearestEnemyPos();
          setExplosionEffects((p) => [
            ...p,
            {
              x: GRID_SIZE,
              y: fsTarget.y,
              ttl: GRID_SIZE * 2 + 1,
              effectType: "flyingsword",
              direction: "right",
            },
          ]);
          break;
        }
        case "clawingsword":
          setExplosionEffects((p) => [
            ...p,
            {
              x: -1,
              y: playerPos.y,
              ttl: GRID_SIZE * 2 + 1,
              effectType: "clawingsword",
              direction: "left",
            },
          ]);
          break;
        case "wall": {
          const wx = playerPos.x + GRID_SIZE - 2;
          for (let i = 0; i < GRID_SIZE; i++)
            setBlocks((p) => [...p, { x: wx, y: i, health: 1 }]);
          break;
        }
        case "rat pack": {
          const f1 = playerPos.x + GRID_SIZE - 1,
            f2 = playerPos.x + GRID_SIZE - 2;
          setExplosionEffects((p) => [
            ...p,
            { x: f1, y: playerPos.y, ttl: 3, effectType: "ratpack" },
            { x: f2, y: playerPos.y, ttl: 3, effectType: "ratpack" },
          ]);
          break;
        }
        case "trash toss":
          setExplosionEffects((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE - 4,
              y: playerPos.y,
              ttl: 20,
              effectType: "ratstorm",
            },
          ]);
          break;
        case "street swarm": {
          const se: TimedEffect[] = [];
          for (let i = 0; i < 4; i++) {
            const ry = Math.max(
              0,
              Math.min(GRID_SIZE - 1, Math.round(playerPos.y + (i - 1.5)))
            );
            se.push({
              x: playerPos.x + GRID_SIZE,
              y: ry,
              ttl: 50,
              effectType: "ratstorm",
            });
          }
          setExplosionEffects((p) => [...p, ...se]);
          break;
        }
        // Quickdraw: fast bullet at 2× speed, 25 DMG
        case "quickdraw": {
          setPlayerBullets((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE - 1,
              y: playerPos.y,
              direction: "left",
              isQuickdraw: true,
            },
          ]);
          break;
        }
        // Dust devil: AOE hits 4 adjacent tiles, 20 DMG
        case "dust devil": {
          const adj = [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
          ];
          adj.forEach((a) => {
            const ex = playerPos.x + a.dx + GRID_SIZE,
              ey = playerPos.y + a.dy;
            if (ey >= 0 && ey < GRID_SIZE && ex >= 0 && ex < GRID_SIZE * 2) {
              setExplosionEffects((p) => [
                ...p,
                { x: ex, y: ey, ttl: 5, effectType: "dustdevil" },
              ]);
              {
                const ddHit = findHitEnemy(ex, ey);
                if (ddHit >= 0) dmgEnemy(ddHit, 20);
              }
            }
          });
          break;
        }
        // Ricochet: bullet that bounces back in a straight line if it misses
        case "ricochet": {
          setPlayerBullets((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE - 1,
              y: playerPos.y,
              direction: "left",
              isRicochet: true,
              hasBounced: false,
            },
          ]);
          break;
        }
        // Thorn shield: activate, blocks next hit and fires thorn bullet dealing 30 DMG
        case "thorn shield":
          setThornShieldActive(true);
          break;
        // Vine snare: lay vine trap on random enemy tile, 10 DMG + long stun
        case "vine snare": {
          const rx = Math.floor(Math.random() * GRID_SIZE),
            ry = Math.floor(Math.random() * GRID_SIZE);
          setLilyPadTraps((p) => [
            ...p,
            { x: rx, y: ry, ttl: 150, effectType: "vinesnare" },
          ]);
          break;
        }
        // Spore cloud: 5 DMG/tick, lingers 4 seconds (40 ticks)
        case "spore cloud": {
          const scTarget = nearestEnemyPos();
          setExplosionEffects((p) => [
            ...p,
            { x: scTarget.x, y: scTarget.y, ttl: 40, effectType: "sporecloud" },
          ]);
          break;
        }
        // Plague bite: 20 DMG initial + 5 DMG/s poison DOT for 5 seconds
        case "plague bite": {
          let pbHit = false;
          // Only affect first 2 tiles in front of player
          const pbTile1 = playerPos.x + GRID_SIZE - 1;
          const pbTile2 = playerPos.x + GRID_SIZE - 2;
          if (
            opponentHP > 0 &&
            opponentPos.y === playerPos.y &&
            (opponentPos.x === pbTile1 || opponentPos.x === pbTile2)
          ) {
            setOpponentHP((p) => Math.max(0, p - 20));
            setExplosionEffects((p) => [
              ...p,
              {
                x: opponentPos.x,
                y: opponentPos.y,
                ttl: 4,
                effectType: "ratpack",
              },
            ]);
            pbHit = true;
          }
          if (
            currentEnemy2 &&
            opponent2HP > 0 &&
            opponent2Pos.y === playerPos.y &&
            (opponent2Pos.x === pbTile1 || opponent2Pos.x === pbTile2)
          ) {
            setOpponent2HP((p) => Math.max(0, p - 20));
            setExplosionEffects((p) => [
              ...p,
              {
                x: opponent2Pos.x,
                y: opponent2Pos.y,
                ttl: 4,
                effectType: "ratpack",
              },
            ]);
            pbHit = true;
          }
          // Show effect on the 2 tiles in front regardless
          setExplosionEffects((p) => [
            ...p,
            { x: pbTile1, y: playerPos.y, ttl: 4, effectType: "ratpack" },
            { x: pbTile2, y: playerPos.y, ttl: 4, effectType: "ratpack" },
          ]);
          if (pbHit) setPoisonDotTimer(50);
          break;
        }
        // Tunnel: teleport to random tile
        case "tunnel": {
          const rx = Math.floor(Math.random() * GRID_SIZE),
            ry = Math.floor(Math.random() * GRID_SIZE);
          setExplosionEffects((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE,
              y: playerPos.y,
              ttl: 3,
              effectType: "teleport",
            },
            { x: rx + GRID_SIZE, y: ry, ttl: 3, effectType: "teleport" },
          ]);
          setPlayerPos({ x: rx, y: ry });
          break;
        }
        // Scavenge: restore 3 mana
        case "scavenge":
          setPlayerMana((p) => Math.min(p + 3, MAX_MANA));
          break;
        // ── GRUNT MOVES ──
        case "plasma shot":
          setPlayerBullets((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE - 1,
              y: playerPos.y,
              direction: "left",
              isQuickdraw: true,
            },
          ]);
          break;
        case "shield bash": {
          const sbx =
            playerPos.x === 0 ? GRID_SIZE - 1 : playerPos.x - 1 + GRID_SIZE;
          setPunch({ x: sbx, y: playerPos.y, ttl: 1 });
          {
            const sbHit = findHitEnemy(sbx, playerPos.y);
            if (sbHit >= 0) stunEnemySlot(sbHit, 10);
          }
          break;
        }
        case "overcharge":
          setMalipoleFrenzyActive(true);
          setMalipoleFrenzyTimer(30);
          setExplosionEffects((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE,
              y: playerPos.y,
              ttl: 8,
              effectType: "chorus",
            },
          ]);
          break;
        case "emp blast": {
          [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
          ].forEach((a) => {
            const ex = playerPos.x + a.dx + GRID_SIZE,
              ey = playerPos.y + a.dy;
            if (ey >= 0 && ey < GRID_SIZE && ex >= 0 && ex < GRID_SIZE * 2) {
              setExplosionEffects((p) => [
                ...p,
                { x: ex, y: ey, ttl: 5, effectType: "explosion" },
              ]);
              {
                const empHit = findHitEnemy(ex, ey);
                if (empHit >= 0) {
                  dmgEnemy(empHit, 15);
                  stunEnemySlot(empHit, 15);
                }
              }
            }
          });
          // EMP clears all traps and lingering effects
          setLilyPadTraps([]);
          setExplosionEffects((p) =>
            p.filter((e) => e.effectType === "explosion")
          );
          break;
        }
        case "barrier": {
          const bwx = playerPos.x + GRID_SIZE - 2;
          for (let i = 0; i < GRID_SIZE; i++)
            setBlocks((p) => [...p, { x: bwx, y: i, health: 1 }]);
          break;
        }
        case "gravity well": {
          // Pull nearest enemy 2 tiles toward center of enemy grid (x=2, y=2)
          const gwCenter = {
            x: Math.floor(GRID_SIZE / 2),
            y: Math.floor(GRID_SIZE / 2),
          };
          const gNep = nearestEnemyPos();
          const gSlot = findHitEnemy(gNep.x, gNep.y);
          if (gSlot >= 0) {
            dmgEnemy(gSlot, 10 + cardBonus("gravity well"));
            const gRef = gSlot === 0 ? opponentPosRef : opponent2PosRef;
            const gx = gRef.current.x,
              gy = gRef.current.y;
            const dx = gwCenter.x - gx,
              dy = gwCenter.y - gy;
            const mx =
              dx === 0 ? 0 : dx > 0 ? Math.min(2, dx) : Math.max(-2, dx);
            const my =
              dy === 0 ? 0 : dy > 0 ? Math.min(2, dy) : Math.max(-2, dy);
            const gwPos = {
              x: Math.max(0, Math.min(GRID_SIZE - 1, gx + mx)),
              y: Math.max(0, Math.min(GRID_SIZE - 1, gy + my)),
            };
            if (!blocks.some((bl) => bl.x === gwPos.x && bl.y === gwPos.y)) {
              if (gSlot === 0) {
                setOpponentPos(gwPos);
                opponentPosRef.current = gwPos;
              } else {
                setOpponent2Pos(gwPos);
                opponent2PosRef.current = gwPos;
              }
            }
            setExplosionEffects((p) => [
              ...p,
              { x: gwPos.x, y: gwPos.y, ttl: 6, effectType: "teleport" },
            ]);
          }
          break;
        }
        case "power surge":
          setBeams((p) => [
            ...p,
            { x: playerPos.x, y: playerPos.y, direction: "left", ttl: 1 },
          ]);
          break;
        // Topple: launch an existing wall block at the enemy, 40 DMG
        case "topple": {
          // Knock the wall directly in front of the player
          const toppleX = playerPos.x + GRID_SIZE - 1;
          const wallBlock = blocks.find(
            (bl) => bl.x === toppleX && bl.y === playerPos.y
          );
          if (wallBlock) {
            setBlocks((p) =>
              p.filter((bl) => !(bl.x === wallBlock.x && bl.y === wallBlock.y))
            );
            setExplosionEffects((p) => [
              ...p,
              {
                x: wallBlock.x,
                y: wallBlock.y,
                ttl: GRID_SIZE * 2 + 2,
                effectType: "topple",
              },
            ]);
          } else {
            // No wall in front - refund 1 mana
            setPlayerMana((p) => Math.min(p + 1, MAX_MANA));
          }
          break;
        }
        // ── SLIME MOVES ──
        case "slime ball": {
          const sb1 =
            playerPos.x === 0 ? GRID_SIZE - 1 : playerPos.x - 1 + GRID_SIZE;
          const sb2 =
            playerPos.x <= 1
              ? GRID_SIZE - 2 + playerPos.x
              : playerPos.x - 2 + GRID_SIZE;
          [sb1, sb2].forEach((sx) => {
            setExplosionEffects((p) => [
              ...p,
              { x: sx, y: playerPos.y, ttl: 5, effectType: "explosion" },
            ]);
            if (sx === opponentPos.x && playerPos.y === opponentPos.y)
              setOpponentHP((p) => Math.max(0, p - 10));
          });
          // Leave poison trap at the farther tile
          setLilyPadTraps((p) => [
            ...p,
            { x: sb2, y: playerPos.y, ttl: 100, effectType: "poisontrap" },
          ]);
          break;
        }
        case "slime trail": {
          const h1 = {
            x: Math.floor(Math.random() * GRID_SIZE) + GRID_SIZE,
            y: Math.floor(Math.random() * GRID_SIZE),
          };
          const h2 = {
            x: Math.floor(Math.random() * GRID_SIZE) + GRID_SIZE,
            y: Math.floor(Math.random() * GRID_SIZE),
          };
          setLilyPadTraps((p) => [
            ...p,
            { x: h1.x, y: h1.y, ttl: 120, effectType: "healpuddle" },
            { x: h2.x, y: h2.y, ttl: 120, effectType: "healpuddle" },
          ]);
          break;
        }
        case "dissolve":
          setExplosionEffects((p) => [
            ...p,
            {
              x: opponentPos.x,
              y: opponentPos.y,
              ttl: 40,
              effectType: "sporecloud",
            },
          ]);
          break;
        case "bounce": {
          const brx = Math.floor(Math.random() * GRID_SIZE),
            bry = Math.floor(Math.random() * GRID_SIZE);
          setExplosionEffects((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE,
              y: playerPos.y,
              ttl: 3,
              effectType: "teleport",
            },
            { x: brx + GRID_SIZE, y: bry, ttl: 3, effectType: "teleport" },
          ]);
          setPlayerPos({ x: brx, y: bry });
          break;
        }
        case "goo trap": {
          const grx = Math.floor(Math.random() * GRID_SIZE),
            gry = Math.floor(Math.random() * GRID_SIZE);
          // Uses poisontrap: stun + poison on contact
          setLilyPadTraps((p) => [
            ...p,
            { x: grx, y: gry, ttl: 150, effectType: "poisontrap" },
          ]);
          break;
        }
        case "absorb": {
          if (opponentStunned > 0 || poisonDotTimer > 0) {
            setPlayerHP((p) => Math.min(100, p + 20));
            setExplosionEffects((p) => [
              ...p,
              {
                x: playerPos.x + GRID_SIZE,
                y: playerPos.y,
                ttl: 8,
                effectType: "chorus",
              },
            ]);
          } else {
            // Refund partial mana if enemy not stunned/poisoned
            setPlayerMana((p) => Math.min(p + 1, MAX_MANA));
            setExplosionEffects((p) => [
              ...p,
              {
                x: playerPos.x + GRID_SIZE,
                y: playerPos.y,
                ttl: 3,
                effectType: "explosion",
              },
            ]);
          }
          break;
        }
        case "toxic wave": {
          const twe: TimedEffect[] = [];
          for (let i = 0; i < GRID_SIZE; i++) {
            twe.push({
              x: i,
              y: playerPos.y,
              ttl: 15,
              effectType: "leafstorm",
            });
            if (opponentPos.x === i && opponentPos.y === playerPos.y) {
              setOpponentHP((p) => Math.max(0, p - 20));
              setOpponentStunned(15);
            }
          }
          setExplosionEffects((p) => [...p, ...twe]);
          break;
        }
        // Venom spit: poison trap 4 tiles ahead on enemy grid
        case "venom spit": {
          const vsx = Math.max(0, GRID_SIZE - 4);
          setLilyPadTraps((p) => [
            ...p,
            { x: vsx, y: playerPos.y, ttl: 150, effectType: "poisontrap" },
          ]);
          setExplosionEffects((p) => [
            ...p,
            { x: vsx, y: playerPos.y, ttl: 5, effectType: "explosion" },
          ]);
          break;
        }
        // ── BAT MOVES ──
        case "sonic screech":
          setBeams((p) => [
            ...p,
            { x: playerPos.x, y: playerPos.y, direction: "left", ttl: 1 },
          ]);
          break;
        case "wing slash": {
          const wsx =
            playerPos.x === 0 ? GRID_SIZE - 1 : playerPos.x - 1 + GRID_SIZE;
          setPunch({ x: wsx, y: playerPos.y, ttl: 1 });
          break;
        }
        case "sonar jam": {
          setSilenceTimer(40); // 2 seconds at 50ms tick
          setManaBoostTimer(40);
          setExplosionEffects((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE,
              y: playerPos.y,
              ttl: 10,
              effectType: "chorus",
            },
            {
              x: opponentPosRef.current.x,
              y: opponentPosRef.current.y,
              ttl: 10,
              effectType: "dustdevil",
            },
          ]);
          break;
        }
        case "swoop":
          setExplosionEffects((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE - 1,
              y: playerPos.y,
              ttl: GRID_SIZE * 2 + 1,
              effectType: "flyingsword",
            },
          ]);
          break;
        case "blood drain": {
          // Deals exactly 10 DMG and heals 10 HP to any enemy in the same row
          const nep = nearestEnemyPos();
          if (nep.y === playerPos.y) {
            const slot = findHitEnemy(nep.x, nep.y);
            if (slot >= 0) {
              dmgEnemy(slot, 10 + cardBonus("blood drain"));
              setPlayerHP((p) => Math.min(100, p + 10));
            }
          }
          // Visual: red sweep across the row + heal glow on player (chorus is visual-only)
          const bde: TimedEffect[] = [];
          for (let i = 0; i < GRID_SIZE; i++)
            bde.push({ x: i, y: playerPos.y, ttl: 8, effectType: "chorus" });
          bde.push({
            x: playerPos.x + GRID_SIZE,
            y: playerPos.y,
            ttl: 10,
            effectType: "chorus",
          });
          setExplosionEffects((p) => [...p, ...bde]);
          break;
        }
        case "shadow dive": {
          const sameRow = playerPos.y === opponentPos.y;
          // Move player to front row (x=0, closest to enemy)
          const newPPos = { x: 0, y: playerPos.y };
          setPlayerPos(newPPos);
          // Move opponent to front row (x=GRID_SIZE-1, closest to player)
          const newOPos = { x: GRID_SIZE - 1, y: opponentPos.y };
          setOpponentPos(newOPos);
          opponentPosRef.current = newOPos;
          if (sameRow) {
            setOpponentHP((p) => Math.max(0, p - 10));
            triggerOpponentAnim("hit", 350);
          }
          setExplosionEffects((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE,
              y: playerPos.y,
              ttl: 5,
              effectType: "teleport",
            },
            { x: GRID_SIZE, y: playerPos.y, ttl: 5, effectType: "teleport" },
            {
              x: opponentPos.x,
              y: opponentPos.y,
              ttl: 5,
              effectType: "teleport",
            },
            {
              x: GRID_SIZE - 1,
              y: opponentPos.y,
              ttl: 5,
              effectType: "teleport",
            },
          ]);
          break;
        }
        // Vampiric mist: draining cloud on enemy position for 3s, deals 3 DMG/tick + heals 2/tick
        case "vampiric mist": {
          const vmTarget = nearestEnemyPos();
          setExplosionEffects((p) => [
            ...p,
            { x: vmTarget.x, y: vmTarget.y, ttl: 30, effectType: "vampmist" },
          ]);
          break;
        }
        // ── PIXIE MOVES ──
        case "healing font": {
          // Create heal tile on player's current position
          setLilyPadTraps((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE,
              y: playerPos.y,
              ttl: 100,
              effectType: "healfont",
            },
          ]);
          setExplosionEffects((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE,
              y: playerPos.y,
              ttl: 6,
              effectType: "chorus",
            },
          ]);
          break;
        }
        case "stunning gleam": {
          // Cone: 1 tile in front + 3 tiles behind it
          const sgTile1 = { x: playerPos.x + GRID_SIZE - 1, y: playerPos.y };
          const sgTiles = [
            sgTile1,
            { x: playerPos.x + GRID_SIZE - 2, y: playerPos.y - 1 },
            { x: playerPos.x + GRID_SIZE - 2, y: playerPos.y },
            { x: playerPos.x + GRID_SIZE - 2, y: playerPos.y + 1 },
          ].filter((t) => t.y >= 0 && t.y < GRID_SIZE && t.x >= 0);
          sgTiles.forEach((t) => {
            setExplosionEffects((p) => [
              ...p,
              { x: t.x, y: t.y, ttl: 5, effectType: "stungleam" },
            ]);
            // Check if any enemy is on this tile
            const sgHit = findHitEnemyRef(t.x, t.y);
            if (sgHit >= 0) {
              dmgEnemy(sgHit, 20 + cardBonus("stunning gleam"));
              stunEnemySlot(sgHit, 10);
            }
          });
          break;
        }
        case "call family": {
          // Summon 2 turrets at back corners of player side
          const tCorner1 = { x: GRID_SIZE - 1 + GRID_SIZE, y: 0 };
          const tCorner2 = { x: GRID_SIZE - 1 + GRID_SIZE, y: GRID_SIZE - 1 };
          setTurrets((p) => [
            ...p.filter((t) => t.owner !== "player"),
            {
              x: tCorner1.x,
              y: tCorner1.y,
              hp: 15,
              owner: "player",
              shootTimer: 0,
            },
            {
              x: tCorner2.x,
              y: tCorner2.y,
              hp: 15,
              owner: "player",
              shootTimer: 0,
            },
          ]);
          setExplosionEffects((p) => [
            ...p,
            { x: tCorner1.x, y: tCorner1.y, ttl: 6, effectType: "chorus" },
            { x: tCorner2.x, y: tCorner2.y, ttl: 6, effectType: "chorus" },
          ]);
          break;
        }
        // ── GIANT MOVES ──
        case "hammer down": {
          // Freeze player for 1.5 seconds (30 ticks), then deal 50 DMG cone
          setPlayerFrozenTimer(30);
          // Show warning tiles
          const hdTile1 = { x: playerPos.x + GRID_SIZE - 1, y: playerPos.y };
          const hdWarningTiles = [
            hdTile1,
            { x: playerPos.x + GRID_SIZE - 2, y: playerPos.y - 1 },
            { x: playerPos.x + GRID_SIZE - 2, y: playerPos.y },
            { x: playerPos.x + GRID_SIZE - 2, y: playerPos.y + 1 },
          ].filter((t) => t.y >= 0 && t.y < GRID_SIZE && t.x >= 0);
          // Show warning effect
          hdWarningTiles.forEach((t) => {
            setExplosionEffects((p) => [
              ...p,
              { x: t.x, y: t.y, ttl: 30, effectType: "hammerwarning" },
            ]);
          });
          // Delayed damage after 1.5s
          setTimeout(() => {
            hdWarningTiles.forEach((t) => {
              setExplosionEffects((p) => [
                ...p,
                { x: t.x, y: t.y, ttl: 6, effectType: "hammerhit" },
              ]);
              const hdHit = findHitEnemyRef(t.x, t.y);
              if (hdHit >= 0) {
                dmgEnemy(hdHit, 50 + cardBonus("hammer down"));
              }
            });
          }, 1500);
          break;
        }
        case "brick break": {
          // Destroy wall directly in front and heal 15 HP
          const bbX = playerPos.x + GRID_SIZE - 1;
          const bbWall = blocks.find(
            (bl) => bl.x === bbX && bl.y === playerPos.y
          );
          if (bbWall) {
            setBlocks((p) =>
              p.filter((bl) => !(bl.x === bbWall.x && bl.y === bbWall.y))
            );
            setExplosionEffects((p) => [
              ...p,
              { x: bbWall.x, y: bbWall.y, ttl: 5, effectType: "explosion" },
            ]);
            setPlayerHP((h) => Math.min(100, h + 15));
          } else {
            setPlayerMana((p) => Math.min(p + 1, MAX_MANA));
          }
          break;
        }
        case "zone steal": {
          // Steal nearest enemy column (column closest to player) for 3 seconds
          const zsCol = GRID_SIZE - 1; // closest enemy column to player (world x=3)
          setZoneStealTimer(60); // 3 seconds
          setZoneStealOwner("player");
          setZoneStealCol(zsCol);
          // Push opponents off stolen column + stun + dmg
          if (opponentPosRef.current.x === zsCol) {
            const pushPos = {
              x: Math.max(0, zsCol - 1),
              y: opponentPosRef.current.y,
            };
            setOpponentPos(pushPos);
            opponentPosRef.current = pushPos;
            dmgEnemy(0, 20);
            stunEnemySlot(0, 30);
          }
          if (
            currentEnemy2 &&
            opponent2PosRef.current.x === zsCol &&
            opponent2HP > 0
          ) {
            dmgEnemy(1, 20);
            stunEnemySlot(1, 30);
          }
          break;
        }
        // ── MUSHROOM MOVES ──
        case "absorb poison": {
          setAbsorbPoisonTimer(60); // 3 seconds
          setExplosionEffects((p) => [
            ...p,
            {
              x: playerPos.x + GRID_SIZE,
              y: playerPos.y,
              ttl: 10,
              effectType: "chorus",
            },
          ]);
          break;
        }
        case "silence bomb": {
          // Place silence bomb trap 2 tiles ahead
          const silX =
            playerPos.x <= 1
              ? GRID_SIZE - 2 + playerPos.x
              : playerPos.x - 2 + GRID_SIZE;
          setExplosionEffects((p) => [
            ...p,
            { x: silX, y: playerPos.y, ttl: 200, effectType: "silencebomb" },
          ]);
          break;
        }
        case "fairy ring": {
          // Place 2 mushroom turrets in center of enemy field
          const frY1 = Math.floor(GRID_SIZE / 2) - 1;
          const frY2 = Math.floor(GRID_SIZE / 2);
          const frX = Math.floor(GRID_SIZE / 2);
          setTurrets((p) => [
            ...p.filter((t) => !(t.owner === "player" && t.isMushroom)),
            {
              x: frX,
              y: frY1,
              hp: 8,
              owner: "player",
              shootTimer: 0,
              isMushroom: true,
              moveTimer: 0,
            },
            {
              x: frX,
              y: frY2,
              hp: 8,
              owner: "player",
              shootTimer: 0,
              isMushroom: true,
              moveTimer: 0,
            },
          ]);
          setExplosionEffects((p) => [
            ...p,
            { x: frX, y: frY1, ttl: 6, effectType: "chorus" },
            { x: frX, y: frY2, ttl: 6, effectType: "chorus" },
          ]);
          break;
        }
      }
    },
    [
      gameOver,
      hand,
      playerMana,
      playerPos,
      opponentPos,
      selectedCharacter,
      opponentHP,
      opponentStunned,
      poisonDotTimer,
      currentEnemy,
      currentEnemy2,
      caughtMonsterNames,
      enemyWave,
      onCatchMonster,
      triggerPlayerAnim,
      triggerOpponentAnim,
      blocks,
      opponent2HP,
      opponent2Pos,
      opponent2Stunned,
      nearestEnemyPos,
      findHitEnemy,
      dmgEnemy,
      dmgEnemySilent,
      stunEnemySlot,
      enemySilenceTimer,
    ]
  );

  const drawCard = useCallback(() => {
    if (hand.length >= MAX_HAND_SIZE) return;
    if (deck.length === 0) {
      // Reshuffle: refill deck from active deck
      setDeck([...activeDeck]);
      return;
    }
    const ci = Math.floor(Math.random() * deck.length);
    setHand((p) => [...p, deck[ci]]);
    setDeck((p) => p.filter((_, i) => i !== ci));
  }, [hand, deck, activeDeck]);

  // ── ENEMY AI CARD USAGE (trainer battles) ──
  // Each card is an EXACT mirror of the player version, flipped left→right.
  // Uses e_sweep (traveling projectile right, damages player on contact) and
  // e_zone (lingering damage area on player grid) for effects that need game-loop handling.
  // Direct applyDmg for instant hits. Coordinates: ePos (0-3 enemy grid), pPos (0-3 player grid).
  // Player world X = pPos.x + GRID_SIZE. Enemy attacks go RIGHT (+x direction).
  const enemyUseCard = useCallback(
    (cardName: string, ePos: Position, slot: number) => {
      const pPos = playerPosRef.current;
      const sameRow = ePos.y === pPos.y;
      const buffMul =
        enemyBuffTimer > 0 ? Math.floor(Math.random() * 4 + 1) : 1;
      const applyDmg = (d: number) => {
        setPlayerHP((p) => {
          const n = Math.max(0, p - d * buffMul);
          playerHPRef.current = n;
          return n;
        });
        triggerPlayerAnim("hit", 350);
      };
      // Check if world position hits player
      const hitsPlayer = (wx: number, wy: number) =>
        wx === pPos.x + GRID_SIZE && wy === pPos.y;
      // "1 tile ahead" in world coords (mirrored: enemy goes RIGHT)
      const ahead1 = ePos.x + 1;
      // Enemy self-heal helper
      const healSelf = (amt: number) => {
        if (slot === 0) setOpponentHP((p) => Math.min(opponentMaxHP, p + amt));
        else setOpponent2HP((p) => Math.min(opponent2MaxHP, p + amt));
      };
      // Enemy self-move helper
      const moveSelf = (np: Position) => {
        if (slot === 0) {
          setOpponentPos(np);
          opponentPosRef.current = np;
        } else {
          setOpponent2Pos(np);
          opponent2PosRef.current = np;
        }
      };

      switch (cardName) {
        // ═══ BEAM-TYPE: row attack, 20 DMG if same row (mirrors player beam/power surge/sonic screech) ═══
        case "beam":
        case "power surge":
        case "sonic screech":
        case "leafstorm":
        case "toxic wave": {
          if (sameRow) applyDmg(20);
          for (let i = 0; i < GRID_SIZE; i++)
            setExplosionEffects((p) => [
              ...p,
              {
                x: GRID_SIZE + i,
                y: ePos.y,
                ttl: 4 + i * 2,
                effectType: "explosion",
              },
            ]);
          break;
        }
        // ═══ PUNCH-TYPE: hits 1 tile ahead, 40 DMG (only connects at boundary, mirrors player punch) ═══
        case "punch":
        case "mud slap":
        case "wing slash": {
          if (hitsPlayer(ahead1, ePos.y)) applyDmg(40);
          setExplosionEffects((p) => [
            ...p,
            { x: ahead1, y: ePos.y, ttl: 4, effectType: "explosion" },
          ]);
          break;
        }
        // ═══ SLASH: 3 tiles vertical at 1 ahead, 30 DMG each (mirrors player slash) ═══
        case "slash": {
          [ePos.y - 1, ePos.y, ePos.y + 1]
            .filter((sy) => sy >= 0 && sy < GRID_SIZE)
            .forEach((sy) => {
              if (hitsPlayer(ahead1, sy)) applyDmg(30);
              setExplosionEffects((p) => [
                ...p,
                { x: ahead1, y: sy, ttl: 4, effectType: "explosion" },
              ]);
            });
          break;
        }
        // ═══ SHIELD BASH: 1 tile ahead, 30 DMG (mirrors player shield bash) ═══
        case "shield bash": {
          if (hitsPlayer(ahead1, ePos.y)) applyDmg(30);
          setExplosionEffects((p) => [
            ...p,
            { x: ahead1, y: ePos.y, ttl: 4, effectType: "explosion" },
          ]);
          break;
        }
        // ═══ BOMB: placed 2 tiles ahead as trap, 40 DMG (mirrors player bomb placement) ═══
        case "bomb": {
          const bx = ePos.x + 2;
          const trapX = Math.max(GRID_SIZE, Math.min(GRID_SIZE * 2 - 1, bx));
          setLilyPadTraps((p) => [
            ...p,
            { x: trapX, y: ePos.y, ttl: 100, effectType: "poisontrap" },
          ]);
          setExplosionEffects((p) => [
            ...p,
            { x: trapX, y: ePos.y, ttl: 5, effectType: "explosion" },
          ]);
          break;
        }
        // ═══ LASSO: same-row pull player to front (x=0) + 15 DMG (mirrors player lasso pull) ═══
        case "lasso": {
          if (sameRow) {
            applyDmg(15);
            const lp = { x: 0, y: pPos.y };
            setPlayerPos(lp);
            playerPosRef.current = lp;
          }
          setExplosionEffects((p) => [
            ...p,
            { x: GRID_SIZE, y: ePos.y, ttl: 5, effectType: "explosion" },
          ]);
          break;
        }
        // ═══ QUICKDRAW / PLASMA SHOT: double bullet (mirrors player fast bullet) ═══
        case "quickdraw":
        case "plasma shot": {
          setOpponentBullets((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, direction: "right" as const },
            {
              x: Math.max(0, ePos.x - 1),
              y: ePos.y,
              direction: "right" as const,
            },
          ]);
          break;
        }
        // ═══ DUST DEVIL / TONGUE WHIP / EMP BLAST: AOE 4 adjacent tiles, 20/15/15 DMG (mirrors player versions) ═══
        case "dust devil":
        case "tongue whip":
        case "emp blast": {
          const aoeDmg = cardName === "dust devil" ? 20 : 15;
          [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
          ].forEach((a) => {
            const wx = ePos.x + a.dx,
              wy = ePos.y + a.dy;
            if (wy >= 0 && wy < GRID_SIZE && wx >= 0 && wx < GRID_SIZE * 2) {
              setExplosionEffects((p) => [
                ...p,
                { x: wx, y: wy, ttl: 5, effectType: "explosion" },
              ]);
              if (hitsPlayer(wx, wy)) applyDmg(aoeDmg);
            }
          });
          break;
        }
        // ═══ RICOCHET: bullet + bounce bullet in offset row (mirrors player ricochet) ═══
        case "ricochet": {
          setOpponentBullets((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, direction: "right" as const },
          ]);
          const bounceY = Math.max(
            0,
            Math.min(GRID_SIZE - 1, ePos.y + (ePos.y > 0 ? -1 : 1))
          );
          setOpponentBullets((p) => [
            ...p,
            { x: GRID_SIZE, y: bounceY, direction: "right" as const },
          ]);
          break;
        }
        // ═══ FLYING SWORD / SWOOP: homing sweep RIGHT, 15 DMG on hit (mirrors player flyingsword) ═══
        case "flying sword":
        case "swoop": {
          setExplosionEffects((p) => [
            ...p,
            {
              x: ePos.x,
              y: pPos.y,
              ttl: GRID_SIZE * 2 + 4,
              effectType: "e_sweep",
              dmg: 15 * buffMul,
              hasDamaged: false,
            },
          ]);
          break;
        }
        // ═══ CLAWINGSWORD: sweep RIGHT from far left, 30 DMG on hit (mirrors player clawingsword sweep) ═══
        case "clawingsword": {
          setExplosionEffects((p) => [
            ...p,
            {
              x: 0,
              y: ePos.y,
              ttl: GRID_SIZE * 2 + 4,
              effectType: "e_sweep",
              dmg: 30 * buffMul,
              hasDamaged: false,
            },
          ]);
          break;
        }
        // ═══ WALL / BARRIER: column of blocks 2 tiles ahead (mirrors player wall placement) ═══
        case "wall":
        case "barrier": {
          const wx = Math.min(GRID_SIZE - 1, ePos.x + 2);
          for (let i = 0; i < GRID_SIZE; i++) {
            if (!blocks.some((b) => b.x === wx && b.y === i))
              setBlocks((p) => [...p, { x: wx, y: i, health: 1 }]);
          }
          break;
        }
        // ═══ THORN SHIELD / OVERCHARGE: buff mode (mirrors player overcharge/frenzy) ═══
        case "thorn shield":
        case "overcharge": {
          setEnemyBuffTimer(60);
          setExplosionEffects((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 8, effectType: "chorus" },
          ]);
          break;
        }
        // ═══ VINE SNARE / GOO TRAP / LILY PAD TRAP: trap on random player grid tile (mirrors player traps) ═══
        case "vine snare":
        case "goo trap":
        case "lily pad trap": {
          const rx = GRID_SIZE + Math.floor(Math.random() * GRID_SIZE);
          const ry = Math.floor(Math.random() * GRID_SIZE);
          setLilyPadTraps((p) => [
            ...p,
            { x: rx, y: ry, ttl: 150, effectType: "poisontrap" },
          ]);
          setExplosionEffects((p) => [
            ...p,
            { x: rx, y: ry, ttl: 4, effectType: "teleport" },
          ]);
          break;
        }
        // ═══ SPORE CLOUD / DISSOLVE: DOT zone on player tile, 3 DMG/5ticks (mirrors player spore cloud) ═══
        case "spore cloud":
        case "dissolve": {
          setExplosionEffects((p) => [
            ...p,
            {
              x: pPos.x + GRID_SIZE,
              y: pPos.y,
              ttl: 40,
              effectType: "e_zone",
              dmg: 3 * buffMul,
            },
          ]);
          break;
        }
        // ═══ TOPPLE: launch block as sweep projectile RIGHT, 40 DMG (mirrors player topple) ═══
        case "topple": {
          const enemyBlocks = blocks.filter(
            (b) => b.x < GRID_SIZE && b.health < 999
          );
          const wb =
            enemyBlocks.find((b) => b.y === ePos.y) ||
            (enemyBlocks.length > 0 ? enemyBlocks[0] : null);
          if (wb) {
            setBlocks((p) => p.filter((b) => !(b.x === wb.x && b.y === wb.y)));
            setExplosionEffects((p) => [
              ...p,
              {
                x: wb.x,
                y: wb.y,
                ttl: GRID_SIZE * 2 + 4,
                effectType: "e_sweep",
                dmg: 40 * buffMul,
                hasDamaged: false,
              },
            ]);
          } else {
            setOpponentBullets((p) => [
              ...p,
              { x: ePos.x, y: ePos.y, direction: "right" as const },
            ]);
          }
          break;
        }
        // ═══ RAT PACK: 2 quick hits at tiles ahead, 10 DMG each (mirrors player rat pack) ═══
        case "rat pack": {
          [ePos.x + 1, ePos.x + 2].forEach((rx) => {
            if (hitsPlayer(rx, ePos.y)) applyDmg(10);
            setExplosionEffects((p) => [
              ...p,
              { x: rx, y: ePos.y, ttl: 4, effectType: "explosion" },
            ]);
          });
          break;
        }
        // ═══ TRASH TOSS / SLIME BALL: fire bullet (mirrors player projectiles) ═══
        case "trash toss":
        case "slime ball": {
          setOpponentBullets((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, direction: "right" as const },
          ]);
          break;
        }
        // ═══ STREET SWARM: bullets across 3 rows (mirrors player street swarm) ═══
        case "street swarm": {
          for (let i = 0; i < 3; i++) {
            const sy = Math.max(0, Math.min(GRID_SIZE - 1, ePos.y - 1 + i));
            setOpponentBullets((p) => [
              ...p,
              { x: ePos.x, y: sy, direction: "right" as const },
            ]);
          }
          break;
        }
        // ═══ PLAGUE BITE: 20 DMG first 2 tiles in front + DOT (mirrors player plague bite) ═══
        case "plague bite": {
          const ePbTile1 = ePos.x + 1;
          const ePbTile2 = ePos.x + 2;
          const playerWorldX = playerPosRef.current.x + GRID_SIZE;
          if (
            sameRow &&
            (playerWorldX === ePbTile1 || playerWorldX === ePbTile2)
          ) {
            applyDmg(20);
            setEnemyDotTimer((p) => p + 50);
          }
          setExplosionEffects((p) => [
            ...p,
            { x: ePbTile1, y: ePos.y, ttl: 4, effectType: "explosion" },
            { x: ePbTile2, y: ePos.y, ttl: 4, effectType: "explosion" },
          ]);
          break;
        }
        // ═══ TUNNEL / BOUNCE: teleport self to random tile (mirrors player versions) ═══
        case "tunnel":
        case "bounce": {
          const tp = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
          };
          setExplosionEffects((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 5, effectType: "teleport" },
            { x: tp.x, y: tp.y, ttl: 5, effectType: "teleport" },
          ]);
          moveSelf(tp);
          break;
        }
        // ═══ SCAVENGE: +3 mana (mirrors player scavenge) ═══
        case "scavenge": {
          setEnemyMana((p) => Math.min(MAX_MANA, p + 3));
          setExplosionEffects((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 5, effectType: "chorus" },
          ]);
          break;
        }
        // ═══ CROAK BLAST: slow sweep RIGHT every 2 ticks, 20 DMG on hit (mirrors player croak beam) ═══
        case "croak blast": {
          setExplosionEffects((p) => [
            ...p,
            {
              x: ePos.x,
              y: ePos.y,
              ttl: GRID_SIZE * 2 + 6,
              effectType: "e_beam",
              dmg: 20 * buffMul,
              hasDamaged: false,
            },
          ]);
          break;
        }
        // ═══ SPAWN TADPOLE: sweep projectile RIGHT, 10 DMG on hit (mirrors player tadpole) ═══
        case "spawn tadpole": {
          setExplosionEffects((p) => [
            ...p,
            {
              x: ePos.x,
              y: ePos.y,
              ttl: GRID_SIZE * 2 + 4,
              effectType: "e_sweep",
              dmg: 10 * buffMul,
              hasDamaged: false,
            },
          ]);
          break;
        }
        // ═══ RANDOM HOP: teleport player to random tile + 5 DMG (mirrors player random hop) ═══
        case "random hop": {
          const rp = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
          };
          setExplosionEffects((p) => [
            ...p,
            {
              x: pPos.x + GRID_SIZE,
              y: pPos.y,
              ttl: 5,
              effectType: "teleport",
            },
            { x: rp.x + GRID_SIZE, y: rp.y, ttl: 5, effectType: "teleport" },
          ]);
          setPlayerPos(rp);
          playerPosRef.current = rp;
          applyDmg(5);
          break;
        }

        // ═══ HEALING FONT: create heal tile on enemy position ═══
        case "healing font": {
          setLilyPadTraps((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 100, effectType: "healfont" },
          ]);
          setExplosionEffects((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 6, effectType: "chorus" },
          ]);
          break;
        }
        // ═══ STUNNING GLEAM: cone 1 tile + 3 behind, 20 DMG + stun ═══
        case "stunning gleam": {
          const esgTiles = [
            { x: ePos.x + 1, y: ePos.y },
            { x: ePos.x + 2, y: ePos.y - 1 },
            { x: ePos.x + 2, y: ePos.y },
            { x: ePos.x + 2, y: ePos.y + 1 },
          ].filter((t) => t.y >= 0 && t.y < GRID_SIZE && t.x < GRID_SIZE * 2);
          const pWorldX = playerPosRef.current.x + GRID_SIZE;
          const pWorldY = playerPosRef.current.y;
          esgTiles.forEach((t) => {
            setExplosionEffects((p) => [
              ...p,
              { x: t.x, y: t.y, ttl: 5, effectType: "stungleam" },
            ]);
            if (t.x === pWorldX && t.y === pWorldY) {
              applyDmg(20);
            }
          });
          break;
        }
        // ═══ CALL FAMILY: summon 2 turrets at back corners of enemy side ═══

        // ═══ HAMMER DOWN: cone after 1.5s delay ═══
        case "hammer down": {
          const ehdTile1 = { x: ePos.x + 1, y: ePos.y };
          const ehdTiles = [
            ehdTile1,
            { x: ePos.x + 2, y: ePos.y - 1 },
            { x: ePos.x + 2, y: ePos.y },
            { x: ePos.x + 2, y: ePos.y + 1 },
          ].filter((t) => t.y >= 0 && t.y < GRID_SIZE && t.x < GRID_SIZE * 2);
          ehdTiles.forEach((t) => {
            setExplosionEffects((p) => [
              ...p,
              { x: t.x, y: t.y, ttl: 30, effectType: "hammerwarning" },
            ]);
          });
          // Delayed damage
          setTimeout(() => {
            ehdTiles.forEach((t) => {
              setExplosionEffects((p) => [
                ...p,
                { x: t.x, y: t.y, ttl: 6, effectType: "hammerhit" },
              ]);
              if (
                t.x === playerPosRef.current.x &&
                t.y === playerPosRef.current.y
              ) {
                setPlayerHP((h) => Math.max(0, h - 50));
              }
            });
          }, 1500);
          break;
        }
        // ═══ BRICK BREAK: destroy wall in front, heal 15 ═══
        case "brick break": {
          const ebbX = ePos.x + 1;
          const ebbWall = blocks.find((bl) => bl.x === ebbX && bl.y === ePos.y);
          if (ebbWall) {
            setBlocks((p) =>
              p.filter((bl) => !(bl.x === ebbWall.x && bl.y === ebbWall.y))
            );
            setExplosionEffects((p) => [
              ...p,
              { x: ebbWall.x, y: ebbWall.y, ttl: 5, effectType: "explosion" },
            ]);
            if (slot === 0) setOpponentHP((h) => Math.min(100, h + 15));
            else setOpponent2HP((h) => Math.min(100, h + 15));
          }
          break;
        }
        // ═══ ZONE STEAL (enemy version): steal nearest player column for 3s ═══
        case "zone steal": {
          const ezsCol = GRID_SIZE; // closest player column to enemy (world x=4)
          setZoneStealTimer(60);
          setZoneStealOwner("enemy");
          setZoneStealCol(ezsCol);
          // If player is on stolen column (local x=0), push to x=1 + stun + dmg
          if (playerPosRef.current.x === 0) {
            const pushPos = { x: 1, y: playerPosRef.current.y };
            setPlayerPos(pushPos);
            playerPosRef.current = pushPos;
            setPlayerHP((h) => Math.max(0, h - 20));
            setPlayerFrozenTimer(30);
          }
          break;
        }
        // ═══ ABSORB POISON (enemy version): heals on poison for 3s ═══
        case "absorb poison": {
          // Enemy version - just heals the enemy 10 HP
          if (slot === 0) setOpponentHP((h) => Math.min(100, h + 10));
          else setOpponent2HP((h) => Math.min(100, h + 10));
          break;
        }
        // ═══ SILENCE BOMB: trap 2 tiles ahead, 20 DMG + silence ═══
        case "silence bomb": {
          const esilX = ePos.x + 2;
          if (esilX < GRID_SIZE * 2) {
            setExplosionEffects((p) => [
              ...p,
              { x: esilX, y: ePos.y, ttl: 200, effectType: "silencebomb" },
            ]);
          }
          break;
        }
        // ═══ FAIRY RING: 2 mushroom turrets in center of player field ═══
        case "fairy ring": {
          const efrY1 = Math.floor(GRID_SIZE / 2) - 1;
          const efrY2 = Math.floor(GRID_SIZE / 2);
          const efrX = GRID_SIZE + Math.floor(GRID_SIZE / 2);
          setTurrets((p) => [
            ...p.filter((t) => !(t.owner === "enemy" && t.isMushroom)),
            {
              x: efrX,
              y: efrY1,
              hp: 8,
              owner: "enemy",
              shootTimer: 0,
              isMushroom: true,
              moveTimer: 0,
            },
            {
              x: efrX,
              y: efrY2,
              hp: 8,
              owner: "enemy",
              shootTimer: 0,
              isMushroom: true,
              moveTimer: 0,
            },
          ]);
          break;
        }
        case "call family": {
          setTurrets((p) => [
            ...p.filter((t) => t.owner !== "enemy"),
            { x: 0, y: 0, hp: 15, owner: "enemy", shootTimer: 0 },
            { x: 0, y: GRID_SIZE - 1, hp: 15, owner: "enemy", shootTimer: 0 },
          ]);
          setExplosionEffects((p) => [
            ...p,
            { x: 0, y: 0, ttl: 6, effectType: "chorus" },
            { x: 0, y: GRID_SIZE - 1, ttl: 6, effectType: "chorus" },
          ]);
          break;
        }
        // ═══ FROG CHORUS / ABSORB: heal 20 HP (mirrors player absorb) ═══
        case "frog chorus":
        case "absorb": {
          healSelf(20);
          setExplosionEffects((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 8, effectType: "chorus" },
          ]);
          break;
        }
        // ═══ GRAVITY WELL: pull player 2 tiles toward center + 10 DMG (mirrors player gravity well) ═══
        case "gravity well": {
          const cx = Math.floor(GRID_SIZE / 2),
            cy = Math.floor(GRID_SIZE / 2);
          const pdx = cx - pPos.x,
            pdy = cy - pPos.y;
          const pmx =
            pdx === 0 ? 0 : pdx > 0 ? Math.min(2, pdx) : Math.max(-2, pdx);
          const pmy =
            pdy === 0 ? 0 : pdy > 0 ? Math.min(2, pdy) : Math.max(-2, pdy);
          const newP = {
            x: Math.max(0, Math.min(GRID_SIZE - 1, pPos.x + pmx)),
            y: Math.max(0, Math.min(GRID_SIZE - 1, pPos.y + pmy)),
          };
          setPlayerPos(newP);
          playerPosRef.current = newP;
          applyDmg(10);
          setExplosionEffects((p) => [
            ...p,
            {
              x: newP.x + GRID_SIZE,
              y: newP.y,
              ttl: 5,
              effectType: "teleport",
            },
          ]);
          break;
        }
        // ═══ SONAR JAM: drain player mana + boost enemy mana (mirrors player silence) ═══
        case "sonar jam": {
          setPlayerMana((p) => Math.max(0, p - 3));
          setEnemyMana((p) => Math.min(MAX_MANA, p + 3));
          setExplosionEffects((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 10, effectType: "chorus" },
            {
              x: pPos.x + GRID_SIZE,
              y: pPos.y,
              ttl: 10,
              effectType: "explosion",
            },
          ]);
          break;
        }
        // ═══ BLOOD DRAIN: 10 DMG same row + heal 10 HP (mirrors player blood drain) ═══
        case "blood drain": {
          if (sameRow) {
            applyDmg(10);
            healSelf(10);
          }
          for (let i = GRID_SIZE; i < GRID_SIZE * 2; i++)
            setExplosionEffects((p) => [
              ...p,
              { x: i, y: ePos.y, ttl: 8, effectType: "chorus" },
            ]);
          break;
        }
        // ═══ SHADOW DIVE: both rush to front row, 10 DMG if same row (mirrors player shadow dive) ═══
        case "shadow dive": {
          const np2 = { x: GRID_SIZE - 1, y: ePos.y };
          moveSelf(np2);
          const newPP = { x: 0, y: pPos.y };
          setPlayerPos(newPP);
          playerPosRef.current = newPP;
          if (sameRow) applyDmg(10);
          setExplosionEffects((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 5, effectType: "teleport" },
            { x: GRID_SIZE - 1, y: ePos.y, ttl: 5, effectType: "teleport" },
            {
              x: pPos.x + GRID_SIZE,
              y: pPos.y,
              ttl: 5,
              effectType: "teleport",
            },
            { x: GRID_SIZE, y: pPos.y, ttl: 5, effectType: "teleport" },
          ]);
          break;
        }
        // ═══ VAMPIRIC MIST: DOT zone + enemy heals (mirrors player vampiric mist) ═══
        case "vampiric mist": {
          setExplosionEffects((p) => [
            ...p,
            {
              x: pPos.x + GRID_SIZE,
              y: pPos.y,
              ttl: 30,
              effectType: "e_zone",
              dmg: 3 * buffMul,
            },
          ]);
          const hAmt = 2;
          const hi = setInterval(() => healSelf(hAmt), 250);
          setTimeout(() => clearInterval(hi), 1500);
          break;
        }
        // ═══ SLIME TRAIL: heal self 10 HP (mirrors player heal puddles) ═══
        case "slime trail": {
          healSelf(10);
          setExplosionEffects((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 8, effectType: "chorus" },
          ]);
          break;
        }
        // ═══ VENOM SPIT: poison trap on player grid (mirrors player venom spit) ═══
        case "venom spit": {
          const vx = GRID_SIZE + Math.min(GRID_SIZE - 1, Math.max(0, pPos.x));
          setLilyPadTraps((p) => [
            ...p,
            { x: vx, y: ePos.y, ttl: 150, effectType: "poisontrap" },
          ]);
          setExplosionEffects((p) => [
            ...p,
            { x: vx, y: ePos.y, ttl: 5, effectType: "explosion" },
          ]);
          break;
        }
        // ═══ FALLBACK: fire a bullet for any unhandled card ═══
        default: {
          setOpponentBullets((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, direction: "right" as const },
          ]);
          break;
        }
      }
      const anim = Math.random() > 0.5 ? "attack" : "attack2";
      if (slot === 0) triggerOpponentAnim(anim, 500);
      else triggerOpponent2Anim(anim, 500);
      setEnemyCardMsg(cardName.toUpperCase());
      setTimeout(() => setEnemyCardMsg(""), 1500);
    },
    [
      blocks,
      opponentMaxHP,
      opponent2MaxHP,
      enemyBuffTimer,
      triggerPlayerAnim,
      triggerOpponentAnim,
      triggerOpponent2Anim,
    ]
  );

  const moveOpponent = useCallback(() => {
    if (gameOver || opponentHP <= 0) return;
    const dx = Math.floor(Math.random() * 3) - 1,
      dy = Math.floor(Math.random() * 3) - 1;
    // Zone steal movement bounds for opponent
    const opMaxX =
      zoneStealOwner === "player" && zoneStealTimer > 0
        ? GRID_SIZE - 2
        : zoneStealOwner === "enemy" && zoneStealTimer > 0
        ? GRID_SIZE
        : GRID_SIZE - 1;
    const opMinX = 0;
    const nx = Math.max(opMinX, Math.min(opMaxX, opponentPos.x + dx)),
      ny = Math.max(0, Math.min(GRID_SIZE - 1, opponentPos.y + dy));
    if (!blocks.some((b) => b.x === nx && b.y === ny)) {
      const newPos = { x: nx, y: ny };
      setOpponentPos(newPos);
      opponentPosRef.current = newPos;
    }
    // Trainer AI: try to use a card
    const deck = currentEnemy?.deck;
    if (deck && deck.length > 0 && silenceTimer <= 0 && Math.random() < 0.5) {
      const affordable = deck.filter((c) => {
        const charDef = [...CHARACTERS, ...MONSTER_CHARACTERS].find((ch) =>
          ch.moves.some((m) => m.name === c)
        );
        const move = charDef?.moves.find((m) => m.name === c);
        return move && enemyMana >= move.manaCost;
      });
      if (affordable.length > 0) {
        const pick = affordable[Math.floor(Math.random() * affordable.length)];
        const charDef = [...CHARACTERS, ...MONSTER_CHARACTERS].find((ch) =>
          ch.moves.some((m) => m.name === pick)
        );
        const move = charDef?.moves.find((m) => m.name === pick);
        if (move) {
          setEnemyMana((p) => p - move.manaCost);
          enemyUseCard(pick, opponentPosRef.current, 0);
          return; // Used card, skip normal shooting
        }
      }
    }
    if (
      Math.random() < (currentEnemy?.shootChance ?? 0.3) &&
      opponentBullets.length < MAX_SHOTS &&
      silenceTimer <= 0
    )
      fireBullet(false);
  }, [
    gameOver,
    opponentHP,
    opponentBullets.length,
    fireBullet,
    blocks,
    opponentPos,
    currentEnemy,
    silenceTimer,
    enemyMana,
    enemyUseCard,
  ]);

  const moveOpponent2 = useCallback(() => {
    if (gameOver || !currentEnemy2 || opponent2HP <= 0) return;
    const dx = Math.floor(Math.random() * 3) - 1,
      dy = Math.floor(Math.random() * 3) - 1;
    const nx = Math.max(0, Math.min(GRID_SIZE - 1, opponent2Pos.x + dx)),
      ny = Math.max(0, Math.min(GRID_SIZE - 1, opponent2Pos.y + dy));
    if (!blocks.some((b) => b.x === nx && b.y === ny)) {
      const newPos = { x: nx, y: ny };
      setOpponent2Pos(newPos);
      opponent2PosRef.current = newPos;
    }
    const deck2 = currentEnemy2?.deck;
    if (deck2 && deck2.length > 0 && silenceTimer <= 0 && Math.random() < 0.5) {
      const affordable2 = deck2.filter((c) => {
        const charDef = [...CHARACTERS, ...MONSTER_CHARACTERS].find((ch) =>
          ch.moves.some((m) => m.name === c)
        );
        const move = charDef?.moves.find((m) => m.name === c);
        return move && enemyMana >= move.manaCost;
      });
      if (affordable2.length > 0) {
        const pick2 =
          affordable2[Math.floor(Math.random() * affordable2.length)];
        const charDef = [...CHARACTERS, ...MONSTER_CHARACTERS].find((ch) =>
          ch.moves.some((m) => m.name === pick2)
        );
        const move = charDef?.moves.find((m) => m.name === pick2);
        if (move) {
          setEnemyMana((p) => p - move.manaCost);
          enemyUseCard(pick2, opponent2PosRef.current, 1);
          return;
        }
      }
    }
    if (Math.random() < (currentEnemy2?.shootChance ?? 0.3)) fireEnemy2Bullet();
  }, [
    gameOver,
    currentEnemy2,
    opponent2HP,
    blocks,
    opponent2Pos,
    fireEnemy2Bullet,
    silenceTimer,
    enemyMana,
    enemyUseCard,
  ]);

  // ── GAME LOOP ──
  useEffect(() => {
    const gl = setInterval(() => {
      if (gameOver) return;
      // Pause game during catch animation
      if (catchAnim === "attempting" || catchAnim === "success") {
        if (catchTimer > 0) setCatchTimer((p) => p - 1);
        return;
      }
      if (catchAnim && catchTimer > 0) {
        setCatchTimer((p) => p - 1);
        if (catchTimer <= 1) setCatchAnim(null);
        return;
      }
      setTickCount((p) => p + 1);
      if (
        isCharging &&
        (selectedCharacter.name === "Rat King" ||
          selectedCharacter.name === "Malipole" ||
          selectedCharacter.name === "Mushroom")
      )
        setChargeTime((p) => p + 1);
      if (malipoleFrenzyActive) {
        setMalipoleFrenzyTimer((p) => p - 1);
        if (malipoleFrenzyTimer <= 0) setMalipoleFrenzyActive(false);
      }
      if (tongueWhipActive) {
        setTongueWhipActive((p) => (p ? { ...p, ttl: p.ttl - 1 } : null));
        if (tongueWhipActive.ttl <= 0) setTongueWhipActive(null);
      }
      if (silenceTimer > 0) setSilenceTimer((p) => p - 1);
      if (playerFrozenTimer > 0) setPlayerFrozenTimer((p) => p - 1);
      if (absorbPoisonTimer > 0) setAbsorbPoisonTimer((p) => p - 1);
      if (enemySilenceTimer > 0) setEnemySilenceTimer((p) => p - 1);
      if (giantStrikeCooldown > 0) setGiantStrikeCooldown((p) => p - 1);
      // Zone steal timer
      if (zoneStealTimer > 0) {
        setZoneStealTimer((p) => {
          if (p <= 1) {
            // Zone steal ended - push back anyone on stolen column + stun
            if (zoneStealOwner === "player") {
              // Player was allowed on stolen enemy column (local x = -1)
              // Push them back to x = 0 if they're still there
              if (playerPosRef.current.x < 0) {
                const pushBack = { x: 0, y: playerPosRef.current.y };
                setPlayerPos(pushBack);
                playerPosRef.current = pushBack;
                setPlayerFrozenTimer(30); // 1.5s stun
              }
              // Enemy regains access to their column (no push needed, just bounds restored)
            } else if (zoneStealOwner === "enemy") {
              // Enemy was allowed on stolen player column (local x = GRID_SIZE)
              // Push enemy back to x = GRID_SIZE-1 if they're still there
              if (opponentPosRef.current.x >= GRID_SIZE) {
                const pushBack = {
                  x: GRID_SIZE - 1,
                  y: opponentPosRef.current.y,
                };
                setOpponentPos(pushBack);
                opponentPosRef.current = pushBack;
                setOpponentStunned(30);
              }
              // Player regains access to column 0 (no push needed)
            }
            setZoneStealOwner(null);
            setZoneStealCol(-1);
          }
          return p - 1;
        });
      }
      if (manaBoostTimer > 0) setManaBoostTimer((p) => p - 1);

      // Plague bite poison DOT: 5 DMG every 10 ticks (1 second) for 5 seconds
      if (poisonDotTimer > 0) {
        setPoisonDotTimer((p) => p - 1);
        if (poisonDotTimer % 10 === 0) {
          // Poison hits all alive enemies
          if (opponentHP > 0) {
            setOpponentHP((p) => Math.max(0, p - 5));
            setExplosionEffects((p) => [
              ...p,
              {
                x: opponentPosRef.current.x,
                y: opponentPosRef.current.y,
                ttl: 3,
                effectType: "poisondot",
              },
            ]);
          }
          if (currentEnemy2 && opponent2HP > 0) {
            setOpponent2HP((p) => Math.max(0, p - 5));
            setExplosionEffects((p) => [
              ...p,
              {
                x: opponent2PosRef.current.x,
                y: opponent2PosRef.current.y,
                ttl: 3,
                effectType: "poisondot",
              },
            ]);
          }
        }
      }

      // Move opponents FIRST, then check traps
      prevOpponentPosRef.current = { ...opponentPosRef.current };
      if (
        tickCount % (currentEnemy?.speed ?? OPPONENT_MOVE_INTERVAL) === 0 &&
        opponentStunned === 0 &&
        opponentHP > 0
      )
        moveOpponent();
      prevOpponent2PosRef.current = { ...opponent2PosRef.current };
      if (
        currentEnemy2 &&
        opponent2HP > 0 &&
        tickCount % (currentEnemy2?.speed ?? OPPONENT_MOVE_INTERVAL) === 0 &&
        opponent2Stunned === 0
      )
        moveOpponent2();
      const manaInterval = manaBoostTimer > 0 ? 5 : 10;
      if (tickCount % manaInterval === 0) {
        setPlayerMana((p) => Math.min(p + 1, MAX_MANA));
        if (hand.length < MAX_HAND_SIZE) drawCard();
      }
      // Enemy mana regen (slightly slower than player)
      if (tickCount % 8 === 0) setEnemyMana((p) => Math.min(MAX_MANA, p + 1));
      if (enemyBuffTimer > 0) setEnemyBuffTimer((p) => p - 1);
      // Enemy DOT on player (2 DMG every 10 ticks = 1 per second, like poisonDot)
      if (enemyDotTimer > 0) {
        setEnemyDotTimer((p) => p - 1);
        if (enemyDotTimer % 10 === 0) {
          setPlayerHP((p) => {
            const n = Math.max(0, p - 5);
            playerHPRef.current = n;
            return n;
          });
        }
      }

      // Trap checking: lily pad, vine snare, poison trap (enemy side) + heal puddle (player side)
      setLilyPadTraps((p) =>
        p
          .map((t) => ({ ...t, ttl: t.ttl - 1 }))
          .filter((t) => {
            // Heal font: heals 5 HP per second (every 20 ticks) on the tile
            if (t.effectType === "healfont") {
              if (t.ttl % 20 === 0 && t.ttl > 0) {
                // Check if player is on this tile (player side)
                if (
                  t.x >= GRID_SIZE &&
                  t.x === playerPos.x + GRID_SIZE &&
                  t.y === playerPos.y
                ) {
                  setPlayerHP((h) => Math.min(100, h + 5));
                }
                // Check if enemy is on this tile (enemy side)
                if (t.x < GRID_SIZE) {
                  if (
                    opponentPosRef.current.x === t.x &&
                    opponentPosRef.current.y === t.y
                  ) {
                    setOpponentHP((h) => Math.min(100, h + 5));
                  }
                  if (
                    currentEnemy2 &&
                    opponent2PosRef.current.x === t.x &&
                    opponent2PosRef.current.y === t.y
                  ) {
                    setOpponent2HP((h) => Math.min(100, h + 5));
                  }
                }
              }
              return t.ttl > 0;
            }
            // Heal puddles: player-side, check against player position
            if (t.effectType === "healpuddle") {
              if (t.x === playerPos.x + GRID_SIZE && t.y === playerPos.y) {
                setPlayerHP((h) => Math.min(100, h + 10));
                setExplosionEffects((pe) => [
                  ...pe,
                  { x: t.x, y: t.y, ttl: 6, effectType: "chorus" },
                ]);
                return false;
              }
              return t.ttl > 0;
            }
            // Enemy-placed traps on player grid: damage player
            if (
              t.x >= GRID_SIZE &&
              t.x === playerPos.x + GRID_SIZE &&
              t.y === playerPos.y
            ) {
              if (
                t.effectType === "poisontrap" ||
                t.effectType === "poisontile" ||
                t.effectType === "poisononly" ||
                t.effectType === "mushpoison_e"
              ) {
                if (absorbPoisonTimer > 0) {
                  // Absorb: heal instead of damage, consume tile
                  setPlayerHP((h) => Math.min(100, h + 10));
                  setExplosionEffects((pe) => [
                    ...pe,
                    { x: t.x, y: t.y, ttl: 5, effectType: "chorus" },
                  ]);
                  return false;
                }
              }
              // mushpoison_e: enemy mushroom turret poison damages player
              if (t.effectType === "mushpoison_e") {
                setPlayerHP((h) => {
                  const n = Math.max(0, h - 10);
                  playerHPRef.current = n;
                  return n;
                });
                setExplosionEffects((pe) => [
                  ...pe,
                  { x: t.x, y: t.y, ttl: 5, effectType: "explosion" },
                ]);
                triggerPlayerAnim("hit", 350);
                return false;
              }
              if (
                t.effectType === "poisontrap" ||
                t.effectType === "vinesnare"
              ) {
                setPlayerHP((h) => {
                  const n = Math.max(0, h - 10);
                  playerHPRef.current = n;
                  return n;
                });
                setExplosionEffects((pe) => [
                  ...pe,
                  { x: t.x, y: t.y, ttl: 5, effectType: "explosion" },
                ]);
                triggerPlayerAnim("hit", 350);
                return false;
              }
            }
            // Enemy-side traps: check against all opponent positions
            const trapHitSlot =
              t.x === opponentPosRef.current.x &&
              t.y === opponentPosRef.current.y &&
              opponentHP > 0
                ? 0
                : currentEnemy2 &&
                  opponent2HP > 0 &&
                  t.x === opponent2PosRef.current.x &&
                  t.y === opponent2PosRef.current.y
                ? 1
                : -1;
            if (trapHitSlot >= 0) {
              const _dmgT = (d: number) =>
                trapHitSlot === 0
                  ? setOpponentHP((h) => Math.max(0, h - d))
                  : setOpponent2HP((h) => Math.max(0, h - d));
              const _stunT = (s: number) =>
                trapHitSlot === 0
                  ? setOpponentStunned(s)
                  : setOpponent2Stunned(s);
              if (t.effectType === "vinesnare") {
                _dmgT(10);
                _stunT(30);
              } else if (t.effectType === "poisontrap") {
                _dmgT(10);
                _stunT(30);
                setPoisonDotTimer(50);
              } else if (t.effectType === "poisononly") {
                setPoisonDotTimer(50);
              } else if (t.effectType === "poisontile") {
                setPoisonDotTimer(50);
              } else if (t.effectType === "mushpoison_p") {
                // Player mushroom turret poison - damage enemy + apply poison DOT + consume
                _dmgT(10);
                setPoisonDotTimer(30); // 1.5s poison DOT
                setExplosionEffects((pe) => [
                  ...pe,
                  { x: t.x, y: t.y, ttl: 5, effectType: "explosion" },
                ]);
                return false;
              } else if (t.effectType === "frozentile") {
                const _posRef =
                  trapHitSlot === 0 ? opponentPosRef : opponent2PosRef;
                const _prevRef =
                  trapHitSlot === 0 ? prevOpponentPosRef : prevOpponent2PosRef;
                const fdx = _posRef.current.x - _prevRef.current.x;
                const fdy = _posRef.current.y - _prevRef.current.y;
                const slideX = Math.max(
                  0,
                  Math.min(GRID_SIZE - 1, _posRef.current.x + fdx)
                );
                const slideY = Math.max(
                  0,
                  Math.min(GRID_SIZE - 1, _posRef.current.y + fdy)
                );
                const slidePos = { x: slideX, y: slideY };
                if (trapHitSlot === 0) {
                  setOpponentPos(slidePos);
                  opponentPosRef.current = slidePos;
                } else {
                  setOpponent2Pos(slidePos);
                  opponent2PosRef.current = slidePos;
                }
              } else if (t.effectType === "brokentile") {
                // Broken: tile shatters into impassable wall for 8 seconds
                setBlocks((bl) => [...bl, { x: t.x, y: t.y, health: 999 }]);
                setExplosionEffects((pe) => [
                  ...pe,
                  { x: t.x, y: t.y, ttl: 80, effectType: "brokenwall" },
                ]);
                // Push opponent off the broken tile
                const pushX = Math.max(0, Math.min(GRID_SIZE - 1, t.x - 1));
                const pushPos = { x: pushX, y: t.y };
                setOpponentPos(pushPos);
                opponentPosRef.current = pushPos;
              } else {
                setOpponentHP((h) => Math.max(0, h - 10));
                setOpponentStunned(10);
              }
              return false;
            }
            // Broken walls just count down
            if (t.effectType === "brokenwall") return t.ttl > 0;
            return t.ttl > 0;
          })
      );

      // ── EFFECTS UPDATE ──
      setExplosionEffects((prev) => {
        const updated = prev.map((e) => {
          if (e.effectType === "flyingsword")
            return { ...e, x: e.x - 1, ttl: e.ttl - 1 };
          if (e.effectType === "clawingsword")
            return { ...e, x: e.x + 1, ttl: e.ttl - 1 };
          if (e.effectType === "ratpack") return { ...e, ttl: e.ttl - 1 };
          if (e.effectType === "ratstorm") {
            if (e.ttl % 5 === 0) {
              const rdx =
                Math.random() < 0.7 ? -1 : Math.floor(Math.random() * 3) - 1;
              const rdy = Math.floor(Math.random() * 3) - 1;
              return {
                ...e,
                x: Math.max(0, Math.min(GRID_SIZE * 2 - 1, e.x + rdx)),
                y: Math.max(0, Math.min(GRID_SIZE - 1, e.y + rdy)),
                ttl: e.ttl - 1,
              };
            }
            return { ...e, ttl: e.ttl - 1 };
          }
          // Tadpole: zigzag motion — move left 1 tile every 3 ticks, alternate y direction
          if (e.effectType === "tadpole") {
            if (e.ttl % 3 === 0) {
              const zigDir = Math.floor(e.ttl / 3) % 2 === 0 ? 1 : -1;
              return {
                ...e,
                x: e.x - 1,
                y: Math.max(0, Math.min(GRID_SIZE - 1, e.y + zigDir)),
                ttl: e.ttl - 1,
              };
            }
            return { ...e, ttl: e.ttl - 1 };
          }
          // Topple: launched block moves left 1 tile per tick
          if (e.effectType === "topple")
            return { ...e, x: e.x - 1, ttl: e.ttl - 1 };
          // Vampiric mist: damage + heal every tick while enemy inside
          if (e.effectType === "vampmist") {
            const vmHit = findHitEnemyRef(e.x, e.y);
            if (vmHit >= 0) {
              dmgEnemySilent(vmHit, 3 + dotBonus("vampiric mist"));
              setPlayerHP((p) => Math.min(100, p + 2));
            }
            return { ...e, ttl: e.ttl - 1 };
          }
          // Spore cloud: 2 DMG every tick while enemy is inside
          if (e.effectType === "sporecloud") {
            const scHit = findHitEnemyRef(e.x, e.y);
            if (scHit >= 0) dmgEnemySilent(scHit, 2 + dotBonus("spore cloud"));
            return { ...e, ttl: e.ttl - 1 };
          }
          // Croak beam: moves 1 tile left every 3 ticks, damages once per tile arrival
          if (e.effectType === "croakbeam") {
            if (e.ttl % 3 === 0) {
              const moved = {
                ...e,
                x: e.x - 1,
                ttl: e.ttl - 1,
                hasDamaged: false,
              };
              return moved;
            }
            return { ...e, ttl: e.ttl - 1 };
          }
          // ── ENEMY AI EFFECTS (move RIGHT toward player, damage player on contact) ──
          // e_sweep: sweeping attack (clawingsword/flying sword/swoop) — moves right 1 tile per tick
          if (e.effectType === "e_sweep") {
            if (blocks.some((bl) => bl.x === e.x && bl.y === e.y))
              return { ...e, ttl: 0 };
            return { ...e, x: e.x + 1, ttl: e.ttl - 1 };
          }
          // e_beam: row beam — moves right 1 tile every 2 ticks (slower sweep)
          if (e.effectType === "e_beam") {
            if (blocks.some((bl) => bl.x === e.x && bl.y === e.y))
              return { ...e, ttl: 0 };
            if (e.ttl % 2 === 0) return { ...e, x: e.x + 1, ttl: e.ttl - 1 };
            return { ...e, ttl: e.ttl - 1 };
          }
          // e_zone: lingering DOT zone on player grid — stays in place
          if (e.effectType === "e_zone") return { ...e, ttl: e.ttl - 1 };
          return { ...e, ttl: e.ttl - 1 };
        });
        return updated.filter((e) => {
          if (e.effectType === "flyingsword") {
            // Stop at walls
            if (blocks.some((bl) => bl.x === e.x && bl.y === e.y)) return false;
            const fh = findHitEnemyRef(e.x, e.y);
            if (fh >= 0) dmgEnemy(fh, 15 + cardBonus("flying sword"));
            return e.ttl > 0 && e.x >= 0;
          }
          if (e.effectType === "clawingsword") {
            if (blocks.some((bl) => bl.x === e.x && bl.y === e.y)) return false;
            const ch = findHitEnemyRef(e.x, e.y);
            if (ch >= 0) dmgEnemy(ch, 30 + cardBonus("clawingsword"));
            return e.ttl > 0 && e.x < GRID_SIZE * 2;
          }
          if (e.effectType === "ratpack") {
            const rh = findHitEnemyRef(e.x, e.y);
            if (rh >= 0) dmgEnemy(rh, 10 + cardBonus("rat pack"));
            return e.ttl > 0;
          }
          if (e.effectType === "ratstorm") {
            const rsh = findHitEnemyRef(e.x, e.y);
            if (rsh >= 0) {
              dmgEnemy(rsh, 10);
              return false;
            }
            return (
              e.ttl > 0 &&
              e.x >= 0 &&
              e.x < GRID_SIZE * 2 &&
              e.y >= 0 &&
              e.y < GRID_SIZE
            );
          }
          // Tadpole: 10 DMG on hit, despawn at left wall or on hit
          if (e.effectType === "tadpole") {
            if (blocks.some((bl) => bl.x === e.x && bl.y === e.y)) return false;
            const th = findHitEnemyRef(e.x, e.y);
            if (th >= 0) {
              dmgEnemy(th, 10);
              return false;
            }
            return e.ttl > 0 && e.x >= 0;
          }
          // Topple: 40 DMG on hit, despawn at left wall or on hit
          if (e.effectType === "topple") {
            if (blocks.some((bl) => bl.x === e.x && bl.y === e.y)) return false;
            const tph = findHitEnemyRef(e.x, e.y);
            if (tph >= 0) {
              dmgEnemy(tph, 40);
              return false;
            }
            return e.ttl > 0 && e.x >= 0;
          }
          // Vampiric mist: just check ttl
          if (e.effectType === "vampmist") return e.ttl > 0;
          // Broken wall: temporary obstacle, remove when expired and clean up the block
          if (e.effectType === "brokenwall") {
            if (e.ttl <= 0) {
              setBlocks((p) =>
                p.filter(
                  (bl) => !(bl.x === e.x && bl.y === e.y && bl.health === 999)
                )
              );
              return false;
            }
            return true;
          }
          // Croak beam: damage on tile arrival (when hasDamaged is false after a move)
          if (e.effectType === "croakbeam") {
            if (blocks.some((bl) => bl.x === e.x && bl.y === e.y)) return false;
            if (!e.hasDamaged) {
              const cbh = findHitEnemyRef(e.x, e.y);
              if (cbh >= 0) {
                dmgEnemy(cbh, 20);
                e.hasDamaged = true;
              }
            }
            return e.ttl > 0 && e.x >= 0;
          }
          // ── ENEMY AI EFFECT DAMAGE ──
          // e_sweep: sweeping projectile damages player on contact, despawns on hit or off-grid
          if (e.effectType === "e_sweep") {
            const px = playerPosRef.current.x + GRID_SIZE,
              py = playerPosRef.current.y;
            if (e.x === px && e.y === py && !e.hasDamaged) {
              const d = e.dmg ?? 15;
              setPlayerHP((p) => {
                const n = Math.max(0, p - d);
                playerHPRef.current = n;
                return n;
              });
              triggerPlayerAnim("hit", 350);
              e.hasDamaged = true;
              return false; // despawn on hit
            }
            return e.ttl > 0 && e.x < GRID_SIZE * 2;
          }
          // e_beam: sweeping beam damages player when reaching their column (doesn't despawn)
          if (e.effectType === "e_beam") {
            const px2 = playerPosRef.current.x + GRID_SIZE,
              py2 = playerPosRef.current.y;
            if (e.x === px2 && e.y === py2 && !e.hasDamaged) {
              const d2 = e.dmg ?? 20;
              setPlayerHP((p) => {
                const n = Math.max(0, p - d2);
                playerHPRef.current = n;
                return n;
              });
              triggerPlayerAnim("hit", 350);
              e.hasDamaged = true;
            }
            return e.ttl > 0 && e.x < GRID_SIZE * 2;
          }
          // e_zone: lingering zone damages player every 5 ticks if standing on it
          if (e.effectType === "e_zone") {
            const px3 = playerPosRef.current.x + GRID_SIZE,
              py3 = playerPosRef.current.y;
            if (e.x === px3 && e.y === py3 && e.ttl % 5 === 0) {
              const d3 = e.dmg ?? 3;
              setPlayerHP((p) => {
                const n = Math.max(0, p - d3);
                playerHPRef.current = n;
                return n;
              });
            }
            return e.ttl > 0;
          }
          return e.ttl > 0;
        });
      });

      // ── PLAYER BULLETS (quickdraw 2× speed, ricochet bounce) ──
      setPlayerBullets((prev) => {
        const moved = prev.map((b) => {
          if (b.isVRat) return { ...b, x: b.x - 1, y: b.y + (b.vDir || 0) };
          if (b.isRat) {
            const rdy = Math.floor(Math.random() * 3) - 1;
            return {
              ...b,
              x: b.x - 1,
              y: Math.max(0, Math.min(GRID_SIZE - 1, b.y + rdy)),
            };
          }
          if (b.isQuickdraw) return { ...b, x: b.x - 2 }; // 2× speed
          if (b.isRicochet && b.hasBounced) return { ...b, x: b.x + 1 }; // bouncing back right
          return { ...b, x: b.x - 1 };
        });
        return moved.filter((b) => {
          // Check hit against all enemies
          const prevBulletX =
            b.isRicochet && b.hasBounced
              ? b.x - 1
              : b.isQuickdraw
              ? b.x + 2
              : b.x + 1;
          const checkHit = (
            posRef: { current: Position },
            prevRef: { current: Position }
          ) => {
            const opp = posRef.current;
            const prevOpp = prevRef.current;
            return (
              (b.x === opp.x && b.y === opp.y) ||
              (b.x === prevOpp.x && b.y === prevOpp.y) ||
              (prevBulletX === opp.x && b.y === opp.y)
            );
          };
          let bulletHitSlot = -1;
          if (opponentHP > 0 && checkHit(opponentPosRef, prevOpponentPosRef))
            bulletHitSlot = 0;
          else if (
            currentEnemy2 &&
            opponent2HP > 0 &&
            checkHit(opponent2PosRef, prevOpponent2PosRef)
          )
            bulletHitSlot = 1;
          if (bulletHitSlot >= 0) {
            let dmg = baseBulletDmg;
            if (b.chargePower) {
              dmg = b.chargePower * 10;
              setMalipoleBulletHits((p) => {
                const n = p + 1;
                if (n >= 3) {
                  setMalipoleFrenzyActive(true);
                  setMalipoleFrenzyTimer(50);
                  setMalipoleBulletHits(0);
                }
                return n;
              });
            } else if (b.isRat) dmg = 20;
            else if (b.isVRat) dmg = 20;
            else if (b.isQuickdraw) dmg = 25;
            else if (b.isRicochet) dmg = 15;
            else if (b.isThorn) dmg = 30;
            else if (b.isPixie) dmg = 5;
            if (malipoleFrenzyActive && selectedCharacter.name === "Malipole")
              dmg = Math.min(50, Math.floor(dmg * (Math.random() * 4 + 1)));
            dmgEnemy(bulletHitSlot, dmg);
            // Pixie lifesteal: heal 2 HP per 4 damage on basic shots
            if (
              selectedCharacter.name === "Pixie" &&
              !b.isRat &&
              !b.isVRat &&
              !b.isQuickdraw &&
              !b.isRicochet &&
              !b.isThorn &&
              !b.chargePower &&
              !b.isPixie
            ) {
              setPlayerHP((p) =>
                Math.min(100, p + Math.max(1, Math.floor(dmg / 2)))
              );
            }
            return false;
          }
          // Quickdraw skip-over check
          if (b.isQuickdraw) {
            const qdHit = findHitEnemyRef(b.x + 1, b.y);
            if (qdHit >= 0) {
              dmgEnemy(qdHit, 25);
              return false;
            }
          }
          // Ricochet: bounce at left wall if hasn't bounced yet
          if (b.isRicochet && !b.hasBounced && b.x < 0) {
            return false; // remove and spawn bounced version
          }
          // Bounced ricochet exits right side
          if (b.isRicochet && b.hasBounced && b.x >= GRID_SIZE * 2)
            return false;
          // V-rats despawn at any boundary
          if (b.isVRat && (b.x < 0 || b.y < 0 || b.y >= GRID_SIZE))
            return false;
          // Player bullets damage enemy turrets
          const hitEnemyTurret = turrets.find(
            (t) => t.owner === "enemy" && t.x === b.x && t.y === b.y
          );
          if (hitEnemyTurret) {
            const bDmg = b.isPixie
              ? 5
              : b.chargePower
              ? b.chargePower * 10
              : b.isRat
              ? 20
              : b.isQuickdraw
              ? 25
              : b.isRicochet
              ? 15
              : b.isThorn
              ? 30
              : baseBulletDmg;
            setTurrets((p) =>
              p
                .map((t) =>
                  t.x === hitEnemyTurret.x &&
                  t.y === hitEnemyTurret.y &&
                  t.owner === "enemy"
                    ? { ...t, hp: t.hp - bDmg }
                    : t
                )
                .filter((t) => t.hp > 0)
            );
            return false;
          }
          // Player bullets stopped by blocks
          const playerBlockHit = blocks.find(
            (bl) => bl.x === b.x && bl.y === b.y
          );
          if (playerBlockHit) {
            if (playerBlockHit.health < 999)
              setBlocks((p) =>
                p.filter(
                  (bl) => bl.x !== playerBlockHit.x || bl.y !== playerBlockHit.y
                )
              );
            return false;
          }
          return b.x >= 0 && b.x < GRID_SIZE * 2;
        });
      });

      // Handle ricochet bounce spawn separately (add bounced bullets)
      setPlayerBullets((prev) => {
        const bouncedNew: Bullet[] = [];
        const remaining = prev.filter((b) => {
          if (b.isRicochet && !b.hasBounced && b.x <= 0) {
            bouncedNew.push({
              x: 0,
              y: b.y,
              direction: "right",
              isRicochet: true,
              hasBounced: true,
            });
            return false;
          }
          return true;
        });
        return [...remaining, ...bouncedNew];
      });

      // ── OPPONENT BULLETS (thorn shield retaliation) ──
      setOpponentBullets((prev) =>
        prev
          .map((b) => ({ ...b, x: b.x + 1 }))
          .filter((b) => {
            const hb = blocks.find((bl) => bl.x === b.x && bl.y === b.y);
            if (hb) {
              if (hb.health < 999)
                setBlocks((p) =>
                  p.filter((bl) => bl.x !== hb.x || bl.y !== hb.y)
                );
              return false;
            }
            // Opponent bullets damage player turrets
            const hitTurret = turrets.find(
              (t) => t.owner === "player" && t.x === b.x && t.y === b.y
            );
            if (hitTurret) {
              setTurrets((p) =>
                p
                  .map((t) =>
                    t.x === hitTurret.x &&
                    t.y === hitTurret.y &&
                    t.owner === "player"
                      ? { ...t, hp: t.hp - 2 }
                      : t
                  )
                  .filter((t) => t.hp > 0)
              );
              return false;
            }
            if (b.x === playerPos.x + GRID_SIZE && b.y === playerPos.y) {
              if (thornShieldActive) {
                setThornShieldActive(false);
                // Fire thorn bullet back dealing 30 DMG
                setPlayerBullets((p) => [
                  ...p,
                  {
                    x: playerPos.x + GRID_SIZE - 1,
                    y: playerPos.y,
                    direction: "left",
                    isThorn: true,
                  },
                ]);
                return false;
              }
              setPlayerHP((p) => Math.max(0, p - 2));
              triggerPlayerAnim("hit", 350);
              return false;
            }
            return b.x >= 0 && b.x < GRID_SIZE * 2;
          })
      );

      // ── TURRETS: shoot and handle damage ──
      setTurrets((prev) => {
        const updated = prev.map((t) => ({
          ...t,
          shootTimer: t.shootTimer + 1,
          moveTimer: t.isMushroom ? (t.moveTimer || 0) + 1 : t.moveTimer,
        }));
        // Mushroom turrets: move every 40 ticks, leave poison trail
        updated.forEach((t) => {
          if (t.isMushroom && (t.moveTimer || 0) >= 40 && t.hp > 0) {
            t.moveTimer = 0;
            // Leave poison tile at current position - track owner for damage targeting
            const poisonType =
              t.owner === "player" ? "mushpoison_p" : "mushpoison_e";
            setLilyPadTraps((p) => [
              ...p,
              { x: t.x, y: t.y, ttl: 100, effectType: poisonType },
            ]);
            // Move toward opponent
            if (t.owner === "player") {
              t.x = Math.max(0, t.x - 1);
            } else {
              t.x = Math.min(GRID_SIZE * 2 - 1, t.x + 1);
            }
          }
        });
        updated.forEach((t) => {
          if (t.isMushroom) return; // Mushroom turrets don't shoot
          if (t.shootTimer >= 20 && t.hp > 0) {
            t.shootTimer = 0;
            if (t.owner === "player") {
              setPlayerBullets((p) => [
                ...p,
                {
                  x: t.x - 1,
                  y: t.y,
                  direction: "left" as const,
                  isPixie: true,
                },
              ]);
            } else {
              setOpponentBullets((p) => [
                ...p,
                { x: t.x + 1, y: t.y, direction: "right" as const },
              ]);
            }
          }
        });
        return updated.filter((t) => t.hp > 0);
      });
      setBeams((p) =>
        p.map((b) => ({ ...b, ttl: b.ttl - 1 })).filter((b) => b.ttl > 0)
      );
      setSlash((p) =>
        p.map((s) => ({ ...s, ttl: s.ttl - 1 })).filter((s) => s.ttl > 0)
      );

      setDelayBombs((prev) => {
        const ub = prev.map((b) => ({ ...b, timer: b.timer - 1 }));
        const ne: TimedEffect[] = [];
        ub.forEach((b) => {
          if (b.timer <= 0) {
            [
              { x: b.x, y: b.y },
              { x: b.x - 1, y: b.y },
              { x: b.x + 1, y: b.y },
              { x: b.x, y: b.y - 1 },
              { x: b.x, y: b.y + 1 },
              { x: b.x - 1, y: b.y - 1 },
              { x: b.x - 1, y: b.y + 1 },
              { x: b.x + 1, y: b.y - 1 },
              { x: b.x + 1, y: b.y + 1 },
            ].forEach((t) => {
              ne.push({ ...t, ttl: 5, effectType: "explosion" });
              const dbHit = findHitEnemyRef(t.x, t.y);
              if (dbHit >= 0)
                dmgEnemy(dbHit, t.x === b.x && t.y === b.y ? 40 : 10);
            });
          }
        });
        setExplosionEffects((p) => [...p, ...ne]);
        return ub.filter((b) => b.timer > 0);
      });

      // ── BOOMERANG: 4 tiles forward → shift 1 lane → straight back ──
      // Player must intercept the return lane to catch (→ hand). Miss = deck. OOB = deck.
      if (boomerang) {
        let nx = boomerang.x,
          ny = boomerang.y,
          np = boomerang.phase,
          nd = boomerang.distanceTraveled,
          nt = boomerang.ttl - 1;
        const bm = selectedCharacter.moves.find((m) => m.name === "boomerang");
        if (np === "forward") {
          nx -= 1;
          nd += 1;
          // Out of bounds left — fired from front tile, can't return
          if (nx < 0) {
            if (bm) setDeck((d) => [...d, bm]);
            setBoomerang(null);
          } else if (nd >= 4) {
            // Done traveling forward — shift 1 lane (y+1 if room, else y-1)
            ny = ny < GRID_SIZE - 1 ? ny + 1 : ny - 1;
            np = "backward";
            nd = 0;
            setBoomerang({
              x: nx,
              y: ny,
              phase: np,
              distanceTraveled: nd,
              ttl: nt,
            });
          } else {
            // Hit check while traveling forward
            {
              const bmHit = findHitEnemyRef(nx, ny);
              if (bmHit >= 0) dmgEnemy(bmHit, 30 + cardBonus("boomerang"));
            }
            setBoomerang({
              x: nx,
              y: ny,
              phase: np,
              distanceTraveled: nd,
              ttl: nt,
            });
          }
        } else {
          // Backward: straight right, 1 tile/tick at the shifted lane
          nx += 1;
          nd += 1;
          // Hit check in enemy territory
          {
            const bmHit = findHitEnemyRef(nx, ny);
            if (bmHit >= 0) dmgEnemy(bmHit, 30 + cardBonus("boomerang"));
          }
          // Catch check: is the player standing on this tile?
          const playerAbsX = playerPosRef.current.x + GRID_SIZE;
          if (nx === playerAbsX && ny === playerPosRef.current.y) {
            // Caught! Return to hand
            if (bm) setHand((ph) => [...ph, bm]); // Always return to hand on catch, even over max
            setBoomerang(null);
          } else if (nx >= GRID_SIZE * 2 || nt <= 0) {
            // Missed or timed out — goes off the right edge, return to deck
            if (bm) setDeck((d) => [...d, bm]);
            setBoomerang(null);
          } else {
            setBoomerang({
              x: nx,
              y: ny,
              phase: np,
              distanceTraveled: nd,
              ttl: nt,
            });
          }
        }
      }

      if (lasso) {
        const lh = findHitEnemyRef(lasso.x, lasso.y);
        if (lh >= 0) {
          dmgEnemy(lh, 15 + cardBonus("lasso"));
          const _lr = lh === 0 ? opponentPosRef : opponent2PosRef;
          const lassoPos = { ..._lr.current, x: GRID_SIZE - 1 };
          if (lh === 0) {
            setOpponentPos(lassoPos);
            opponentPosRef.current = lassoPos;
            setOpponentStunned(15);
          } else {
            setOpponent2Pos(lassoPos);
            opponent2PosRef.current = lassoPos;
            setOpponent2Stunned(15);
          }
        }
        setLasso(null);
      }
      if (opponentStunned > 0) setOpponentStunned((p) => p - 1);
      if (opponent2Stunned > 0) setOpponent2Stunned((p) => p - 1);
      beams.forEach((b) => {
        // Beams hit entire row — but stopped by walls
        const beamBlockedAt = (row: number): number => {
          for (let bx = GRID_SIZE - 1; bx >= 0; bx--) {
            if (blocks.some((bl) => bl.x === bx && bl.y === row)) return bx;
          }
          return -1;
        };
        const blockX = beamBlockedAt(b.y);
        if (
          opponentHP > 0 &&
          b.y === opponentPosRef.current.y &&
          opponentPosRef.current.x < GRID_SIZE &&
          (blockX < 0 || opponentPosRef.current.x < blockX)
        )
          dmgEnemy(0, 20 + cardBonus("beam"));
        if (
          currentEnemy2 &&
          opponent2HP > 0 &&
          b.y === opponent2PosRef.current.y &&
          opponent2PosRef.current.x < GRID_SIZE &&
          (blockX < 0 || opponent2PosRef.current.x < blockX)
        )
          dmgEnemy(1, 20 + cardBonus("beam"));
      });
      if (punch) {
        const ph = findHitEnemyRef(punch.x, punch.y);
        if (ph >= 0) dmgEnemy(ph, 40 + cardBonus("punch"));
        setPunch(null);
      }
      slash.forEach((s) => {
        const sh = findHitEnemyRef(s.x, s.y);
        if (sh >= 0) dmgEnemy(sh, 30 + cardBonus("slash"));
      });
      bombs.forEach((b) => {
        const bh = findHitEnemyRef(b.x, b.y);
        if (bh >= 0) {
          dmgEnemy(bh, 40 + cardBonus("bomb"));
          setBombs((p) => p.filter((bb) => bb !== b));
        }
      });
      // ── SILENCE BOMB detonation ──
      setExplosionEffects((prev) => {
        const newEfx: TimedEffect[] = [];
        const kept = prev.filter((e) => {
          if (e.effectType === "silencebomb" && e.ttl > 1) {
            // Player-placed bomb (on enemy side): check if enemy stepped on it
            if (e.x < GRID_SIZE) {
              const sbSlot = findHitEnemyRef(e.x, e.y);
              if (sbSlot >= 0) {
                dmgEnemy(sbSlot, 20);
                setSilenceTimer(60);
                newEfx.push({
                  x: e.x,
                  y: e.y,
                  ttl: 5,
                  effectType: "explosion",
                });
                return false;
              }
            }
            // Enemy-placed bomb (on player side): check if player stepped on it
            if (
              e.x >= GRID_SIZE &&
              playerPosRef.current.x === e.x &&
              playerPosRef.current.y === e.y
            ) {
              setPlayerHP((h) => Math.max(0, h - 20));
              setEnemySilenceTimer(60);
              newEfx.push({ x: e.x, y: e.y, ttl: 5, effectType: "explosion" });
              return false;
            }
          }
          return true;
        });
        return [...kept, ...newEfx];
      });
      // ── ABSORB POISON: heal on poison tiles (explosionEffects) ──
      if (absorbPoisonTimer > 0) {
        const pWorldX = playerPosRef.current.x + GRID_SIZE;
        const pWorldY = playerPosRef.current.y;
        setExplosionEffects((prev) =>
          prev.map((e) => {
            if (
              (e.effectType === "poisontile" ||
                e.effectType === "poisontrap" ||
                e.effectType === "poisononly" ||
                e.effectType === "mushpoison_e") &&
              pWorldX === e.x &&
              pWorldY === e.y
            ) {
              setPlayerHP((h) => Math.min(100, h + 10));
              return { ...e, ttl: 0 }; // Consume the tile
            }
            return e;
          })
        );
      }
      if (tractorBeam) {
        // Tractor beam pulls all enemies in its row
        if (
          opponentHP > 0 &&
          opponentPosRef.current.y === tractorBeam.y &&
          opponentPosRef.current.x < tractorBeam.x
        ) {
          dmgEnemySilent(0, 10);
          const nx2 = Math.min(opponentPosRef.current.x + 2, tractorBeam.x - 1);
          if (
            !blocks.some(
              (bl) => bl.x === nx2 && bl.y === opponentPosRef.current.y
            )
          ) {
            const tbPos = { ...opponentPosRef.current, x: nx2 };
            setOpponentPos(tbPos);
            opponentPosRef.current = tbPos;
          }
        }
        if (
          currentEnemy2 &&
          opponent2HP > 0 &&
          opponent2PosRef.current.y === tractorBeam.y &&
          opponent2PosRef.current.x < tractorBeam.x
        ) {
          dmgEnemySilent(1, 10);
          const nx2b = Math.min(
            opponent2PosRef.current.x + 2,
            tractorBeam.x - 1
          );
          if (
            !blocks.some(
              (bl) => bl.x === nx2b && bl.y === opponent2PosRef.current.y
            )
          ) {
            const tbPos2 = { ...opponent2PosRef.current, x: nx2b };
            setOpponent2Pos(tbPos2);
            opponent2PosRef.current = tbPos2;
          }
        }
        setTractorBeam(null);
      }
      if (playerHP <= 0) setGameOver(true);
      // Victory check
      if (sequential) {
        // Sequential (trainer): transition to next enemy when current dies
        if (opponentHP <= 0 && !gameOver && !waveTransitioning.current) {
          if (waveIdx < enemyWave.length - 1) {
            waveTransitioning.current = true;
            const nextIdx = waveIdx + 1;
            const next = enemyWave[nextIdx];
            setWaveIdx(nextIdx);
            setOpponentHP(next.hp);
            setOpponentMaxHP(next.hp);
            const wp = {
              x: Math.floor(Math.random() * GRID_SIZE),
              y: Math.floor(Math.random() * GRID_SIZE),
            };
            setOpponentPos(wp);
            opponentPosRef.current = wp;
            setOpponentBullets([]);
            setTurrets((prev) => prev.filter((t) => t.owner === "player"));
            setOpponentStunned(0);
            setPoisonDotTimer(0);
            setEnemyMana(5);
            setEnemyBuffTimer(0);
            setEnemyDotTimer(0);
            setTimeout(() => {
              waveTransitioning.current = false;
            }, 200);
          } else {
            setGameOver(true);
          }
        }
      } else {
        // Simultaneous (wild): all enemies must be dead
        const allDead = opponentHP <= 0 && (!currentEnemy2 || opponent2HP <= 0);
        if (allDead && !gameOver) setGameOver(true);
      }
    }, GAME_TICK);
    return () => clearInterval(gl);
  });

  useEffect(() => {
    if (gameOver && !battleEndRef.current) {
      battleEndRef.current = true;
      const hp = playerHPRef.current;
      setTimeout(
        () => onBattleEnd(hp <= 0 ? "lose" : "win", hp <= 0 ? 100 : hp),
        2000
      );
    }
  }, [gameOver, onBattleEnd]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (
        e.key === " " &&
        (selectedCharacter.name === "Rat King" ||
          selectedCharacter.name === "Malipole") &&
        isCharging
      )
        return;
      switch (e.key) {
        case "ArrowUp":
          movePlayer(0, -1);
          break;
        case "ArrowDown":
          movePlayer(0, 1);
          break;
        case "ArrowLeft":
          movePlayer(-1, 0);
          break;
        case "ArrowRight":
          movePlayer(1, 0);
          break;
        case " ":
          if (
            selectedCharacter.name === "Rat King" ||
            selectedCharacter.name === "Malipole" ||
            selectedCharacter.name === "Mushroom"
          )
            setIsCharging(true);
          else fireBullet(true);
          break;
        case "1":
          if (hand[0]) useMove(hand[0].name);
          break;
        case "2":
          if (hand[1]) useMove(hand[1].name);
          break;
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (
        e.key === " " &&
        (selectedCharacter.name === "Rat King" ||
          selectedCharacter.name === "Malipole" ||
          selectedCharacter.name === "Mushroom") &&
        isCharging
      )
        fireBullet(true);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [
    gameOver,
    movePlayer,
    fireBullet,
    useMove,
    hand,
    isCharging,
    selectedCharacter,
  ]);

  // ── BATTLE RENDER ──
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#e3decb",
        fontFamily: "'Courier New', monospace",
        overflow: "hidden",
        userSelect: "none",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr 350px",
          gridTemplateRows: "80px 1fr 280px",
          height: "100%",
          padding: "2rem",
          gap: "1.5rem",
        }}
      >
        <header
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "2px solid #080808",
            paddingBottom: "1rem",
          }}
        >
          <div style={{ width: 400 }} />
          <div
            style={{
              flexGrow: 1,
              textAlign: "center",
              fontSize: "0.7rem",
              opacity: 0.6,
              paddingTop: "1rem",
            }}
          >
            SECTOR: BATTLEFIELD // PROTOCOL: COMBAT
          </div>
          <div style={{ textAlign: "right" }}>
            <h1
              style={{
                fontFamily: "Impact, sans-serif",
                fontSize: "3rem",
                lineHeight: "0.8",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "-2px",
                transform: "scaleY(0.9)",
              }}
            >
              COMBAT
            </h1>
            <span
              style={{
                display: "block",
                fontSize: "0.7rem",
                letterSpacing: "4px",
                borderTop: "1px solid #080808",
                marginTop: 4,
                paddingTop: 2,
              }}
            >
              ACTIVE
            </span>
          </div>
        </header>
        <aside
          style={{
            gridColumn: 3,
            gridRow: 2,
            display: "flex",
            flexDirection: "column",
            gap: "2rem",
          }}
        >
          <div style={{ borderLeft: "4px solid #080808", paddingLeft: "1rem" }}>
            <h3
              style={{
                fontFamily: "Impact, sans-serif",
                fontSize: "1.5rem",
                margin: "0 0 0.5rem 0",
                textTransform: "uppercase",
              }}
            >
              OPERATIVE
            </h3>
            {[
              ["STATUS", playerHP > 50 ? "OPERATIONAL" : "CRITICAL"],
              [
                "HP",
                "[" +
                  "|".repeat(Math.floor(playerHP / 10)) +
                  "-".repeat(10 - Math.floor(playerHP / 10)) +
                  "]",
              ],
              [
                "MANA",
                "[" +
                  "|".repeat(Math.floor(playerMana)) +
                  "-".repeat(10 - Math.floor(playerMana)) +
                  "]",
              ],
              ["DECK", `${deck.length} REMAINING`],
              [
                "CLASS",
                `${selectedCharacter.name.toUpperCase()} ${
                  selectedCharacter.emoji
                }`,
              ],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  marginBottom: "0.4rem",
                  borderBottom: "1px dashed #080808",
                  paddingBottom: 2,
                }}
              >
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
            {thornShieldActive && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#4d9a2a",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                🛡 THORN SHIELD ACTIVE
              </div>
            )}
            {poisonDotTimer > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#99ff00",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                ☠ POISON ACTIVE ({Math.ceil(poisonDotTimer / 10)}s)
              </div>
            )}
            {manaBoostTimer > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#44aaff",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                ⚡ MANA BOOST ({Math.ceil(manaBoostTimer / 20)}s)
              </div>
            )}
            {playerFrozenTimer > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "40%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,100,255,0.8)",
                  color: "#fff",
                  padding: "4px 12px",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                  zIndex: 30,
                }}
              >
                ❄️ FROZEN ({Math.ceil(playerFrozenTimer / 20)}s)
              </div>
            )}
            {silenceTimer > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#c4a060",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                🔇 ENEMY SILENCED ({Math.ceil(silenceTimer / 20)}s)
              </div>
            )}
            {enemySilenceTimer > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#cc3366",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                🔇 YOU ARE SILENCED ({Math.ceil(enemySilenceTimer / 20)}s)
              </div>
            )}
            {absorbPoisonTimer > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#44cc88",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                🍄 ABSORB POISON ({Math.ceil(absorbPoisonTimer / 20)}s)
              </div>
            )}
            {zoneStealTimer > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#4488ff",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                🏴 ZONE STEAL ({Math.ceil(zoneStealTimer / 20)}s)
              </div>
            )}
          </div>
          <div
            style={{
              borderLeft: "4px solid #080808",
              paddingLeft: "1rem",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                marginBottom: "0.5rem",
                textDecoration: "underline",
              }}
            >
              LOG_OUTPUT:
            </div>
            <div
              style={{ fontSize: "0.6rem", lineHeight: "1.4", opacity: 0.8 }}
            >
              {gameOver ? (
                <>
                  &gt; COMBAT ENDED
                  <br />
                  &gt;{" "}
                  {playerHP <= 0
                    ? "OPERATIVE DEFEATED"
                    : `${enemyWave.length} HOSTILES NEUTRALIZED`}
                  <br />
                  &gt; RETURNING TO OVERWORLD...
                </>
              ) : (
                <>
                  &gt; ARROWS: MOVE
                  <br />
                  &gt; SPACE: FIRE/CHARGE
                  <br />
                  &gt; 1,2: USE ABILITY
                  <br />
                  {sequential ? (
                    <>
                      &gt; WAVE: {waveIdx + 1}/{enemyWave.length}
                      <br />
                    </>
                  ) : (
                    <>
                      &gt; HOSTILES: {enemyWave.length}
                      <br />
                    </>
                  )}
                  {isCharging && selectedCharacter.name !== "Mushroom" && (
                    <>
                      &gt; CHARGING...{Math.floor(chargeTime / 10)}
                      <br />
                    </>
                  )}
                  {isCharging && selectedCharacter.name === "Mushroom" && (
                    <>
                      &gt; 🍄 GROWING TURRET...{" "}
                      {Math.min(100, Math.floor((chargeTime / 60) * 100))}%
                      <br />
                    </>
                  )}
                  {giantStrikeCooldown > 0 && (
                    <>
                      &gt; ⏳ STRIKE COOLDOWN (
                      {Math.ceil(giantStrikeCooldown / 20)}s)
                      <br />
                    </>
                  )}
                  {malipoleFrenzyActive && (
                    <>
                      &gt; FRENZY ACTIVE!
                      <br />
                    </>
                  )}
                  {enemyDotTimer > 0 && (
                    <>
                      &gt; ☠ TAKING DOT ({Math.ceil(enemyDotTimer / 10)}s)
                      <br />
                    </>
                  )}
                  {enemyCardMsg && (
                    <>
                      &gt; ⚡ ENEMY USED: {enemyCardMsg}
                      <br />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>
        <main style={{ gridColumn: 2, gridRow: 2, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <img
              src={BATTLE_BG}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.35,
                zIndex: 0,
              }}
            />
            <Canvas
              shadows
              camera={{ position: [5, 8, 8], fov: 50 }}
              gl={{ antialias: true }}
            >
              <GameScene3D
                playerPos={playerPos}
                opponentPos={opponentPos}
                playerBullets={playerBullets}
                opponentBullets={opponentBullets}
                blocks={blocks}
                turrets={turrets}
                beams={beams}
                explosionEffects={explosionEffects}
                bombs={bombs}
                delayBombs={delayBombs}
                boomerang={boomerang}
                tractorBeam={tractorBeam}
                selectedCharacter={selectedCharacter}
                opponentStunned={opponentStunned}
                isCharging={isCharging}
                malipoleFrenzyActive={malipoleFrenzyActive}
                lilyPadTraps={lilyPadTraps}
                tongueWhipActive={tongueWhipActive}
                slash={slash}
                punch={punch}
                lasso={lasso}
                enemyEmoji={currentEnemy?.emoji ?? "👾"}
                playerAnimState={playerAnimState}
                opponentAnimState={opponentAnimState}
                enemy2Pos={currentEnemy2 ? opponent2Pos : undefined}
                enemy2Emoji={currentEnemy2?.emoji}
                enemy2Stunned={opponent2Stunned}
                enemy2AnimState={opponent2AnimState}
                enemy2HP={opponent2HP}
                zoneStealTimer={zoneStealTimer}
                zoneStealOwner={zoneStealOwner}
                zoneStealCol={zoneStealCol}
              />
              <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={6}
                maxDistance={20}
                maxPolarAngle={Math.PI / 2.5}
                target={[GRID_SIZE, 0, GRID_SIZE / 2]}
              />
            </Canvas>
          </div>
        </main>
        <aside
          style={{
            gridColumn: 1,
            gridRow: 2,
            border: "2px solid #080808",
            padding: "1rem",
            background: "#f5f0e1",
            boxShadow: "8px 8px 0 rgba(0,0,0,0.1)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -2,
              left: -2,
              width: 20,
              height: 20,
              borderTop: "4px solid #080808",
              borderLeft: "4px solid #080808",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              borderBottom: "4px solid #080808",
              borderRight: "4px solid #080808",
            }}
          />
          <div
            style={{
              width: "100%",
              height: 120,
              border: "2px solid #080808",
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#ddd",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {(() => {
              const en = currentEnemy?.emoji ?? "👾";
              const mn = getMonsterName(en);
              const sp = mn ? MONSTER_SPRITES[mn] : null;
              return sp ? (
                <img
                  src={sp.idle}
                  alt={mn || ""}
                  style={{
                    width: 100,
                    height: 100,
                    imageRendering: "pixelated",
                  }}
                />
              ) : (
                <span style={{ fontSize: 48 }}>{en}</span>
              );
            })()}
          </div>
          <div style={{ fontSize: "0.6rem", letterSpacing: "2px" }}>
            THREAT LEVEL:{" "}
            {opponentHP > opponentMaxHP / 2
              ? "HIGH"
              : opponentHP > 0
              ? "CRITICAL"
              : "ELIMINATED"}
          </div>
          {sequential && (
            <div
              style={{
                fontSize: "0.6rem",
                letterSpacing: "2px",
                color: "#cc3333",
                fontWeight: "bold",
                marginTop: 2,
              }}
            >
              ⚔ TRAINER BATTLE ({waveIdx + 1}/{enemyWave.length})
            </div>
          )}
          {enemyBuffTimer > 0 && (
            <div
              style={{
                fontSize: "0.6rem",
                letterSpacing: "2px",
                color: "#cc6600",
                fontWeight: "bold",
                marginTop: 2,
                animation: "blink 1s infinite",
              }}
            >
              ⚡ BUFFED!
            </div>
          )}
          {enemyCardMsg && (
            <div
              style={{
                fontSize: "0.7rem",
                letterSpacing: "2px",
                color: "#ff4444",
                fontWeight: "bold",
                marginTop: 2,
                animation: "blink 0.5s 3",
              }}
            >
              ⚡ {enemyCardMsg}!
            </div>
          )}
          {opponentHP > 0 && opponentHP <= 20 && (
            <div
              style={{
                fontSize: "0.7rem",
                letterSpacing: "2px",
                color: "#6644aa",
                fontWeight: "bold",
                marginTop: 4,
                animation: "blink 1s infinite",
              }}
            >
              🪤 CATCHABLE!
            </div>
          )}
          <h2
            style={{
              fontFamily: "Impact, sans-serif",
              fontSize: "1.6rem",
              margin: "0.3rem 0",
              textTransform: "uppercase",
              opacity: opponentHP <= 0 ? 0.3 : 1,
            }}
          >
            {currentEnemy?.type?.toUpperCase() ?? "ENEMY"}{" "}
            {currentEnemy?.emoji ?? "👾"}
          </h2>
          {currentEnemy?.deck && (
            <div
              style={{
                fontSize: "0.5rem",
                opacity: 0.5,
                lineHeight: 1.3,
                marginBottom: "0.3rem",
              }}
            >
              DECK: {currentEnemy.deck.join(" · ")}
            </div>
          )}
          {currentEnemy2 && (
            <div
              style={{
                marginTop: "0.8rem",
                borderTop: "1px dashed #080808",
                paddingTop: "0.5rem",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 60,
                  border: "1px solid #080808",
                  marginBottom: "0.3rem",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#ddd",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {(() => {
                  const en = currentEnemy2?.emoji ?? "👾";
                  const mn = getMonsterName(en);
                  const sp = mn ? MONSTER_SPRITES[mn] : null;
                  return sp ? (
                    <img
                      src={sp.idle}
                      alt={mn || ""}
                      style={{
                        width: 50,
                        height: 50,
                        imageRendering: "pixelated",
                        opacity: opponent2HP <= 0 ? 0.2 : 1,
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 28,
                        opacity: opponent2HP <= 0 ? 0.2 : 1,
                      }}
                    >
                      {en}
                    </span>
                  );
                })()}
              </div>
              <h3
                style={{
                  fontFamily: "Impact, sans-serif",
                  fontSize: "1.2rem",
                  margin: "0.2rem 0",
                  textTransform: "uppercase",
                  opacity: opponent2HP <= 0 ? 0.3 : 1,
                }}
              >
                {currentEnemy2?.type?.toUpperCase()} {currentEnemy2?.emoji}
              </h3>
              <div style={{ display: "flex", gap: 2, marginBottom: "0.3rem" }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      background:
                        i < Math.ceil((opponent2HP / opponent2MaxHP) * 10)
                          ? "#cc3333"
                          : "#ddd",
                      border: "1px solid #080808",
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: "0.65rem" }}>
                HP: {opponent2HP}/{opponent2MaxHP}{" "}
                {opponent2HP > 0 && opponent2HP <= 20 ? "🪤" : ""}
              </div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: "0.5rem",
              marginTop: "0.5rem",
            }}
          >
            {enemyWave.map((e, i) => {
              const dead = sequential
                ? i < waveIdx || (i === waveIdx && opponentHP <= 0)
                : i === 0
                ? opponentHP <= 0
                : opponent2HP <= 0;
              return (
                <div
                  key={i}
                  style={{
                    width: 24,
                    height: 24,
                    border:
                      sequential && i === waveIdx
                        ? "2px solid #cc3333"
                        : "1px solid #080808",
                    background: dead ? "#4d9a2a" : "#ffcc00",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.7rem",
                  }}
                >
                  {dead ? "✓" : e.emoji}
                </div>
              );
            })}
          </div>
          <div
            style={{
              height: 2,
              background:
                "repeating-linear-gradient(90deg, #080808 0, #080808 10px, transparent 10px, transparent 20px)",
              marginBottom: "1rem",
            }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: "1rem",
            }}
          >
            <div
              style={{
                background: "#eee",
                padding: 4,
                border: "1px solid #000",
              }}
            >
              <div style={{ fontSize: "0.5rem" }}>HP</div>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
                {opponentHP}
              </div>
            </div>
            <div
              style={{
                background: "#eee",
                padding: 4,
                border: "1px solid #000",
              }}
            >
              <div style={{ fontSize: "0.5rem" }}>AMMO</div>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
                {MAX_SHOTS - opponentBullets.length}
              </div>
            </div>
          </div>
        </aside>
        <footer
          style={{
            gridColumn: "1 / -1",
            gridRow: 3,
            display: "flex",
            alignItems: "stretch",
            gap: "1rem",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", gap: "1rem", flexGrow: 1 }}>
            {hand.map((move, index) => {
              const isCatch = move.name === "catch";
              const canUse =
                playerMana >= move.manaCost && (!isCatch || !catchAnim);
              return (
                <div
                  key={index}
                  onClick={() => useMove(move.name)}
                  style={{
                    width: 220,
                    background: isCatch ? "#e8e0f0" : "white",
                    border: `2px solid ${isCatch ? "#6644aa" : "#080808"}`,
                    boxShadow: `6px 6px 0 ${
                      isCatch ? "rgba(102,68,170,0.3)" : "rgba(0,0,0,0.2)"
                    }`,
                    cursor: canUse ? "pointer" : "not-allowed",
                    opacity: canUse ? 1 : 0.5,
                    transition: "all 0.1s",
                    padding: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onMouseEnter={(e) => {
                    if (canUse) {
                      e.currentTarget.style.transform = "translateY(-8px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: 60,
                      background: isCatch ? "#3a2266" : "#1a1a1a",
                      marginBottom: "0.5rem",
                      border: "1px solid #080808",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "Impact, sans-serif",
                        fontSize: "2rem",
                        color: "#d4d0c8",
                      }}
                    >
                      {isCatch ? "🪤" : move.manaCost}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.55rem",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      opacity: 0.7,
                      marginBottom: "0.25rem",
                      color: isCatch ? "#6644aa" : "inherit",
                    }}
                  >
                    {isCatch ? "CAPTURE" : "ABILITY"}
                  </span>
                  <div
                    style={{
                      fontFamily: "Impact, sans-serif",
                      fontSize: "1.2rem",
                      textTransform: "uppercase",
                      marginBottom: "0.5rem",
                      letterSpacing: "1px",
                      color: isCatch ? "#6644aa" : "inherit",
                    }}
                  >
                    {move.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      lineHeight: "1.3",
                      marginBottom: "0.5rem",
                      flexGrow: 1,
                    }}
                  >
                    {move.description}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.6rem",
                      borderTop: `1px solid ${isCatch ? "#6644aa" : "#080808"}`,
                      paddingTop: "0.5rem",
                    }}
                  >
                    <span>COST: {move.manaCost}</span>
                    <span>KEY: {index + 1}</span>
                  </div>
                </div>
              );
            })}
            {Array.from({ length: MAX_HAND_SIZE - hand.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  width: 220,
                  background: "rgba(255,255,255,0.3)",
                  border: "2px dashed rgba(8,8,8,0.3)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "rgba(8,8,8,0.5)",
                  fontSize: "0.7rem",
                  fontWeight: "600",
                  letterSpacing: "2px",
                }}
              >
                [EMPTY SLOT]
              </div>
            ))}
          </div>
          <button
            onClick={() => drawCard()}
            style={{
              fontFamily: "Impact, sans-serif",
              fontSize: "1.8rem",
              textTransform: "uppercase",
              marginLeft: "2rem",
              transition: "all 0.1s",
              background: "#080808",
              color: "#e3decb",
              border: "none",
              padding: "1rem 2rem",
              cursor: "pointer",
              boxShadow: "8px 8px 0 rgba(0,0,0,0.2)",
              letterSpacing: "2px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#2a2a2a";
              e.currentTarget.style.transform =
                "translateX(4px) translateY(4px)";
              e.currentTarget.style.boxShadow = "none";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#080808";
              e.currentTarget.style.transform = "translateX(0) translateY(0)";
              e.currentTarget.style.boxShadow = "8px 8px 0 rgba(0,0,0,0.2)";
            }}
          >
            DRAW
            <br />
            CARD
          </button>
        </footer>
      </div>
      {catchAnim && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 90,
            fontFamily: "'Courier New', monospace",
          }}
        >
          <div
            style={{
              background: "#e3decb",
              padding: "2.5rem 4rem",
              border: "4px solid #080808",
              textAlign: "center",
              boxShadow: "16px 16px 0 rgba(0,0,0,0.3)",
            }}
          >
            {catchAnim === "attempting" && (
              <>
                <div
                  style={{
                    fontSize: "4rem",
                    marginBottom: "1rem",
                    animation: "catchSpin 0.5s linear infinite",
                  }}
                >
                  🪤
                </div>
                <h2
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "2.5rem",
                    textTransform: "uppercase",
                    letterSpacing: "-1px",
                    margin: 0,
                  }}
                >
                  CAPTURING...
                </h2>
                <p
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.6,
                    marginTop: "0.5rem",
                  }}
                >
                  {currentEnemy?.emoji} {currentEnemy?.type?.toUpperCase()} is
                  resisting!
                </p>
              </>
            )}
            {catchAnim === "success" && (
              <>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
                <h2
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "2.5rem",
                    textTransform: "uppercase",
                    color: "#4d9a2a",
                    letterSpacing: "-1px",
                    margin: 0,
                  }}
                >
                  CAPTURED!
                </h2>
                <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
                  {currentEnemy?.emoji} {currentEnemy?.type?.toUpperCase()}{" "}
                  joined your team!
                </p>
                <p
                  style={{
                    fontSize: "0.7rem",
                    opacity: 0.5,
                    marginTop: "0.3rem",
                  }}
                >
                  Check loadout to customize their deck.
                </p>
              </>
            )}
            {catchAnim === "fail" && (
              <>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>💨</div>
                <h2
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "2.5rem",
                    textTransform: "uppercase",
                    color: "#cc3333",
                    letterSpacing: "-1px",
                    margin: 0,
                  }}
                >
                  BROKE FREE!
                </h2>
                <p
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.6,
                    marginTop: "0.5rem",
                  }}
                >
                  The {currentEnemy?.type} escaped the trap.
                </p>
              </>
            )}
            {catchAnim === "toostrong" && (
              <>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>❌</div>
                <h2
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "2rem",
                    textTransform: "uppercase",
                    letterSpacing: "-1px",
                    margin: 0,
                  }}
                >
                  TOO STRONG!
                </h2>
                <p
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.6,
                    marginTop: "0.5rem",
                  }}
                >
                  Weaken enemy below 20 HP first. ({opponentHP} HP)
                </p>
              </>
            )}
            {catchAnim === "already" && (
              <>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔄</div>
                <h2
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "2rem",
                    textTransform: "uppercase",
                    letterSpacing: "-1px",
                    margin: 0,
                  }}
                >
                  ALREADY CAUGHT!
                </h2>
                <p
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.6,
                    marginTop: "0.5rem",
                  }}
                >
                  You already have this monster on your team.
                </p>
              </>
            )}
          </div>
        </div>
      )}
      {gameOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#e3decb",
              padding: "3rem",
              border: "4px solid #080808",
              textAlign: "center",
              boxShadow: "16px 16px 0 rgba(0,0,0,0.3)",
            }}
          >
            <h1
              style={{
                fontFamily: "Impact, sans-serif",
                fontSize: "4rem",
                marginBottom: "1rem",
                textTransform: "uppercase",
                letterSpacing: "-2px",
              }}
            >
              {playerHP <= 0
                ? "MISSION FAILED"
                : sequential
                ? "TRAINER DEFEATED!"
                : "ALL HOSTILES ELIMINATED"}
            </h1>
            <p style={{ fontSize: "0.9rem", opacity: 0.6 }}>
              {playerHP <= 0
                ? "Returning to overworld..."
                : `${enemyWave.length} enem${
                    enemyWave.length === 1 ? "y" : "ies"
                  } neutralized. Returning to overworld...`}
            </p>
          </div>
        </div>
      )}
      <style>{`@keyframes scan { 0% { top: 0%; } 100% { top: 100%; } } @keyframes catchSpin { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.2); } 100% { transform: rotate(360deg) scale(1); } } @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════

const App = () => {
  const [appMode, setAppMode] = useState<"title" | "overworld" | "battle">(
    "title"
  );
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(
    CHARACTERS[0]
  );
  const [playerHP, setPlayerHP] = useState(100);
  const [owPlayerPos, setOwPlayerPos] = useState({ x: 9, y: 6 });
  const [owZone, setOwZone] = useState<"grassland" | "desert">("grassland");
  const [owPlayerDir, setOwPlayerDir] = useState("down");
  const [animFrame, setAnimFrame] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [battlesWon, setBattlesWon] = useState(0);
  const [encounterFlash, setEncounterFlash] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState(0);
  const [showLoadout, setShowLoadout] = useState(false);
  const [deckConfigs, setDeckConfigs] = useState<Record<string, string[]>>(
    () => {
      const cfg: Record<string, string[]> = {};
      CHARACTERS.forEach((c) => {
        cfg[c.name] = getDefaultDeck(c.name);
      });
      return cfg;
    }
  );
  const [caughtMonsters, setCaughtMonsters] = useState<string[]>([]);
  const [playerXP, setPlayerXP] = useState(0);
  const [upgradePoints, setUpgradePoints] = useState(0);
  const [upgrades, setUpgrades] = useState<Upgrades>({
    bulletDmg: 0,
    cardBonuses: {},
  });
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [npcDialog, setNpcDialog] = useState(false);
  const [trainerDialog, setTrainerDialog] = useState(false);
  const [trainerData, setTrainerData] = useState(() => generateTrainer());
  const [pendingTrainerWave, setPendingTrainerWave] = useState<
    EnemyDef[] | null
  >(null);
  const [xpNotif, setXpNotif] = useState<string | null>(null);
  const owRef = useRef<HTMLDivElement>(null);

  const allCharacters = useMemo(() => {
    const caught = MONSTER_CHARACTERS.filter((mc) =>
      caughtMonsters.includes(mc.name)
    );
    return [...CHARACTERS, ...caught];
  }, [caughtMonsters]);

  useEffect(() => {
    const i = setInterval(() => setAnimFrame((f) => f + 1), 100);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    if (
      appMode === "overworld" &&
      owRef.current &&
      !showLoadout &&
      !showUpgrades &&
      !npcDialog &&
      !trainerDialog
    )
      owRef.current.focus();
  }, [appMode, showLoadout, showUpgrades, npcDialog, trainerDialog]);

  const playerLevel = useMemo(() => {
    let lv = 0;
    let xpNeeded = 30;
    let xpLeft = playerXP;
    while (xpLeft >= xpNeeded) {
      xpLeft -= xpNeeded;
      lv++;
      xpNeeded = 30 + lv * 10;
    }
    return { level: lv, xpToNext: xpNeeded, xpCurrent: xpLeft };
  }, [playerXP]);

  const swapCharacter = useCallback((c: Character) => {
    setSelectedCharacter(c);
  }, []);

  const handleCatchMonster = useCallback((monsterName: string) => {
    setCaughtMonsters((prev) =>
      prev.includes(monsterName) ? prev : [...prev, monsterName]
    );
    setDeckConfigs((prev) =>
      prev[monsterName]
        ? prev
        : { ...prev, [monsterName]: getDefaultDeck(monsterName) }
    );
  }, []);

  const isWalkable = useCallback(
    (x: number, y: number) => {
      if (x < 0 || x >= OW_COLS) return false;
      // Allow zone transitions at top/bottom edges
      if (y < 0 || y >= OW_ROWS) return true;
      const map = owZone === "desert" ? DESERT_MAP : WORLD_MAP;
      const t = map[y][x];
      return t !== TL.WATER && t !== TL.TREE && t !== TL.ROCK;
    },
    [owZone]
  );

  const triggerEncounter = useCallback(() => {
    setTrainerData(generateTrainer(owZone));
    setEncounterFlash(true);
    setTimeout(() => {
      setEncounterFlash(false);
      setTransitionPhase(1);
      setTimeout(() => {
        setTransitionPhase(2);
        setTimeout(() => {
          setTransitionPhase(0);
          setAppMode("battle");
        }, 600);
      }, 400);
    }, 500);
  }, [owZone]);

  const getActiveDeck = useCallback((): Move[] => {
    const names = deckConfigs[selectedCharacter.name] || [];
    return names
      .map((n) => {
        if (n === "catch") return CATCH_MOVE;
        return selectedCharacter.moves.find((m) => m.name === n);
      })
      .filter(Boolean) as Move[];
  }, [deckConfigs, selectedCharacter]);

  const handleOverworldKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (appMode !== "overworld") return;
      if (npcDialog) {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ")
          setNpcDialog(false);
        e.preventDefault();
        return;
      }
      if (trainerDialog) {
        if (e.key === "Escape") setTrainerDialog(false);
        e.preventDefault();
        return;
      }
      if (e.key === "p" || e.key === "P") {
        setShowLoadout((s) => !s);
        e.preventDefault();
        return;
      }
      if (e.key === "u" || e.key === "U") {
        setShowUpgrades((s) => !s);
        e.preventDefault();
        return;
      }
      if (showLoadout || showUpgrades) return;
      let dx = 0,
        dy = 0,
        dir = owPlayerDir;
      switch (e.key) {
        case "ArrowUp":
        case "w":
          dy = -1;
          dir = "up";
          break;
        case "ArrowDown":
        case "s":
          dy = 1;
          dir = "down";
          break;
        case "ArrowLeft":
        case "a":
          dx = -1;
          dir = "left";
          break;
        case "ArrowRight":
        case "d":
          dx = 1;
          dir = "right";
          break;
        default:
          return;
      }
      e.preventDefault();
      const nx = owPlayerPos.x + dx,
        ny = owPlayerPos.y + dy;
      setOwPlayerDir(dir);
      // NPC interaction (grassland only)
      if (owZone === "grassland" && nx === NPC_POS.x && ny === NPC_POS.y) {
        setNpcDialog(true);
        return;
      }
      if (
        owZone === "grassland" &&
        nx === TRAINER_POS.x &&
        ny === TRAINER_POS.y
      ) {
        setTrainerDialog(true);
        return;
      }
      if (isWalkable(nx, ny)) {
        // Zone transition checks
        if (ny < 0) {
          if (owZone === "grassland") {
            setOwZone("desert");
            setOwPlayerPos({ x: nx, y: OW_ROWS - 1 });
          }
          return;
        }
        if (ny >= OW_ROWS) {
          if (owZone === "desert") {
            setOwZone("grassland");
            setOwPlayerPos({ x: nx, y: 0 });
          }
          return;
        }
        setOwPlayerPos({ x: nx, y: ny });
        setStepCount((s) => s + 1);
        const currentMap = owZone === "desert" ? DESERT_MAP : WORLD_MAP;
        if (
          currentMap[ny][nx] === TL.TALL_GRASS &&
          Math.random() < ENCOUNTER_RATE
        )
          triggerEncounter();
      }
    },
    [
      appMode,
      owPlayerPos,
      owPlayerDir,
      isWalkable,
      triggerEncounter,
      showLoadout,
      showUpgrades,
      npcDialog,
      trainerDialog,
    ]
  );

  const handleBattleEnd = useCallback(
    (result: "win" | "lose", remainingHP: number) => {
      if (result === "win") {
        setBattlesWon((w) => w + 1);
        setPlayerHP(Math.min(100, remainingHP + 15));
        setPlayerXP((prev) => prev + (pendingTrainerWave ? 40 : 20));
        setXpNotif(pendingTrainerWave ? "+40 XP (TRAINER)" : "+20 XP");
        setTimeout(() => setXpNotif(null), 2500);
        if (pendingTrainerWave) setTrainerData(generateTrainer(owZone)); // New trainer after win
      } else {
        setPlayerHP(100);
        setOwPlayerPos({ x: 9, y: 6 });
      }
      setPendingTrainerWave(null);
      setAppMode("overworld");
    },
    [pendingTrainerWave]
  );

  // Grant upgrade points on level up
  const prevLevelRef = useRef(0);
  useEffect(() => {
    if (playerLevel.level > prevLevelRef.current) {
      const gained = playerLevel.level - prevLevelRef.current;
      setUpgradePoints((p) => p + gained);
      setXpNotif(
        `LEVEL UP! → LV ${playerLevel.level} (+${gained} upgrade point${
          gained > 1 ? "s" : ""
        })`
      );
      setTimeout(() => setXpNotif(null), 3000);
    }
    prevLevelRef.current = playerLevel.level;
  }, [playerLevel.level]);

  const toggleDeckMove = (moveName: string) => {
    setDeckConfigs((prev) => {
      const cur = prev[selectedCharacter.name] || [];
      if (cur.includes(moveName))
        return {
          ...prev,
          [selectedCharacter.name]: cur.filter((n) => n !== moveName),
        };
      if (cur.length >= MAX_DECK_SIZE) return prev;
      return { ...prev, [selectedCharacter.name]: [...cur, moveName] };
    });
  };

  const viewW = 960,
    viewH = 720;
  const cameraX = useMemo(
    () =>
      Math.min(
        0,
        Math.max(
          -(OW_COLS * OW_TILE - viewW),
          -(owPlayerPos.x * OW_TILE - viewW / 2 + OW_TILE / 2)
        )
      ),
    [owPlayerPos.x]
  );
  const cameraY = useMemo(
    () =>
      Math.min(
        0,
        Math.max(
          -(OW_ROWS * OW_TILE - viewH),
          -(owPlayerPos.y * OW_TILE - viewH / 2 + OW_TILE / 2 - 40)
        )
      ),
    [owPlayerPos.y]
  );

  // ── TITLE SCREEN ──
  if (appMode === "title") {
    return (
      <div
        style={{
          background: "#0d1f22",
          height: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "'Courier New', monospace",
          userSelect: "none",
          color: "#e3decb",
          position: "relative",
          overflow: "hidden",
        }}
        onClick={() => setAppMode("overworld")}
        onKeyDown={(e) => {
          if (e.key === "Enter") setAppMode("overworld");
        }}
        tabIndex={0}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 0.05 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 1,
                top: `${(i * 5 + animFrame * 0.3) % 100}%`,
                background: "#4d9a2a",
              }}
            />
          ))}
        </div>
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.7rem",
              letterSpacing: "6px",
              opacity: 0.4,
              marginBottom: "1rem",
            }}
          >
            island boyz games
          </div>
          <h1
            style={{
              fontFamily: "Impact, sans-serif",
              fontSize: "6rem",
              fontWeight: "700",
              color: "#e3decb",
              textTransform: "uppercase",
              letterSpacing: "-3px",
              lineHeight: 0.9,
              margin: "0 0 0.5rem 0",
              textShadow: "4px 4px 0 rgba(0,0,0,0.5)",
            }}
          >
            reverie of
            <br />
            monsters
          </h1>
          <div
            style={{
              height: 3,
              background:
                "linear-gradient(90deg, transparent, #4d9a2a, transparent)",
              margin: "1rem auto",
              width: 300,
            }}
          />
          <div
            style={{
              fontSize: "0.8rem",
              letterSpacing: "4px",
              opacity: 0.6,
              marginBottom: "3rem",
            }}
          >
            TACTICAL COMBAT SYSTEM v3.1 — DUAL ENEMIES
          </div>
          <div
            style={{
              fontSize: "1.2rem",
              letterSpacing: "3px",
              animation: "blink 1.5s infinite",
              color: "#4d9a2a",
            }}
          >
            [ PRESS ENTER OR CLICK TO START ]
          </div>
          <div
            style={{
              display: "flex",
              gap: "2rem",
              justifyContent: "center",
              marginTop: "3rem",
            }}
          >
            {CHARACTERS.map((c) => (
              <div key={c.name} style={{ textAlign: "center", opacity: 0.5 }}>
                <div style={{ fontSize: "2rem" }}>{c.emoji}</div>
                <div style={{ fontSize: "0.6rem", letterSpacing: 2 }}>
                  {c.name.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  // ── BATTLE ──
  if (appMode === "battle")
    return (
      <BattleScreen
        selectedCharacter={selectedCharacter}
        persistentHP={playerHP}
        activeDeck={getActiveDeck()}
        onBattleEnd={handleBattleEnd}
        onCatchMonster={handleCatchMonster}
        caughtMonsterNames={caughtMonsters}
        upgrades={upgrades}
        trainerWave={pendingTrainerWave ?? undefined}
      />
    );

  // ── OVERWORLD ──
  return (
    <div
      ref={owRef}
      tabIndex={0}
      onKeyDown={handleOverworldKey}
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "row",
        background: "#e3decb",
        fontFamily: "'Courier New', monospace",
        color: "#080808",
        outline: "none",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* SIDEBAR */}
      <div
        style={{
          width: 72,
          background: "#d4cdb8",
          borderRight: "2px solid #080808",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 12,
          gap: 6,
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            fontSize: "0.5rem",
            letterSpacing: 1,
            opacity: 0.4,
            marginBottom: 4,
            textAlign: "center",
          }}
        >
          SWAP
        </div>
        {allCharacters.map((c) => {
          const isA = c.name === selectedCharacter.name;
          const isCaught = caughtMonsters.includes(c.name);
          return (
            <div
              key={c.name}
              onClick={() => swapCharacter(c)}
              title={c.name}
              style={{
                width: 54,
                height: 54,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: isA ? "#c8c0a8" : "#d4cdb8",
                border: `2px solid ${
                  isA ? "#080808" : isCaught ? "#4466aa" : "#a09880"
                }`,
                cursor: "pointer",
                transition: "all 0.15s",
                borderRadius: 4,
              }}
            >
              <div style={{ fontSize: 22 }}>
                {(() => {
                  const mn = getMonsterName(c.emoji);
                  const sp = mn ? MONSTER_SPRITES[mn] : null;
                  return sp ? (
                    <img
                      src={sp.idle}
                      alt={mn || ""}
                      style={{
                        width: 32,
                        height: 32,
                        imageRendering: "pixelated",
                      }}
                    />
                  ) : (
                    c.emoji
                  );
                })()}
              </div>
              <div
                style={{
                  fontSize: "0.45rem",
                  letterSpacing: 1,
                  opacity: isA ? 1 : 0.5,
                  color: isA ? "#080808" : isCaught ? "#4466aa" : "#666",
                  marginTop: 2,
                }}
              >
                {c.name.slice(0, 4).toUpperCase()}
              </div>
              {isCaught && (
                <div
                  style={{
                    fontSize: "0.3rem",
                    color: "#6688cc",
                    marginTop: -1,
                  }}
                >
                  CAUGHT
                </div>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: "auto", marginBottom: 12 }}>
          <div
            onClick={() => setShowLoadout(true)}
            style={{
              width: 54,
              height: 40,
              background: "#d4cdb8",
              border: "2px solid #a09880",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              borderRadius: 4,
              fontSize: "0.5rem",
              letterSpacing: 1,
              opacity: 0.6,
            }}
            title="Loadout (P)"
          >
            <div style={{ textAlign: "center" }}>
              ⚙<br />
              DECK
            </div>
          </div>
        </div>
      </div>
      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            height: 52,
            background: "#d4cdb8",
            borderBottom: "2px solid #080808",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>
              {(() => {
                const mn = getMonsterName(selectedCharacter.emoji);
                const sp = mn ? MONSTER_SPRITES[mn] : null;
                return sp ? (
                  <img
                    src={sp.idle}
                    alt={mn || ""}
                    style={{
                      width: 28,
                      height: 28,
                      imageRendering: "pixelated",
                      verticalAlign: "middle",
                    }}
                  />
                ) : (
                  selectedCharacter.emoji
                );
              })()}
            </span>
            <span
              style={{
                fontFamily: "Impact, sans-serif",
                fontSize: "1.1rem",
                color: "#080808",
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              {selectedCharacter.name}
            </span>
            <span style={{ opacity: 0.6, fontSize: "0.8rem" }}>
              HP:{" "}
              {"[" +
                "|".repeat(Math.floor(playerHP / 10)) +
                "-".repeat(10 - Math.floor(playerHP / 10)) +
                "]"}{" "}
              {playerHP}/100
            </span>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <span
              style={{ opacity: 0.4, fontSize: "0.7rem", letterSpacing: 2 }}
            >
              DECK: {(deckConfigs[selectedCharacter.name] || []).length}/
              {MAX_DECK_SIZE}
            </span>
            <span
              style={{ opacity: 0.4, fontSize: "0.7rem", letterSpacing: 2 }}
            >
              VICTORIES: {battlesWon}
            </span>
            <span
              style={{
                opacity: 0.4,
                fontSize: "0.7rem",
                letterSpacing: 2,
                color: caughtMonsters.length > 0 ? "#6688cc" : "inherit",
              }}
            >
              CAUGHT: {caughtMonsters.length}/3
            </span>
            <span
              style={{ fontSize: "0.7rem", letterSpacing: 2, color: "#b8860b" }}
            >
              LV {playerLevel.level} | XP {playerLevel.xpCurrent}/
              {playerLevel.xpToNext}
            </span>
            {upgradePoints > 0 && (
              <span
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: 2,
                  color: "#cc6600",
                  fontWeight: "bold",
                  animation: "blink 1.5s infinite",
                }}
              >
                ⬆ {upgradePoints} PTS
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            background: owZone === "desert" ? "#c4a060" : "#2a5a1a",
          }}
        >
          {/* 2.5D perspective container */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              perspective: "900px",
              perspectiveOrigin: "50% 35%",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: OW_COLS * OW_TILE,
                height: OW_ROWS * OW_TILE,
                transform: `translate(${cameraX}px, ${cameraY}px) rotateX(${ISO_ANGLE}deg) scale(${ISO_SCALE})`,
                transformStyle: "preserve-3d",
                transition: "transform 0.12s ease-out",
                left: "50%",
                top: "50%",
                marginLeft: -(viewW / 2),
                marginTop: -(viewH / 2),
                transformOrigin: "center center",
              }}
            >
              {(owZone === "desert" ? DESERT_MAP : WORLD_MAP).map((row, y) =>
                row.map((tile, x) => (
                  <OverworldTile
                    key={`${x}-${y}`}
                    type={tile}
                    x={x}
                    y={y}
                    animFrame={animFrame}
                    isDesert={owZone === "desert"}
                  />
                ))
              )}
              {/* NPC */}
              {owZone === "grassland" && (
                <div
                  style={{
                    position: "absolute",
                    left: NPC_POS.x * OW_TILE,
                    top: NPC_POS.y * OW_TILE,
                    width: OW_TILE,
                    height: OW_TILE,
                    transformStyle: "preserve-3d",
                    zIndex: NPC_POS.y + 1,
                  }}
                >
                  {/* Ground shadow */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 2,
                      left: "20%",
                      width: "60%",
                      height: "30%",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.25)",
                      filter: "blur(3px)",
                    }}
                  />
                  <div
                    style={{
                      transform: `rotateX(-${ISO_ANGLE}deg)`,
                      transformOrigin: "bottom center",
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 8,
                        background: "#fff",
                        border: "1px solid #080808",
                        borderRadius: 4,
                        padding: "1px 4px",
                        marginBottom: 0,
                        whiteSpace: "nowrap",
                        letterSpacing: 1,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      }}
                    >
                      TALK
                    </div>
                    <span style={{ fontSize: 28 }}>🧙</span>
                  </div>
                </div>
              )}
              {/* TRAINER NPC */}
              {owZone === "grassland" && (
                <div
                  style={{
                    position: "absolute",
                    left: TRAINER_POS.x * OW_TILE,
                    top: TRAINER_POS.y * OW_TILE,
                    width: OW_TILE,
                    height: OW_TILE,
                    transformStyle: "preserve-3d",
                    zIndex: TRAINER_POS.y + 1,
                  }}
                >
                  {/* Ground shadow */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 2,
                      left: "20%",
                      width: "60%",
                      height: "30%",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.25)",
                      filter: "blur(3px)",
                    }}
                  />
                  <div
                    style={{
                      transform: `rotateX(-${ISO_ANGLE}deg)`,
                      transformOrigin: "bottom center",
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 8,
                        background: "#cc3333",
                        color: "#fff",
                        border: "1px solid #080808",
                        borderRadius: 4,
                        padding: "1px 4px",
                        marginBottom: 0,
                        whiteSpace: "nowrap",
                        letterSpacing: 1,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      }}
                    >
                      FIGHT
                    </div>
                    <span style={{ fontSize: 28 }}>⚔</span>
                  </div>
                </div>
              )}
              {/* ZONE LABEL */}
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  transform: `rotateX(-${ISO_ANGLE}deg)`,
                  transformOrigin: "bottom left",
                  background:
                    owZone === "desert"
                      ? "rgba(180,100,20,0.9)"
                      : "rgba(30,80,30,0.9)",
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                  letterSpacing: 1,
                  zIndex: 999,
                  textTransform: "uppercase",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {owZone === "desert" ? "🏜️ DESERT" : "🌿 GRASSLAND"}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: owPlayerPos.x * OW_TILE,
                  top: owPlayerPos.y * OW_TILE,
                  width: OW_TILE,
                  height: OW_TILE,
                  zIndex: owPlayerPos.y + 1,
                  transition: "left 0.1s ease-out, top 0.1s ease-out",
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Ground shadow */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: "15%",
                    width: "70%",
                    height: "35%",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.3)",
                    filter: "blur(3px)",
                  }}
                />
                {/* Billboarded player sprite */}
                <div
                  style={{
                    transform: `rotateX(-${ISO_ANGLE}deg) scaleX(${
                      (owPlayerDir === "left" ? -1 : 1) *
                      (SPRITE_FLIP[
                        getMonsterName(selectedCharacter.emoji) || ""
                      ] || 1)
                    })`,
                    transformOrigin: "bottom center",
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: OW_TILE + 12,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                >
                  {(() => {
                    const mn = getMonsterName(selectedCharacter.emoji);
                    const sp = mn ? MONSTER_SPRITES[mn] : null;
                    return sp ? (
                      <img
                        src={sp.idle}
                        alt={mn || ""}
                        style={{
                          width: OW_TILE + 12,
                          height: OW_TILE + 12,
                          imageRendering: "pixelated",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 30 }}>
                        {selectedCharacter.emoji}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
          {/* Atmosphere vignette overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 2,
              background: `radial-gradient(ellipse at 50% 40%, transparent 55%, ${
                owZone === "desert" ? "rgba(60,30,0,0.35)" : "rgba(0,20,0,0.35)"
              } 100%)`,
            }}
          />
          {/* Bottom horizon fog */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "15%",
              pointerEvents: "none",
              zIndex: 3,
              background: `linear-gradient(to top, ${
                owZone === "desert"
                  ? "rgba(180,140,60,0.5)"
                  : "rgba(42,90,26,0.5)"
              }, transparent)`,
            }}
          />
          {encounterFlash && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 100,
                background: "white",
                animation: "encounterFlash 0.5s ease-out",
              }}
            />
          )}
          {xpNotif && (
            <div
              style={{
                position: "absolute",
                top: 20,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 50,
                background: "#b8860b",
                color: "#fff",
                padding: "8px 24px",
                fontFamily: "Impact, sans-serif",
                fontSize: "1.4rem",
                letterSpacing: 3,
                border: "3px solid #080808",
                boxShadow: "6px 6px 0 rgba(0,0,0,0.3)",
                animation: "blink 0.8s ease-out",
              }}
            >
              {xpNotif}
            </div>
          )}
          {transitionPhase > 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: "#0a0a0a",
                    transform: `translateX(${
                      transitionPhase >= 2 ? 0 : i % 2 === 0 ? -110 : 110
                    }%)`,
                    transition: "transform 0.4s ease-in-out",
                    transitionDelay: `${i * 0.03}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            height: 48,
            background: "#d4cdb8",
            borderTop: "1px solid #080808",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            flexShrink: 0,
            padding: "0 28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 18,
                height: 18,
                background: "#4d9a2a",
                border: "1px solid #080808",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                color: "#2a5a0a",
              }}
            >
              ᐱ
            </div>
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
              TALL GRASS = ENCOUNTERS
            </span>
          </div>
          <span style={{ fontSize: "0.75rem", opacity: 0.3 }}>|</span>
          <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>
            WASD / ARROWS: MOVE
          </span>
          <span style={{ fontSize: "0.75rem", opacity: 0.3 }}>|</span>
          <span
            style={{
              fontSize: "0.75rem",
              opacity: 0.8,
              color: "#080808",
              fontWeight: "bold",
            }}
          >
            P: LOADOUT
          </span>
          <span style={{ fontSize: "0.75rem", opacity: 0.3 }}>|</span>
          <span
            style={{
              fontSize: "0.75rem",
              opacity: 0.8,
              color: "#b8860b",
              fontWeight: "bold",
            }}
          >
            U: UPGRADES
          </span>
        </div>
      </div>
      {showLoadout && (
        <LoadoutScreen
          character={selectedCharacter}
          selectedMoves={deckConfigs[selectedCharacter.name] || []}
          onToggleMove={toggleDeckMove}
          onClose={() => setShowLoadout(false)}
        />
      )}
      {/* NPC Dialog */}
      {npcDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            fontFamily: "'Courier New', monospace",
          }}
          onClick={() => setNpcDialog(false)}
        >
          <div
            style={{
              background: "#e3decb",
              border: "4px solid #080808",
              padding: "2rem 3rem",
              maxWidth: 520,
              boxShadow: "12px 12px 0 rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: "1.2rem",
              }}
            >
              <span style={{ fontSize: "2.5rem" }}>🧙</span>
              <div>
                <div
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "1.5rem",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  THE SAGE
                </div>
                <div
                  style={{ fontSize: "0.6rem", opacity: 0.5, letterSpacing: 2 }}
                >
                  FIELD GUIDE
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                lineHeight: 1.8,
                borderTop: "2px solid #080808",
                paddingTop: "1rem",
              }}
            >
              <p style={{ margin: "0 0 0.8rem" }}>
                <b>Welcome, trainer.</b> Here's what you need to know:
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                🕹 <b>ARROWS/WASD</b> — Move on the overworld & in battle
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                🌿 <b>TALL GRASS</b> — Walk through it to trigger encounters
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                ⚔ <b>SPACE</b> — Fire your basic attack (hold to charge for Rat
                King & Malipole)
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                🃏 <b>1 & 2 keys</b> — Use ability cards from your hand
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                🎴 <b>P key</b> — Open Loadout to customize your deck (max 6
                cards)
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                ⬆ <b>U key</b> — Open Upgrades to spend points on bullet & card
                damage
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                🪤 <b>CATCH</b> — Weaken enemies below 20 HP, then use the Catch
                card!
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                🔄 <b>SIDEBAR</b> — Click portraits to swap your active
                character
              </p>
              <p
                style={{
                  margin: "0.8rem 0 0",
                  opacity: 0.5,
                  fontSize: "0.7rem",
                }}
              >
                Win battles to earn XP. Level up to get upgrade points. Good
                luck out there.
              </p>
            </div>
            <div
              style={{
                textAlign: "center",
                marginTop: "1.2rem",
                fontSize: "0.75rem",
                opacity: 0.4,
                letterSpacing: 2,
              }}
            >
              [ PRESS ENTER / ESC / CLICK TO CLOSE ]
            </div>
          </div>
        </div>
      )}
      {/* Trainer Dialog */}
      {trainerDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            fontFamily: "'Courier New', monospace",
          }}
          onClick={() => setTrainerDialog(false)}
        >
          <div
            style={{
              background: "#e3decb",
              border: "4px solid #080808",
              padding: "2rem 3rem",
              maxWidth: 480,
              boxShadow: "12px 12px 0 rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: "1.2rem",
              }}
            >
              <span style={{ fontSize: "2.5rem" }}>⚔</span>
              <div>
                <div
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "1.5rem",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  TRAINER {trainerData.name}
                </div>
                <div
                  style={{ fontSize: "0.6rem", opacity: 0.5, letterSpacing: 2 }}
                >
                  CHALLENGER
                </div>
              </div>
            </div>
            <div
              style={{
                borderTop: "2px solid #080808",
                paddingTop: "1rem",
                marginBottom: "1rem",
              }}
            >
              <p style={{ margin: "0 0 0.8rem", fontSize: "0.85rem" }}>
                I challenge you to a battle! Defeat my team one at a time.
              </p>
              <div
                style={{
                  fontSize: "0.7rem",
                  opacity: 0.6,
                  letterSpacing: 2,
                  marginBottom: "0.5rem",
                }}
              >
                MY TEAM:
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {trainerData.team.map((mon, i) => {
                  const mn = getMonsterName(mon.emoji);
                  const sp = mn ? MONSTER_SPRITES[mn] : null;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        border: "2px solid #080808",
                        background: "#f5f0e1",
                        padding: "0.6rem",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: 60,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 4,
                        }}
                      >
                        {sp ? (
                          <img
                            src={sp.idle}
                            alt={mn || ""}
                            style={{
                              width: 50,
                              height: 50,
                              imageRendering: "pixelated",
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 32 }}>{mon.emoji}</span>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: "Impact, sans-serif",
                          fontSize: "1rem",
                          textTransform: "uppercase",
                        }}
                      >
                        {mon.type}
                      </div>
                      <div style={{ fontSize: "0.65rem", opacity: 0.6 }}>
                        HP: {mon.hp}
                      </div>
                      {mon.deck && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: "0.55rem",
                            opacity: 0.5,
                            lineHeight: 1.4,
                          }}
                        >
                          {mon.deck.join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  opacity: 0.5,
                  marginTop: "0.6rem",
                  textAlign: "center",
                }}
              >
                Reward: +40 XP
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => {
                  setTrainerDialog(false);
                  setPendingTrainerWave(trainerData.team);
                  setEncounterFlash(true);
                  setTimeout(() => {
                    setEncounterFlash(false);
                    setTransitionPhase(1);
                    setTimeout(() => {
                      setTransitionPhase(2);
                      setTimeout(() => {
                        setTransitionPhase(0);
                        setAppMode("battle");
                      }, 600);
                    }, 400);
                  }, 500);
                }}
                style={{
                  fontFamily: "Impact, sans-serif",
                  fontSize: "1.2rem",
                  padding: "0.6rem 2rem",
                  background: "#cc3333",
                  color: "#fff",
                  border: "3px solid #080808",
                  cursor: "pointer",
                  letterSpacing: 2,
                  boxShadow: "4px 4px 0 rgba(0,0,0,0.2)",
                }}
              >
                BATTLE!
              </button>
              <button
                onClick={() => setTrainerDialog(false)}
                style={{
                  fontFamily: "Impact, sans-serif",
                  fontSize: "1.2rem",
                  padding: "0.6rem 2rem",
                  background: "#999",
                  color: "#fff",
                  border: "3px solid #080808",
                  cursor: "pointer",
                  letterSpacing: 2,
                }}
              >
                DECLINE
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Upgrade Screen */}
      {showUpgrades && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            fontFamily: "'Courier New', monospace",
          }}
          onClick={() => setShowUpgrades(false)}
        >
          <div
            style={{
              background: "#e3decb",
              border: "4px solid #080808",
              padding: "2rem 3rem",
              maxWidth: 600,
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "12px 12px 0 rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
                borderBottom: "2px solid #080808",
                paddingBottom: "1rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "2rem",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  UPGRADES
                </div>
                <div style={{ fontSize: "0.7rem", opacity: 0.5 }}>
                  Level {playerLevel.level} | XP {playerLevel.xpCurrent}/
                  {playerLevel.xpToNext}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "1.8rem",
                    color: upgradePoints > 0 ? "#cc6600" : "#999",
                  }}
                >
                  {upgradePoints}
                </div>
                <div
                  style={{ fontSize: "0.6rem", letterSpacing: 2, opacity: 0.5 }}
                >
                  POINTS
                </div>
              </div>
            </div>
            {/* Bullet Damage */}
            <div
              style={{
                background: "#d4cdb8",
                border: "2px solid #080808",
                padding: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "Impact, sans-serif",
                      fontSize: "1.2rem",
                      textTransform: "uppercase",
                    }}
                  >
                    BULLET DAMAGE
                  </div>
                  <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                    Base shot damage: {2 + upgrades.bulletDmg} DMG{" "}
                    {upgrades.bulletDmg >= 3
                      ? "(MAX)"
                      : `→ ${3 + upgrades.bulletDmg} DMG`}
                  </div>
                </div>
                <button
                  disabled={upgradePoints <= 0 || upgrades.bulletDmg >= 3}
                  onClick={() => {
                    if (upgradePoints > 0 && upgrades.bulletDmg < 3) {
                      setUpgrades((u) => ({
                        ...u,
                        bulletDmg: u.bulletDmg + 1,
                      }));
                      setUpgradePoints((p) => p - 1);
                    }
                  }}
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: "1rem",
                    padding: "0.5rem 1.5rem",
                    background:
                      upgradePoints > 0 && upgrades.bulletDmg < 3
                        ? "#cc6600"
                        : "#999",
                    color: "#fff",
                    border: "2px solid #080808",
                    cursor:
                      upgradePoints > 0 && upgrades.bulletDmg < 3
                        ? "pointer"
                        : "not-allowed",
                    letterSpacing: 1,
                  }}
                >
                  {upgrades.bulletDmg >= 3 ? "MAXED" : "UPGRADE"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 40,
                      height: 6,
                      background: i <= upgrades.bulletDmg ? "#cc6600" : "#bbb",
                      border: "1px solid #080808",
                    }}
                  />
                ))}
              </div>
            </div>
            {/* Card Damage */}
            <div
              style={{
                fontSize: "0.7rem",
                letterSpacing: 2,
                opacity: 0.5,
                marginBottom: "0.5rem",
              }}
            >
              CARD UPGRADES — +3 DMG per level (DOT: +1/tick)
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {selectedCharacter.moves.map((m) => {
                const lvl = upgrades.cardBonuses[m.name] || 0;
                const hasDmg = /\d+ DMG/.test(m.description);
                if (!hasDmg) return null;
                return (
                  <div
                    key={m.name}
                    style={{
                      background: "#d4cdb8",
                      border: "1px solid #080808",
                      padding: "0.6rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "Impact, sans-serif",
                          fontSize: "0.9rem",
                          textTransform: "uppercase",
                        }}
                      >
                        {m.name}
                      </div>
                      <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            style={{
                              width: 20,
                              height: 4,
                              background: i < lvl ? "#cc6600" : "#ccc",
                              border: "1px solid #999",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      disabled={upgradePoints <= 0 || lvl >= 3}
                      onClick={() => {
                        if (upgradePoints > 0 && lvl < 3) {
                          setUpgrades((u) => ({
                            ...u,
                            cardBonuses: {
                              ...u.cardBonuses,
                              [m.name]: lvl + 1,
                            },
                          }));
                          setUpgradePoints((p) => p - 1);
                        }
                      }}
                      style={{
                        fontFamily: "Impact, sans-serif",
                        fontSize: "0.7rem",
                        padding: "0.3rem 0.8rem",
                        background:
                          upgradePoints > 0 && lvl < 3 ? "#cc6600" : "#999",
                        color: "#fff",
                        border: "1px solid #080808",
                        cursor:
                          upgradePoints > 0 && lvl < 3
                            ? "pointer"
                            : "not-allowed",
                      }}
                    >
                      {lvl >= 3 ? "MAX" : "+"}
                    </button>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                textAlign: "center",
                marginTop: "1.5rem",
                fontSize: "0.7rem",
                opacity: 0.4,
                letterSpacing: 2,
              }}
            >
              [ U / CLICK OUTSIDE TO CLOSE ]
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes encounterFlash { 0% { opacity: 0; } 25% { opacity: 1; } 40% { opacity: 0; } 60% { opacity: 1; } 80% { opacity: 0.5; } 100% { opacity: 0; } } @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
};

export default App;

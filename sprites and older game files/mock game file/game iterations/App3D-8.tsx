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
const GAME_TICK = 112;
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
  {
    type: "statinu",
    emoji: "🐕",
    hp: 120,
    shootChance: 0.3,
    speed: 5,
    allMoves: ["wall", "topple", "bomb", "dust devil", "punch", "slash", "flame breath", "guardian stance"],
  },
  {
    type: "scimark",
    emoji: "🦈",
    hp: 110,
    shootChance: 0.25,
    speed: 5,
    allMoves: ["slash", "beam", "lasso", "wall", "topple", "absorb", "sword dive", "tidal wave"],
  },
];

// AI card effect categories: how the enemy executes each card (mirrored from player)
// AI card system removed — enemyUseCard handles each card individually as exact mirror of player version

const DESERT_TYPES = ["giant", "mushroom", "statinu"];
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
  {
    name: "Statinu",
    emoji: "🐕",
    moves: [
      {
        name: "punch",
        manaCost: 1,
        cooldown: 1000,
        description: "15 DMG. Quick bite 1 tile ahead.",
      },
      {
        name: "wall",
        manaCost: 2,
        cooldown: 1000,
        description: "No DMG. Place 4-block defensive column.",
      },
      {
        name: "topple",
        manaCost: 2,
        cooldown: 1000,
        description: "40 DMG. Knock the wall in front of you at enemies.",
      },
      {
        name: "dust devil",
        manaCost: 3,
        cooldown: 1000,
        description: "20 DMG. Stun enemy row for 1 second.",
      },
      {
        name: "bomb",
        manaCost: 3,
        cooldown: 1000,
        description: "25 DMG + Stun. Place stun-trap 3 tiles ahead.",
      },
      {
        name: "slash",
        manaCost: 1,
        cooldown: 1000,
        description: "30 DMG. Hits 3 tiles in front.",
      },
      {
        name: "flame breath",
        manaCost: 4,
        cooldown: 1000,
        description: "20 DMG. Fire beam across the row, burns tiles.",
      },
      {
        name: "guardian stance",
        manaCost: 3,
        cooldown: 1000,
        description: "Heal 15 HP + place a wall to shield yourself.",
      },
    ],
  },
  {
    name: "Scimark",
    emoji: "🦈",
    moves: [
      {
        name: "slash",
        manaCost: 0,
        cooldown: 1000,
        description: "25 DMG. Slash arc: 3 tiles.",
      },
      {
        name: "beam",
        manaCost: 3,
        cooldown: 1000,
        description: "35 DMG. Lunge 5 tiles ahead.",
      },
      {
        name: "lasso",
        manaCost: 3,
        cooldown: 1000,
        description: "10 DMG. Drag enemy to front tiles.",
      },
      {
        name: "absorb",
        manaCost: 3,
        cooldown: 1000,
        description: "Heal 20 HP if enemy is stunned or poisoned.",
      },
      {
        name: "wall",
        manaCost: 3,
        cooldown: 1000,
        description: "No DMG. Place 4-block defensive column.",
      },
      {
        name: "topple",
        manaCost: 2,
        cooldown: 1000,
        description: "40 DMG. Knock the wall in front of you at enemies.",
      },
      {
        name: "sword dive",
        manaCost: 4,
        cooldown: 1000,
        description: "35 DMG. Pierce 4 tiles ahead, ignoring blocks.",
      },
      {
        name: "tidal wave",
        manaCost: 5,
        cooldown: 1000,
        description: "15 DMG. Slow 2-row wave sweeps from rear to enemy's far side.",
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
  { type: "statinu", emoji: "🐕", hp: 120, shootChance: 0.3, speed: 5 },
  { type: "scimark", emoji: "🦈", hp: 110, shootChance: 0.25, speed: 5 },
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


const SPRITE_BULLET =
  "data:image/gif;base64,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";




// ════════════════════════════════════════════════════════════
// NEW PIXEL ART SPRITES (PNG)
// ════════════════════════════════════════════════════════════
const SPRITE_MALIPOLE_PNG = "data:image/png;base64,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";
const SPRITE_SCIMARK_PNG = "data:image/png;base64,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";
const SPRITE_FUDO_PNG = "data:image/png;base64,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";
const SPRITE_FAIRY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAABA9JREFUeJztWztqHEEQfW0MmjtYgQMLpMDRCiuREFiXcGzwzg18CZ9AmyjWFQwSGDux0BiBAhkssALrAMp2o3YwU7u1PTM93dWfxXgeLCvPTn/eq+qq/hkYMWLEiBEjRowYMWLE/wgVqyKttRZ1QKlofRC1H1oBEZfyMHXLLchzaUGTuNanonpMvqzeLEKIGtFa61DivR1SJbWRRQTvBoh8bOImlCqXwyOlEF4V5yJP4N6AREI4V5ibPEfKYeFU2SbJc9CwiCnCYEWbIf+6+b5t/RJbBHEaBABUVf09mcToCyNu/nslhNanqA2idQwRrAJYrV9V+PnjMwBgFzFEMMmbv6URwd8DGqsTefo7TAQbef5OfBF6Bei0PiO/N30wSsygr6cRh0MeuHtA4/JEvGvtkztYxvCCZ05vMfJa62UUJpjvpkE7I8TAsAcY5E3CWmt9uVgAAC7mc6iiEAyFW8c40EaoFwx6gCv5cNgsnMb6sHmAUkqtAmFq8oR0RPtg9YBGBOdZ10lR4G72MlrncmBwCPSRV0qpt1tbSTqVE2FTYVeU01V2uBZkidDyFlg9QBsQtVBO62/KCvueE6WB8qGLI+tM0AxyXASaA5hpcK8ocDcLnRrnQ6cH9EX4y8Vi+eGbl9ZYcDqrv6UubCkfY2ksjgEkglPjREKK0PIWuE2Fe8A9IXdGiLUxEpwFaKiQAP9aHOj0AEmOv1wsur3AdXFUTlcRfwAxt8WChoAJEuFiPsfe9GFt08QKTnxAhNh7gr0CSGd6PHvsfvhdizDkBTzIWQLexnaFYRBzwUlRrG+aVPXeviQmnJ894fDoGNs7B/kFIPgI0SLPUZXOIpyfPQEADo+O8eLVm7rDPatTKURng9YKmw5K8Xh/hW9fvwANcQBL8mYbMUSIeszE9w+keLy/AjpIc6xOpjV/ttGLFuQZ5vopGv78+t56BmD5kS7WoqbBPpBVY9TD66IN2mY4gAnjjChuM+T6j/dXVpf2ea9LTB4g4XmKnHxDJJb1CUR2FStuANwA6/cInBdqwQK4BD4X6/uiJm7Cf9UYJICL6/vCbbh0EBUeyATdEnMZZutkuizktgCyIuA0SpQFuOXdgu6sTb6qmk/ZetvuOR31BCBZGrSSMDvtLUJPPQDU/swrC3gL4DPbq93fPTCFBktf8kjlAaLUN+AF52efRFF+CBlmgmFBjkR49/6j9T2J9ZFCACfr9y2Hq7JzGAxxkpJHypmgOT2F473iLg40108Bbw9gJ8at30zr81RZl2Hj3LIpwsuQZVvlqY0A60PqAfzuAHWYk9/eOVg+5x3T5sWryaQ3j5uEzDZZnZs5GaIOofvO//KdrjJ9l6mGrMnb5M+kHBBzObxW6UCn+qbRuf6PAMdfKFVBaXN5bY4AAAAASUVORK5CYII=";
const SPRITE_SLIME_PNG = "data:image/png;base64,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";
const SPRITE_METAIL_PNG = "data:image/png;base64,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";
const SPRITE_LUNAPRA_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAABU1JREFUeJzlW8+LU0kQ/t4iyCwyKJ7MiJA5Lctk3H/Aq7gJetX5B0ZwYFk8efHuRZiLA+s/ED2KJILXve5h1gx6S2Aw401EFlRYaA+TeqnXr39U9+tOAn4QHEz366qvfnRVJQF+cBTLOlgppXxriqLILt9SCFBKKYluSqnsJJzJ+XATSPnBeO4A3TYwnNTXFkVB67OREPzgJq4bojyht1lk9QTxQ0lxqetCI0KqfLdtELLIR4IoBHjMSl0XVdJEgpPy+jMHY5UtHLwEmCznw2Cs0G1XiZA+wxUOOeAkIEZ5MEvSPpvR+P+HnpEKP9ne4Mqb4tIGkxsPxgqHLHf2NosyudGrt1mI8ktqiK9BW7xvGMgxrZtOTtf+NktosCRJG3LlAREBw8kpAZyEjbbZtV235FX2t0sJ7nG+nBCaaHVYN9muLQD4F1VLVh5YFDhUCtNJdQ9hODHf7XQePXOo7TddhdxrYq9JccHC4SpOaO+hUqXFdSv2NudCV4SxnEk3Cp3JaxIWTlEkJC+FSUASyOTCttvBRjh/Bn92U+XhI8CU+FKWpoOxwudHG9517MyK4khQJTpDwBbjvgN5GEwFhQ2RsP5gWnvPFi5SWXwIzgESDwglABYS6Cyj4In6A2shlALv7p4qJXFz3frdtv1KTdkcJSeArN/fbQFMeQkJwLzesCF1Z2gkYJbJy/iTQleeY+fpiXf/nb/qOUCTK3lbnDUEOPq7LSehvn4j10xAVAdw4aQ1+cnxF7SurImEMClP5TcyD0SsHsDDYDhB+YJGAq13uT9mhDy+ccEbVrwEHk7yKo/YSlCzTM0TTo6/GPe1rqyhv7tWksCvWVPDJU2cTeAkgJe1JKxp2GGyPnd/EyEv1Ff0tOfyqvP/9jdR4tQR2i57PYCTAEO9TuFAIGW50n//9wm3f71U2XcLZ4FZsUNDFz3mQ8EqWDEJohDQOzATbLFvW8s9hueF/m6r8r7UC3j5HkJCks8FdPffunqx/Pth/wgAah4gxc7TE3HpHdMdBtcBBQM8ygPAtXPnce3ceTx/+wH4OfQ0P1yNmwRRhZCawac8AFy/eRmYEfH8Hz8J6w+m5aspJJ9iiQlQDEURN8GVkhAqi61VplzAUVsnPZArTM95dnd+T5usz/H65fvy7/uvPpZCEmz9g2sOCM8QVj8DhtmhlwAXy0SAT3nC1r03IiG5sKa1sfEOQ4KMngly60tgUx4A+t0WtnpzEjt7o1LY1NCvyWgPkFrfpTgAHB1syySfobM3CvYAVxg4CXDFm48Al+KhSvvgCy3D+N2fAyT3q0kRn8Vt+5rCdK6kILLmAH2+Lz10lSApixcyEcph8VQQt8NNrh4skQSfF4i+INFE+WUo7it+OKwEpLL8oqDLqn181iwJAsDjGxfK96jBMSXBo4Pt8v8XbX2dhMbtMA1GwZSmf3UcHWxXFF608qMnHSBighxUCnPlXVZeZtYPnSBH9wK5lXz98r3V21IimgCTgDFC8zaZo/XLfKrc2RuVLp4aol7AdrguvFR56vYI/T/dA9Wd/dPBqI8EapQWEgK6EqEW4gNM6XqXMWLh/aKk60D96yoSxFiJn6cT3xRRvUCsEk2Uz4XgENCV4AWTzVvIarV5HNtrywM7+/O5oGTKG4ogAmIsyCc4q2R5QlAIjJ50ah+LS7GKymOR3xBZVSQhgHqG1Bl6EVhpD+AJMNcZ3iR4/Lve8rplCV2/bCz8d4M2rP9h+DB030xeneT47zCLQiDkJzMx65eJlcoBMb9NaoogAnL/ijP2rGxyzQqe8uUrgPT1kj2h+2LPsOE75f0diyoel9kAAAAASUVORK5CYII=";
const SPRITE_LEMMEL_PNG = "data:image/png;base64,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";
const SPRITE_YAMMY_PNG = "data:image/png;base64,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";
const SPRITE_DRAGONE_PNG = "data:image/png;base64,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";
const SPRITE_GRABAKAT_PNG = "data:image/png;base64,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";
const SPRITE_MUSHERY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAABMVJREFUeJztW89LF1EQny0PdfFgiCc79gXpUBJ0E4xEvHjynNBBIiSIIO0fsCi8iIR4COzsxVMHQcGbEOUhBKV/QASJLkYQ28HvbLOzM+/N7nu7X6H9XFr3u2/efD5vZt6P3QBatGjRokWLFi1atPgvkfSy8zRNU+l+kiSN+dUTAZC4xpPqUrcYfXUal5CmaYqcNkfHCr8fn57khOk+X5sIjQqA5CXiFEvDnew6SZJaRbhSh1GOtAsLeY6l4U4mQh2+1S4AEreSvzU4VLi3OTpWmwi1Fpiqo65h5ssepGkatTDWUgNolY9Fvi5EjwBflQ9F7CiIKoA15I9PT3J/S3nvQkwRohTBkCof2m+ojaAawFd0TZHHWYH5UCkaKjXqFXEJM1/20KdKIpRqwInTFVvZPI4NrAtQMhq8KUDzTCJ+WSClBRjEEAWQSENJ4senJ41HBaYi30zhtSRGQQA6j8MlHW2fuLQm+XaWOQHoVMbn6qqOIkKjoao/XAwuQiZA3fM4EigjRIxBoKCbKhRBLYK3BofMDkiktPYxSMWsLQl4Rt/lsMWRmKNYlriWgnQp7Z0GQ9Wm7a17gNC9Qhk0eiRmJdLk9Nn4oWhMSOlFxbPUsT7oLhCkOhBrGos5HXJ72m/Yj68/NQJ4J2WmMcnBnxvXL36bDbNjhXUlmgmgRUEZwy7i9O/+2XOnoNQOb98/e+5mVBK5CKAixFgCby1MAhwCjI/sZfdej3+FVxt3AbpktFHeWpgEAIBxKLYNEYGfJok7JbofkISwRgCSAMiLgJj+Pi3aef77R+5vqa1VBPRVOzdQt4qu93dqijy8kV2+uzlc+JkTefnnqWhm6uibqS19bn9+RfapC+2swHtwIJ27URv3V59l1x/hV+65R3BNtfupc9vZryQCb/v26vvs3psHB+A6ItTOBbyHoomANE2zzsZH9sQQBQdJH3lL26mjb7B7+C8SF3fuZAMj+azy83oiAGvE4s6d7B46Q6NgsHPPZG/t8TI8+fCicK1hYGIuF3l0ADASrMdipY/FXeQBADrz69n16dFn0cba4+Xcv65nNNCclyLBemRe+lDURX5/fgXVh6PVuey+FgmW0eYYmJjL+qBRAEokgOdc0CQAnREoeVAEwGctIlgxMDGHvuTWKz4RwDEDgC8F6BsfK3laKGk6gCMlrMgtYLp98OmPpwOmhJYW6l6ALoY4cd4RJY/36CgBAJxtX0QAihAaEbwPHgkU6L/zTJBCynUEJQ4KeclBEEhjWFOcba8X7pG8d/aBIuwejqlTM0ep84Ay5H1AUhxJkhREONted34rpIkAyjKawixAFfLolDSq1Hn6vNUfyQ6NNi7EBQ4K7UwC8HyHgJeR4AhpSsIlmgZsD8oeRupTFICrSZWzvoAMISLBlwbUd9D3MP5XY/Rhq5G6PmHjoCJoviCs0elMAYsR/i6RO1wGmi26fkARwPDi04Kgb2x8Yc4XPnQa5HWgSsrQabSRDyQoYuQ4nQpj2SorQiOfyjYBXh+s6JkAdMRwXS+tDOtGTwSQwjVUhKopEKUIQjcEtd0eFj++pfXZRNBtNbdrselC8JeWvv/9wZ4FMC6ick46Hq/yZVjOdpVGiiPe4lPVSZft0M9l/wKVaF/f5nd+zAAAAABJRU5ErkJggg==";

const MONSTER_SPRITES: Record<
  string,
  { idle: string; attack: string; attack2: string; hit: string }
> = {
  Bat: {
    idle: SPRITE_DRAGONE_PNG,
    attack: SPRITE_DRAGONE_PNG,
    attack2: SPRITE_DRAGONE_PNG,
    hit: SPRITE_DRAGONE_PNG,
  },
  Grunt: {
    idle: SPRITE_GRABAKAT_PNG,
    attack: SPRITE_GRABAKAT_PNG,
    attack2: SPRITE_GRABAKAT_PNG,
    hit: SPRITE_GRABAKAT_PNG,
  },
  Slime: {
    idle: SPRITE_SLIME_PNG,
    attack: SPRITE_SLIME_PNG,
    attack2: SPRITE_SLIME_PNG,
    hit: SPRITE_SLIME_PNG,
  },
  Cowboy: {
    idle: SPRITE_LUNAPRA_PNG,
    attack: SPRITE_LUNAPRA_PNG,
    attack2: SPRITE_LUNAPRA_PNG,
    hit: SPRITE_LUNAPRA_PNG,
  },
  RatKing: {
    idle: SPRITE_LEMMEL_PNG,
    attack: SPRITE_LEMMEL_PNG,
    attack2: SPRITE_LEMMEL_PNG,
    hit: SPRITE_LEMMEL_PNG,
  },
  Hogglin: {
    idle: SPRITE_METAIL_PNG,
    attack: SPRITE_METAIL_PNG,
    attack2: SPRITE_METAIL_PNG,
    hit: SPRITE_METAIL_PNG,
  },
  Malipole: {
    idle: SPRITE_MALIPOLE_PNG,
    attack: SPRITE_MALIPOLE_PNG,
    attack2: SPRITE_MALIPOLE_PNG,
    hit: SPRITE_MALIPOLE_PNG,
  },
  Pixie: {
    idle: SPRITE_FAIRY_PNG,
    attack: SPRITE_FAIRY_PNG,
    attack2: SPRITE_FAIRY_PNG,
    hit: SPRITE_FAIRY_PNG,
  },
  Giant: {
    idle: SPRITE_YAMMY_PNG,
    attack: SPRITE_YAMMY_PNG,
    attack2: SPRITE_YAMMY_PNG,
    hit: SPRITE_YAMMY_PNG,
  },
  Mushroom: {
    idle: SPRITE_MUSHERY_PNG,
    attack: SPRITE_MUSHERY_PNG,
    attack2: SPRITE_MUSHERY_PNG,
    hit: SPRITE_MUSHERY_PNG,
  },
  Statinu: {
    idle: SPRITE_FUDO_PNG,
    attack: SPRITE_FUDO_PNG,
    attack2: SPRITE_FUDO_PNG,
    hit: SPRITE_FUDO_PNG,
  },
  Scimark: {
    idle: SPRITE_SCIMARK_PNG,
    attack: SPRITE_SCIMARK_PNG,
    attack2: SPRITE_SCIMARK_PNG,
    hit: SPRITE_SCIMARK_PNG,
  },
};

const SPRITE_SCALE: Record<string, number> = {
  Giant: 0.9,
  Mushroom: 0.75,
  Bat: 0.75,
  Grunt: 0.75,
  Slime: 0.75,
  Cowboy: 0.75,
  RatKing: 0.5,
  Hogglin: 0.5,
  Malipole: 0.75,
  Pixie: 0.75,
  Statinu: 0.75,
  Scimark: 0.75,
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
  Statinu: 1,
  Scimark: -1,
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
  if (emoji === "🐕") return "Statinu";
  if (emoji === "🦈") return "Scimark";
  return null;
};

const ALL_CHARS = [...CHARACTERS, ...MONSTER_CHARACTERS];

// Pre-computed move name → manaCost map (avoids repeated find() in game loop)
const MOVE_COST_MAP: Record<string, number> = {};
ALL_CHARS.forEach((ch) => {
  ch.moves.forEach((m) => {
    if (!(m.name in MOVE_COST_MAP)) MOVE_COST_MAP[m.name] = m.manaCost;
  });
});

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
          <div style={{
            animation: animState === "idle" ? "monsterSquash 1.2s ease-in-out infinite" : "none",
          }}>
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
          </div>
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
  "data:image/gif;base64,R0lGODdhQABAAHcAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEKAAAACwAAAAAQABAAIE3lG6Z5VC/5VAAAAAC/5SPFiHrDt5TLcQIgZbHpd8xipRh4tZpm2pWzAR+IvmYmLACOK5ClsmJzV4jWq2mYOF+qx9pFEOIisYFRsfKaplOFSUaqtK0ZGZv25yCX+KexUC+xLcedeOAZYu5cat53jKx0OHiUpW1tGH2N+f0NFjB09Y3aFEjl/VnFWFYd1VXAkinyGVZunfCQGooWuYoofhp+rgThNkq17Z4UVW45MMjuju5GQtkpJNoetbotkdqCT3mJYlrwzL27Azb5XbbuDi7PY196N1ns8mXM0s8XTza5YjpV4xaD4sNHv3qRyl774i/TPOOdcskbV5Ae3TgvQKkLtSzS4zKZbtUplwaZP8KK1rM9w1Xv3ekbpUyGMpaQ468eA0rwU1lQh8C1WXM11FmO5Q0JUZLs00mQH3tuIVDSFSoS5sjzV05d0ppyZZLabU85VQnzKv4pjD7CFKqx55h45GQao1szxzjfqLNOFPi07gp3xJEpiEY1rJ2Kb2r5aomW6XhevFIdPesMcJgaezIuxLfRrFVUQbDQvfINcLLiqaE82viQKHL6MqBk6wxRrsRecLA05avWEaoDu89C49zRG3OMrtl7VpxLs8x55JeKPdek7c1zf1ExWwYGog4M/DjOJChvsH7PMdiuVpxae5+2U3aSBFjdWEVIlN06RssELid2nWi1xWvxmzsbL+BQSHFaEFd1Jt+mXSyRAJlkXNdZJ9o0UAad8hgFFMKBQZSbmBJEcZzB9UzVUJIfYMPIYkVp6E9XW3HBGA3fHDXZgjJI5lDT73wYAJYXAbQWCcuNZxjkMTQkIwQGYReQZHYoSBk3hxE0HKdVTgLGLDlYpxIyjlmZQrrCEPViTQtFUMBACH5BAUoAAAALAAAAABAAEAAgQAAADeUbpnlUL/lUAL/hI4pYOwQgoi0ztUwS8+JAT6HoWBI0EEog1KjtIwxAgzNBobdzB3tv4IIVSxWz1OzOXLKXW2U0awijylVQsqSDoNP99HU7Xq04rQoFZG5uZnh+xmXUhTWb2gSRbk8bnbRNLcxVFF4s4FiQsPTVfLFYPPIR2MzIVRY4ZAIVTS0obClFAeSFyNkCVRYmpYRtGbKmXMD9bFwZZiiSWU3RTtr+lfjpKGCsZurB0U1kdiABUOM/HnBiyt9aHCsEkQ0iC3yhXkVfV212+thfC0lkaktvSIjXkd0Msjd0d5+GYTvvWlmm0BbzXz4S8fBUy55eDhpqmYGC8EUM7hdKcepjIYY/3XEyfgG72DAWRAWfYSI6RQdEu/MEcqzx9uWjuJkqlFHbpslm3tA2akGRNpGf+eajdlyxCURa8he0KEXBWEJRceM0WvBk2K+TEhuCmL5bJu7eNFObsVncqraezVLLjzU7w5FtXQVicV1IV6nhxYc9qxbRtetZXuR8u2rRRHgRSLmFSVrol8xh4t9esWKWeA0W/kM96lsqoWyh/zcVXHJQypoVlg7p+RGjKlq0Jov2QaqLdo5r6tNPk3FFZhVhZt7MybX8e4lzqfxIDWecK+h4M0FL4QuQ6OPu1BDC+6One7vlMVaLjX6B7tCx5nyPr2u2LhF9ssajecXrHhl22MNtf9hN10ySPT200WvZYcKd1wdEp94px1Tk2hlaGPabPttVeAtnpCH20+gLJZLS2e8Y8V3ybmC4Ff3dVOYSrzgRk8fz+UU4m02dlXiPF3ZEl85L7JIIYUKQgXSND4u1Zk5nFnBnkNYGOGESId5gA9mOiYnHQeSreMEiztdKZY5rtjGilBqaMEkkcDFUyJBdTCzzpuGGbibXLiM44wFC0Z5mhRutiaQNXi6NBYhmixJQiVaAvpdoBrywgwm2qkgRhI+yQkjS6joBRScAGlBijCBnKAhVHYyamKMnCaKgSxLbIfMGbAWBZeGH23EARNh1KIFRIQQFdc+u2QHyQWAVHpDI05dpvPPS0SeAssnGegqRxKNRHDsG8rCikh3R3UgC7I7kOKHMCWJYlaS0s5lLSTmIlOJtaIE0MUmbqyXIDkaULuOKV1UEgG6a3lHnB7gZnVmLbe+MVUGvebZZQxtfFMAACH5BAUoAAAALAAAAABAAEAAgQAAADeUbpnlUL/lUAL/xI5nwO0iAJxUNmQSZoO722lcZ0QfBUkpuGihQGKR6YQuEHTpxOwmysi5BgEcTbX7xGydorF3TPIav8whEIA4e1CLchPCeape6OyLKE5xass5osl9OCm5CmnJPohCSbMIuMU1knBC+JYEGLQoFojF1vgYlKRQSKV3sGKmgiV45pDT2dAJKJBlUklimrWF+jAjuehEwlbE9+hotIKh8NG2MDdqougBGcm2KvpLqDCTXBw8auznVE1Mils7S+usGV3GWDMQcbr6gI2ewTr1KfbtGx7LKCrhqEike/eteaR9AjQsWyR0esIFWzEMlLIn3Y6Q6pEO18N3QbYIGoXLh5Z1/40CSrq4j8ogi9Za4UGhKVCtiiDfbWzkBRsXgBXKKEvYLxosPfKmvWrIRWDFSZwOknNDTKG7OUBPTVMpKudMmwZZypOEsgJJjC1FcpUGSebSVkBsxkridSY5eiy1TXzUEGXMB/C+SfQlkeDCrCnz/WOaB6M0vQQraqzphF+3tO4ElSQckUdZLM6Y1pynDHLmj4nN1JwSq/Mntm41HyMF0M0EsXRlzdGs9wlctHFTidQKEnbhZSenTsB3TLK30rpRKy5bgZa0y+CKE76NpMLwa59yOo/tJS47Ggo8seN6neDwhgXh9DGJB3z4zI2xbm8B7MdkqOtvRufrKj4V4QPrs/+Vjx9YyjEXj38t4TfMKqrIRaCBliG4kRp8NWcPcc9FEeAP3iFoz2aQ7cOfFHQhGJN/r6R30k4pkjiXh9h1kd5qqhGDEInOyPQcOEC1Q5Vq9+HnYWmM3ZcHDWeQ9iORa931GIz7IWfkUUTeEeBpeHnXhXRRLKedZygJ5ZhjD9I0U2KHATihSRO5JJ1RlJVR449lDUVDT2S0GcybEh7m5VRuANZVZd8t5yOUa2T5JygHDeKNQ5N8h2YdEqqmGFhZIqIPDBdpeSaXeC61mF9ljXOUPHVQOZmXcRX1p1Ob/BnhPyK2JieEpryRXVoRsgIXRH2ZkmSS7Fy1FKy85iWGhidi1tomWoNV44UOEiUTSE5SpDYcMisp8qZD2dxqJjorzLbdkZ0kRNxl4gHbEWVvJvsquNv6RJlwPIhnWKVaMIoEtFYVu6dUuyX6RmitMSmUO9xAoJyFdiYKcFuCGbSFDvk1UAAAOw==";
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
  const [catchTargetInfo, setCatchTargetInfo] = useState<{ emoji: string; type: string; hp: number } | null>(null);
  const [zoneStealTimer, setZoneStealTimer] = useState(0);
  const [zoneStealOwner, setZoneStealOwner] = useState<
    "player" | "enemy" | null
  >(null);
  const [zoneStealCol, setZoneStealCol] = useState(-1);
  const [giantStrikeCooldown, setGiantStrikeCooldown] = useState(0);
  const [timers, setTimers] = useState({
    silence: 0,
    playerFrozen: 0,
    absorbPoison: 0,
    enemySilence: 0,
    manaBoost: 0,
    enemyBuff: 0,
  });
  const [enemyMana, setEnemyMana] = useState(5);
  const [enemy2Mana, setEnemy2Mana] = useState(5);
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
  const activeHealIntervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const gameTickRef = useRef<() => void>(() => {});

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
      if (timers.playerFrozen > 0) return;
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
    [gameOver, timers.playerFrozen, zoneStealOwner, zoneStealTimer]
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
      timers.silence > 0
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
    timers.silence,
    triggerOpponent2Anim,
  ]);

  const useMove = useCallback(
    (moveName: string) => {
      if (gameOver) return;
      if (timers.enemySilence > 0) return; // Silenced by enemy
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
        setCatchTargetInfo({ emoji: catchTarget.emoji, type: catchTarget.type, hp: catchHP });
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
          setTimers(p => ({...p, silence: 40})); // 2 seconds at 50ms tick
          setTimers(p => ({...p, manaBoost: 40}));
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
          setTimers(p => ({...p, playerFrozen: 30}));
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
          setTimers(p => ({...p, absorbPoison: 60})); // 3 seconds
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
        // ── STATINU MOVES ──
        case "flame breath": {
          setBeams((p) => [
            ...p,
            { x: playerPos.x, y: playerPos.y, direction: "left", ttl: 1 },
          ]);
          // Burn tiles: place DOT tiles on ENEMY side (x: 0 to GRID_SIZE-1)
          for (let i = 0; i < 3; i++) {
            const bx = Math.floor(Math.random() * GRID_SIZE);
            setLilyPadTraps((p) => [
              ...p,
              { x: bx, y: playerPos.y, ttl: 80, effectType: "poisononly" },
            ]);
          }
          break;
        }
        case "guardian stance": {
          setPlayerHP((p) => Math.min(100, p + 15));
          playerHPRef.current = Math.min(100, playerHPRef.current + 15);
          // Place wall column in front
          const gsCol = playerPos.x + GRID_SIZE - 1;
          for (let gy = 0; gy < GRID_SIZE; gy++) {
            if (!blocks.some((b) => b.x === gsCol && b.y === gy)) {
              setBlocks((p) => [...p, { x: gsCol, y: gy, health: 2, owner: "player" }]);
            }
          }
          setExplosionEffects((p) => [
            ...p,
            { x: playerPos.x + GRID_SIZE, y: playerPos.y, ttl: 8, effectType: "chorus" },
          ]);
          break;
        }
        // ── SCIMARK MOVES ──
        case "sword dive": {
          // Pierce 4 tiles ahead, ignoring blocks
          const sdDmg = 35;
          for (let dx = 1; dx <= 4; dx++) {
            const sx = playerPos.x + GRID_SIZE - dx;
            if (sx >= 0 && sx < GRID_SIZE * 2) {
              setExplosionEffects((p) => [
                ...p,
                { x: sx, y: playerPos.y, ttl: 4, effectType: "slash" },
              ]);
            }
          }
          if (opponentHP > 0 && opponentPos.y === playerPos.y) {
            const dist = (playerPos.x + GRID_SIZE) - opponentPos.x;
            if (dist > 0 && dist <= 4) dmgEnemy(0, sdDmg);
          }
          if (currentEnemy2 && opponent2HP > 0 && opponent2Pos.y === playerPos.y) {
            const dist2 = (playerPos.x + GRID_SIZE) - opponent2Pos.x;
            if (dist2 > 0 && dist2 <= 4) dmgEnemy(1, sdDmg);
          }
          break;
        }
        case "tidal wave": {
          // Slow-moving 2-row wave from player's rear centre toward enemy's far side
          const twDmg = 15;
          const cy1 = Math.floor(GRID_SIZE / 2) - 1;
          const cy2 = Math.floor(GRID_SIZE / 2);
          const totalCols = GRID_SIZE * 2;
          for (let col = 0; col < totalCols; col++) {
            const wx = GRID_SIZE * 2 - 1 - col; // start from player rear, move left
            const delay = col * 250; // 250ms between columns
            setTimeout(() => {
              // Visual: frozen tile effect at wave front
              setLilyPadTraps((p) => [
                ...p,
                { x: wx, y: cy1, ttl: 20, effectType: "frozentile" },
                { x: wx, y: cy2, ttl: 20, effectType: "frozentile" },
              ]);
              setExplosionEffects((p) => [
                ...p,
                { x: wx, y: cy1, ttl: 4, effectType: "explosion" },
                { x: wx, y: cy2, ttl: 4, effectType: "explosion" },
              ]);
              // Damage enemies if wave passes through them
              if (opponentPosRef.current.x === wx &&
                  (opponentPosRef.current.y === cy1 || opponentPosRef.current.y === cy2)) {
                setOpponentHP((p) => Math.max(0, p - twDmg));
              }
              if (opponent2PosRef.current &&
                  opponent2PosRef.current.x === wx &&
                  (opponent2PosRef.current.y === cy1 || opponent2PosRef.current.y === cy2)) {
                setOpponent2HP((p) => Math.max(0, p - twDmg));
              }
            }, delay);
          }
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
      timers.enemySilence,
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
        timers.enemyBuff > 0 ? Math.floor(Math.random() * 4 + 1) : 1;
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
          setTimers(p => ({...p, enemyBuff: 60}));
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
              dmg: 10 * buffMul,
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
            setTimers(p => ({...p, playerFrozen: 30}));
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
          activeHealIntervals.current.push(hi);
          setTimeout(() => {
            clearInterval(hi);
            activeHealIntervals.current = activeHealIntervals.current.filter(id => id !== hi);
          }, 1500);
          break;
        }
        // ═══ SLIME TRAIL: heal self 10 HP (mirrors player heal puddles) ═══
        case "slime trail": {
          healSelf(5);
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
        // ═══ FLAME BREATH: fire beam across row + burn tiles (Statinu) ═══
        case "flame breath": {
          setBeams((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, direction: "right" as const, ttl: 1 },
          ]);
          for (let i = 0; i < 3; i++) {
            const bx = GRID_SIZE + Math.floor(Math.random() * GRID_SIZE);
            setLilyPadTraps((p) => [
              ...p,
              { x: bx, y: ePos.y, ttl: 80, effectType: "poisononly" },
            ]);
          }
          break;
        }
        // ═══ GUARDIAN STANCE: heal self + place wall (Statinu) ═══
        case "guardian stance": {
          healSelf(15);
          const gsCol2 = ePos.x + 1;
          for (let gy2 = 0; gy2 < GRID_SIZE; gy2++) {
            if (!blocks.some((b) => b.x === gsCol2 && b.y === gy2)) {
              setBlocks((p) => [...p, { x: gsCol2, y: gy2, health: 2, owner: "enemy" }]);
            }
          }
          setExplosionEffects((p) => [
            ...p,
            { x: ePos.x, y: ePos.y, ttl: 8, effectType: "chorus" },
          ]);
          break;
        }
        // ═══ SWORD DIVE: pierce 4 tiles ignoring blocks (Scimark) ═══
        case "sword dive": {
          const sdDmgE = 35 * buffMul;
          for (let dx = 1; dx <= 4; dx++) {
            const sx2 = ePos.x + dx;
            if (sx2 >= 0 && sx2 < GRID_SIZE * 2) {
              setExplosionEffects((p) => [
                ...p,
                { x: sx2, y: ePos.y, ttl: 4, effectType: "slash" },
              ]);
            }
          }
          if (sameRow) applyDmg(sdDmgE);
          break;
        }
        // ═══ TIDAL WAVE: slow 2-row wave from enemy rear toward player far side (Scimark) ═══
        case "tidal wave": {
          const twDmgE = 15 * buffMul;
          const cy1e = Math.floor(GRID_SIZE / 2) - 1;
          const cy2e = Math.floor(GRID_SIZE / 2);
          const totalColsE = GRID_SIZE * 2;
          for (let col = 0; col < totalColsE; col++) {
            const wx2 = col; // start from enemy rear (0), move right
            const delay2 = col * 250;
            setTimeout(() => {
              setLilyPadTraps((p) => [
                ...p,
                { x: wx2, y: cy1e, ttl: 20, effectType: "frozentile" },
                { x: wx2, y: cy2e, ttl: 20, effectType: "frozentile" },
              ]);
              setExplosionEffects((p) => [
                ...p,
                { x: wx2, y: cy1e, ttl: 4, effectType: "explosion" },
                { x: wx2, y: cy2e, ttl: 4, effectType: "explosion" },
              ]);
              // Damage player if wave passes through them
              const pp = playerPosRef.current;
              if (pp.x + GRID_SIZE === wx2 && (pp.y === cy1e || pp.y === cy2e)) {
                setPlayerHP((p) => {
                  const n = Math.max(0, p - twDmgE);
                  playerHPRef.current = n;
                  return n;
                });
              }
            }, delay2);
          }
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
      timers.enemyBuff,
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
    if (deck && deck.length > 0 && timers.silence <= 0 && Math.random() < 0.5) {
      const affordable = deck.filter((c) => {
        const cost = MOVE_COST_MAP[c];
        return cost != null && enemyMana >= cost;
      });
      if (affordable.length > 0) {
        const pick = affordable[Math.floor(Math.random() * affordable.length)];
        const cost = MOVE_COST_MAP[pick] ?? 0;
        setEnemyMana((p) => p - cost);
        enemyUseCard(pick, opponentPosRef.current, 0);
        return; // Used card, skip normal shooting
      }
    }
    if (
      Math.random() < (currentEnemy?.shootChance ?? 0.3) &&
      opponentBullets.length < MAX_SHOTS &&
      timers.silence <= 0
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
    timers.silence,
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
    if (deck2 && deck2.length > 0 && timers.silence <= 0 && Math.random() < 0.5) {
      const affordable2 = deck2.filter((c) => {
        const cost = MOVE_COST_MAP[c];
        return cost != null && enemy2Mana >= cost;
      });
      if (affordable2.length > 0) {
        const pick2 =
          affordable2[Math.floor(Math.random() * affordable2.length)];
        const cost = MOVE_COST_MAP[pick2] ?? 0;
        setEnemy2Mana((p) => p - cost);
        enemyUseCard(pick2, opponent2PosRef.current, 1);
        return;
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
    timers.silence,
    enemy2Mana,
    enemyUseCard,
  ]);

  // ── GAME LOOP (tick function updates every render, interval is stable) ──
  gameTickRef.current = () => {
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
        setMalipoleFrenzyTimer((p) => {
          if (p - 1 <= 0) {
            setMalipoleFrenzyActive(false);
            return 0;
          }
          return p - 1;
        });
      }
      if (tongueWhipActive) {
        setTongueWhipActive((p) => {
          if (!p) return null;
          const next = p.ttl - 1;
          return next <= 0 ? null : { ...p, ttl: next };
        });
      }
      // Batch decrement all simple timers
      setTimers(p => ({
        silence: Math.max(0, p.silence - (p.silence > 0 ? 1 : 0)),
        playerFrozen: Math.max(0, p.playerFrozen - (p.playerFrozen > 0 ? 1 : 0)),
        absorbPoison: Math.max(0, p.absorbPoison - (p.absorbPoison > 0 ? 1 : 0)),
        enemySilence: Math.max(0, p.enemySilence - (p.enemySilence > 0 ? 1 : 0)),
        manaBoost: Math.max(0, p.manaBoost - (p.manaBoost > 0 ? 1 : 0)),
        enemyBuff: Math.max(0, p.enemyBuff - (p.enemyBuff > 0 ? 1 : 0)),
      }));
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
                setTimers(p => ({...p, playerFrozen: 30})); // 1.5s stun
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
      const manaInterval = timers.manaBoost > 0 ? 5 : 10;
      if (tickCount % manaInterval === 0) {
        setPlayerMana((p) => Math.min(p + 1, MAX_MANA));
        if (hand.length < MAX_HAND_SIZE) drawCard();
      }
      // Enemy mana regen (slightly slower than player)
      if (tickCount % 8 === 0) {
        setEnemyMana((p) => Math.min(MAX_MANA, p + 1));
        if (currentEnemy2 && opponent2HP > 0) setEnemy2Mana((p) => Math.min(MAX_MANA, p + 1));
      }
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
                if (timers.absorbPoison > 0) {
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
      // ── Mushroom turrets take damage from non-poison attacks (only opposing turrets) ──
      const dmgMushTurrets = (tx: number, ty: number, dmg: number, targetOwner: "player" | "enemy") => {
        setTurrets((p) =>
          p.map((t) =>
            t.isMushroom && t.owner === targetOwner && t.x === tx && t.y === ty ? { ...t, hp: t.hp - dmg } : t
          ).filter((t) => t.hp > 0)
        );
      };
      // Player beams damage enemy mushroom turrets, enemy beams damage player mushroom turrets
      beams.forEach((b) => {
        const target = b.direction === "left" ? "enemy" : "player";
        turrets.filter((t) => t.isMushroom && t.owner === target && t.y === b.y).forEach((t) => dmgMushTurrets(t.x, t.y, 20, target));
      });
      // Player punches/slashes/bombs only hit enemy mushroom turrets
      if (punch) {
        dmgMushTurrets(punch.x, punch.y, 40, "enemy");
      }
      slash.forEach((s) => dmgMushTurrets(s.x, s.y, 30, "enemy"));
      bombs.forEach((b) => dmgMushTurrets(b.x, b.y, 40, "enemy"));
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
                setTimers(p => ({...p, silence: 60}));
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
              setTimers(p => ({...p, enemySilence: 60}));
              newEfx.push({ x: e.x, y: e.y, ttl: 5, effectType: "explosion" });
              return false;
            }
          }
          return true;
        });
        return [...kept, ...newEfx];
      });
      // ── ABSORB POISON: heal on poison tiles (explosionEffects) ──
      if (timers.absorbPoison > 0) {
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
            setTimers(p => ({...p, enemyBuff: 0}));
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
  };

  // Stable interval — created once, calls latest tick function via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const gl = setInterval(() => gameTickRef.current(), GAME_TICK);
    return () => clearInterval(gl);
  }, []);

  // Cleanup heal intervals on unmount
  useEffect(() => {
    return () => {
      activeHealIntervals.current.forEach((id) => clearInterval(id));
      activeHealIntervals.current = [];
    };
  }, []);

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
            {timers.manaBoost > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#44aaff",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                ⚡ MANA BOOST ({Math.ceil(timers.manaBoost / 20)}s)
              </div>
            )}
            {timers.playerFrozen > 0 && (
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
                ❄️ FROZEN ({Math.ceil(timers.playerFrozen / 20)}s)
              </div>
            )}
            {timers.silence > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#c4a060",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                🔇 ENEMY SILENCED ({Math.ceil(timers.silence / 20)}s)
              </div>
            )}
            {timers.enemySilence > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#cc3366",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                🔇 YOU ARE SILENCED ({Math.ceil(timers.enemySilence / 20)}s)
              </div>
            )}
            {timers.absorbPoison > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#44cc88",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                🍄 ABSORB POISON ({Math.ceil(timers.absorbPoison / 20)}s)
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
          {timers.enemyBuff > 0 && (
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
          <div style={{ display: "flex", gap: 2, marginBottom: "0.2rem" }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 6,
                  background:
                    i < Math.ceil((opponentHP / opponentMaxHP) * 10)
                      ? "#cc3333"
                      : "#ddd",
                  border: "1px solid #080808",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: "0.65rem", marginBottom: "0.3rem" }}>
            HP: {opponentHP}/{opponentMaxHP}
          </div>
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
                  {catchTargetInfo?.emoji} {catchTargetInfo?.type?.toUpperCase()} is
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
                  {catchTargetInfo?.emoji} {catchTargetInfo?.type?.toUpperCase()}{" "}
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
                  The {catchTargetInfo?.type} escaped the trap.
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
                  Weaken enemy below 20 HP first. ({catchTargetInfo?.hp} HP)
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
      <style>{`@keyframes scan { 0% { top: 0%; } 100% { top: 100%; } } @keyframes catchSpin { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.2); } 100% { transform: rotate(360deg) scale(1); } } @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } } @keyframes monsterSquash { 0%, 100% { transform: scaleY(1) translateY(0); } 50% { transform: scaleY(0.92) translateY(3px); } }`}</style>
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
            BN:to the
            <br />
            horizon
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

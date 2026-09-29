import React, { useState, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Box, Sphere, Cone } from "@react-three/drei";
import * as THREE from "three";

// Character types and interfaces
type Character = {
  name: string;
  emoji: string;
  moves: Move[];
};

type Position = {
  x: number;
  y: number;
};

type Bullet = Position & {
  direction: "left" | "right";
  isRat?: boolean;
  chargePower?: number;
};

type Block = Position & {
  health: number;
};

type Beam = Position & {
  direction: "left" | "right";
  ttl: number;
};

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
    | "lilypad";
  direction?: "left" | "right";
};

type Bomb = Position;

type DelayBomb = Position & {
  timer: number;
};

type Boomerang = Position & {
  phase: "forward" | "backward";
  distanceTraveled: number;
};

type Move = {
  name: string;
  manaCost: number;
  cooldown: number;
};

// Game constants
const GRID_SIZE = 4;
const MAX_SHOTS = 2;
const GAME_TICK = 100;
const OPPONENT_MOVE_INTERVAL = 5;
const MAX_HAND_SIZE = 2;
const MANA_REGEN_RATE = 1000;
const MAX_MANA = 10;
const DELAY_BOMB_TIMER = 30;

// Character definitions
const CHARACTERS: Character[] = [
  {
    name: "Cowboy",
    emoji: "🤠",
    moves: [
      { name: "slash", manaCost: 1, cooldown: 1000 },
      { name: "beam", manaCost: 3, cooldown: 1000 },
      { name: "punch", manaCost: 1, cooldown: 1000 },
      { name: "bomb", manaCost: 4, cooldown: 1000 },
      { name: "tractor beam", manaCost: 3, cooldown: 1000 },
      { name: "delay bomb", manaCost: 5, cooldown: 1000 },
      { name: "boomerang", manaCost: 3, cooldown: 1000 },
      { name: "lasso", manaCost: 2, cooldown: 1000 },
    ],
  },
  {
    name: "Hogglin",
    emoji: "🦔",
    moves: [
      { name: "leafstorm", manaCost: 5, cooldown: 1000 },
      { name: "flying sword", manaCost: 3, cooldown: 1000 },
      { name: "wall", manaCost: 4, cooldown: 1000 },
      { name: "clawingsword", manaCost: 2, cooldown: 1000 },
    ],
  },
  {
    name: "Rat King",
    emoji: "🐀",
    moves: [
      { name: "rat pack", manaCost: 1, cooldown: 1000 },
      { name: "trash toss", manaCost: 2, cooldown: 1000 },
      { name: "street swarm", manaCost: 5, cooldown: 1000 },
    ],
  },
  {
    name: "Malipole",
    emoji: "🐸",
    moves: [
      { name: "tongue whip", manaCost: 2, cooldown: 1000 },
      { name: "random hop", manaCost: 3, cooldown: 1000 },
      { name: "frog chorus", manaCost: 4, cooldown: 1000 },
      { name: "lily pad trap", manaCost: 3, cooldown: 1000 },
    ],
  },
];

// 3D Components (keeping all existing 3D logic)
const Tile3D: React.FC<{
  x: number;
  y: number;
  isPlayerGrid: boolean;
  color: string;
  highlight?: boolean;
}> = ({ x, y, isPlayerGrid, color, highlight }) => {
  const gridOffset = isPlayerGrid ? GRID_SIZE : 0;
  const position: [number, number, number] = [x + gridOffset, 0, y];

  return (
    <Box position={position} args={[0.9, 0.1, 0.9]} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        emissive={highlight ? color : "#000000"}
        emissiveIntensity={highlight ? 0.5 : 0}
      />
    </Box>
  );
};

const Character3D: React.FC<{
  x: number;
  y: number;
  emoji: string;
  isOpponent?: boolean;
  stunned?: boolean;
  isCharging?: boolean;
  frenzy?: boolean;
}> = ({ x, y, emoji, isOpponent = false, stunned, isCharging, frenzy }) => {
  const gridOffset = isOpponent ? 0 : GRID_SIZE;
  const position: [number, number, number] = [x + gridOffset, 0.8, y];

  return (
    <group position={position}>
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
      <Text position={[0, 0.5, 0]} fontSize={0.4} color="white" anchorX="center" anchorY="middle">
        {stunned ? "😵" : emoji}
      </Text>
      {isCharging && (
        <Sphere args={[0.4, 16, 16]} position={[0, 0, 0]}>
          <meshStandardMaterial color="#ffff00" transparent opacity={0.3} emissive="#ffff00" emissiveIntensity={1} />
        </Sphere>
      )}
    </group>
  );
};

const Projectile3D: React.FC<{
  x: number;
  y: number;
  type: "normal" | "rat" | "charged" | "opponent";
  direction: "left" | "right";
}> = ({ x, y, type, direction }) => {
  const position: [number, number, number] = [x, 0.4, y];

  const getColor = () => {
    switch (type) {
      case "rat": return "#ff9900";
      case "charged": return "#00ff00";
      case "opponent": return "#4444ff";
      default: return "#ffff00";
    }
  };

  return (
    <group position={position} rotation={[0, direction === "left" ? 0 : Math.PI, 0]}>
      <Cone args={[0.15, 0.4, 8]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <meshStandardMaterial color={getColor()} emissive={getColor()} emissiveIntensity={0.5} />
      </Cone>
    </group>
  );
};

const Effect3D: React.FC<{ x: number; y: number; type: string; ttl: number }> = ({ x, y, type, ttl }) => {
  const position: [number, number, number] = [x, 0.5, y];
  const scale = Math.min(1, ttl / 10);

  const getColor = () => {
    switch (type) {
      case "explosion": return "#ff0000";
      case "leafstorm": return "#00ff00";
      case "flyingsword":
      case "clawingsword": return "#9900ff";
      case "ratpack":
      case "ratstorm": return "#ff9900";
      case "tonguewhip": return "#ff00ff";
      case "teleport": return "#00ffff";
      case "chorus": return "#00ff00";
      case "lilypad": return "#88ff88";
      default: return "#ffffff";
    }
  };

  return (
    <Sphere position={position} args={[0.3 * scale, 16, 16]} castShadow>
      <meshStandardMaterial color={getColor()} transparent opacity={0.6} emissive={getColor()} emissiveIntensity={1} />
    </Sphere>
  );
};

const Block3D: React.FC<{ x: number; y: number; health: number }> = ({ x, y, health }) => {
  const position: [number, number, number] = [x, 0.4, y];
  const color = health > 1 ? "#ff8800" : "#ff4400";

  return (
    <Box position={position} args={[0.8, 0.8, 0.8]} castShadow>
      <meshStandardMaterial color={color} />
    </Box>
  );
};

const Beam3D: React.FC<{ y: number; direction: "left" | "right"; isPlayerGrid: boolean }> = ({
  y,
  direction,
  isPlayerGrid,
}) => {
  const startX = isPlayerGrid ? GRID_SIZE : 0;
  const endX = isPlayerGrid ? GRID_SIZE * 2 : GRID_SIZE;
  const centerX = (startX + endX) / 2;
  const length = GRID_SIZE;

  return (
    <Box position={[centerX, 0.3, y]} args={[length, 0.1, 0.3]} castShadow>
      <meshStandardMaterial color="#9900ff" emissive="#9900ff" emissiveIntensity={1} transparent opacity={0.7} />
    </Box>
  );
};

// Main 3D Game Scene Component
const GameScene3D: React.FC<{
  playerPos: Position;
  opponentPos: Position;
  playerBullets: Bullet[];
  opponentBullets: Bullet[];
  blocks: Block[];
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
}> = ({
  playerPos,
  opponentPos,
  playerBullets,
  opponentBullets,
  blocks,
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
}) => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[GRID_SIZE, 5, GRID_SIZE]} intensity={0.5} />

      {Array.from({ length: GRID_SIZE * 2 }, (_, x) =>
        Array.from({ length: GRID_SIZE }, (_, y) => {
          const isPlayerGrid = x >= GRID_SIZE;
          const localX = isPlayerGrid ? x - GRID_SIZE : x;
          let color = isPlayerGrid ? "#ff4444" : "#4444ff";
          let highlight = false;

          if (isPlayerGrid && localX === playerPos.x && y === playerPos.y) highlight = true;
          if (!isPlayerGrid && localX === opponentPos.x && y === opponentPos.y) highlight = true;

          return (
            <Tile3D
              key={`tile-${x}-${y}`}
              x={localX}
              y={y}
              isPlayerGrid={isPlayerGrid}
              color={color}
              highlight={highlight}
            />
          );
        })
      )}

      <Character3D x={playerPos.x} y={playerPos.y} emoji={selectedCharacter.emoji} isCharging={isCharging} frenzy={malipoleFrenzyActive} />
      <Character3D x={opponentPos.x} y={opponentPos.y} emoji="👾" isOpponent stunned={opponentStunned > 0} />

      {playerBullets.map((bullet, i) => (
        <Projectile3D
          key={`player-bullet-${i}`}
          x={bullet.x}
          y={bullet.y}
          type={bullet.isRat ? "rat" : bullet.chargePower ? "charged" : "normal"}
          direction="left"
        />
      ))}

      {opponentBullets.map((bullet, i) => (
        <Projectile3D key={`opponent-bullet-${i}`} x={bullet.x} y={bullet.y} type="opponent" direction="right" />
      ))}

      {blocks.map((block, i) => (
        <Block3D key={`block-${i}`} x={block.x} y={block.y} health={block.health} />
      ))}

      {beams.map((beam, i) => (
        <Beam3D key={`beam-${i}`} y={beam.y} direction={beam.direction} isPlayerGrid={true} />
      ))}

      {tractorBeam && <Beam3D y={tractorBeam.y} direction={tractorBeam.direction} isPlayerGrid={true} />}

      {explosionEffects.map((effect, i) => (
        <Effect3D key={`effect-${i}`} x={effect.x} y={effect.y} type={effect.effectType || "explosion"} ttl={effect.ttl} />
      ))}

      {lilyPadTraps.map((trap, i) => (
        <Effect3D key={`lilypad-${i}`} x={trap.x} y={trap.y} type="lilypad" ttl={trap.ttl} />
      ))}

      {tongueWhipActive && <Effect3D x={tongueWhipActive.x} y={tongueWhipActive.y} type="tonguewhip" ttl={tongueWhipActive.ttl} />}

      {slash.map((s, i) => (
        <Effect3D key={`slash-${i}`} x={s.x} y={s.y} type="flyingsword" ttl={s.ttl} />
      ))}

      {punch && <Effect3D x={punch.x} y={punch.y} type="explosion" ttl={punch.ttl} />}
      {lasso && <Effect3D x={lasso.x} y={lasso.y} type="tonguewhip" ttl={lasso.ttl} />}

      {bombs.map((bomb, i) => (
        <Sphere key={`bomb-${i}`} position={[bomb.x, 0.3, bomb.y]} args={[0.25, 16, 16]} castShadow>
          <meshStandardMaterial color="#333333" />
        </Sphere>
      ))}

      {delayBombs.map((bomb, i) => (
        <group key={`delay-bomb-${i}`} position={[bomb.x, 0.3, bomb.y]}>
          <Sphere args={[0.25, 16, 16]} castShadow>
            <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={0.5} />
          </Sphere>
          <Text position={[0, 0.5, 0]} fontSize={0.2} color="white">
            {Math.ceil(bomb.timer / 10)}
          </Text>
        </group>
      ))}

      {boomerang && (
        <Sphere position={[boomerang.x, 0.4, boomerang.y]} args={[0.2, 16, 16]} castShadow>
          <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.7} />
        </Sphere>
      )}

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[GRID_SIZE, -0.1, GRID_SIZE / 2]}>
        <planeGeometry args={[GRID_SIZE * 3, GRID_SIZE * 2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </>
  );
};

// Main Game Component
const IsometricGame3D = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(CHARACTERS[0]);
  const [playerPos, setPlayerPos] = useState<Position>({ x: 3, y: 1 });
  const [opponentPos, setOpponentPos] = useState<Position>({ x: 0, y: 1 });
  const [playerHP, setPlayerHP] = useState(100);
  const [opponentHP, setOpponentHP] = useState(100);
  const [playerBullets, setPlayerBullets] = useState<Bullet[]>([]);
  const [opponentBullets, setOpponentBullets] = useState<Bullet[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
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
  const [deck, setDeck] = useState<Move[]>([]);
  const [explosionEffects, setExplosionEffects] = useState<TimedEffect[]>([]);
  const [chargeTime, setChargeTime] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [malipoleFrenzyActive, setMalipoleFrenzyActive] = useState(false);
  const [malipoleFrenzyTimer, setMalipoleFrenzyTimer] = useState(0);
  const [malipoleBulletHits, setMalipoleBulletHits] = useState(0);
  const [tongueWhipActive, setTongueWhipActive] = useState<TimedEffect | null>(null);
  const [lilyPadTraps, setLilyPadTraps] = useState<TimedEffect[]>([]);

  const startGame = (character: Character) => {
    setSelectedCharacter(character);
    setGameStarted(true);
    const initialDeck = [...character.moves];
    setDeck(initialDeck);
    setHand([]);
    setPlayerMana(5);
  };

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      if (gameOver) return;
      setPlayerPos((prev) => ({
        x: Math.max(0, Math.min(GRID_SIZE - 1, prev.x + dx)),
        y: Math.max(0, Math.min(GRID_SIZE - 1, prev.y + dy)),
      }));
    },
    [gameOver]
  );

  const fireBullet = useCallback(
    (isPlayer: boolean) => {
      if (gameOver) return;

      if (isPlayer) {
        if (selectedCharacter.name === "Malipole") {
          if (isCharging) {
            if (playerBullets.length >= MAX_SHOTS) return;
            
            const chargeLevel = Math.min(3, Math.floor(chargeTime / 10));
            
            if (chargeLevel > 0) {
              const newBullet: Bullet = {
                x: playerPos.x + GRID_SIZE - 1,
                y: playerPos.y,
                direction: "left",
                chargePower: chargeLevel,
              };
              setPlayerBullets((prev) => [...prev, newBullet]);
            }
            
            setChargeTime(0);
            setIsCharging(false);
          } else {
            setIsCharging(true);
          }
          return;
        } else if (selectedCharacter.name === "Rat King") {
          if (isCharging) {
            if (chargeTime >= 50) {
              if (playerBullets.length < MAX_SHOTS) {
                const randomY = Math.floor(Math.random() * GRID_SIZE);
                const newBullet: Bullet = {
                  x: playerPos.x + GRID_SIZE - 1,
                  y: randomY,
                  direction: "left",
                  isRat: true,
                };
                setPlayerBullets((prev) => [...prev, newBullet]);
              }
            }
            setChargeTime(0);
            setIsCharging(false);
          } else {
            setIsCharging(true);
          }
          return;
        } else if (selectedCharacter.name === "Hogglin") {
          if (blocks.length >= MAX_SHOTS) return;
          const newBlock: Block = {
            x: playerPos.x + GRID_SIZE - 1,
            y: playerPos.y,
            health: 2,
          };
          setBlocks((prev) => [...prev, newBlock]);
        } else {
          if (playerBullets.length >= MAX_SHOTS) return;
          const newBullet: Bullet = {
            x: playerPos.x + GRID_SIZE - 1,
            y: playerPos.y,
            direction: "left",
          };
          setPlayerBullets((prev) => [...prev, newBullet]);
        }
      } else {
        if (opponentBullets.length >= MAX_SHOTS) return;
        const newBullet: Bullet = {
          x: opponentPos.x,
          y: opponentPos.y,
          direction: "right",
        };
        setOpponentBullets((prev) => [...prev, newBullet]);
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
    ]
  );

  const useMove = useCallback(
    (moveName: string) => {
      if (gameOver) return;
      const move = hand.find((m) => m.name === moveName);
      if (!move || playerMana < move.manaCost) return;

      setPlayerMana((prev) => prev - move.manaCost);
      setHand((prev) => prev.filter((m) => m !== move));
      setDeck((prev) => [...prev, move]);

      if (selectedCharacter.name === "Malipole") {
        switch (moveName) {
          case "tongue whip":
            const whipX = playerPos.x + GRID_SIZE - 3;
            setTongueWhipActive({
              x: whipX,
              y: playerPos.y,
              ttl: 2,
              effectType: "tonguewhip"
            });
            
            if (opponentPos.x <= whipX && opponentPos.y === playerPos.y) {
              setOpponentHP((prev) => Math.max(0, prev - 15));
              setOpponentStunned(20);
            }
            break;
            
          case "random hop":
            const teleportRange = 3;
            if (
              Math.abs(opponentPos.x - playerPos.x) <= teleportRange &&
              Math.abs(opponentPos.y - playerPos.y) <= teleportRange
            ) {
              setOpponentHP((prev) => Math.max(0, prev - 20));
              
              const randomX = Math.floor(Math.random() * GRID_SIZE);
              const randomY = Math.floor(Math.random() * GRID_SIZE);
              
              setOpponentPos({ x: randomX, y: randomY });
              
              setExplosionEffects((prev) => [
                ...prev,
                {
                  x: opponentPos.x,
                  y: opponentPos.y,
                  ttl: 5,
                  effectType: "teleport"
                },
                {
                  x: randomX, 
                  y: randomY,
                  ttl: 5,
                  effectType: "teleport"
                }
              ]);
            }
            break;
            
          case "frog chorus":
            setMalipoleFrenzyActive(true);
            setMalipoleFrenzyTimer(50);
            
            const chorusEffects: TimedEffect[] = [];
            for (let i = 0; i < GRID_SIZE; i++) {
              chorusEffects.push({
                x: i,
                y: Math.floor(Math.random() * GRID_SIZE),
                ttl: 10,
                effectType: "chorus"
              });
            }
            setExplosionEffects((prev) => [...prev, ...chorusEffects]);
            break;
            
          case "lily pad trap":
            const trapLocations = [
              { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) },
              { x: 1, y: 1 },
              { x: 1, y: GRID_SIZE - 2 },
              { x: GRID_SIZE - 2, y: 1 },
              { x: GRID_SIZE - 2, y: GRID_SIZE - 2 }
            ];
            
            const selectedTraps = trapLocations
              .sort(() => Math.random() - 0.5)
              .slice(0, 2);
              
            const newTraps = selectedTraps.map(pos => ({
              x: pos.x,
              y: pos.y,
              ttl: 100,
              effectType: "lilypad" as const
            }));
            
            setLilyPadTraps((prev) => [...prev, ...newTraps]);
            break;
        }
      } else {
        switch (moveName) {
          case "beam":
            setBeams((prev) => [
              ...prev,
              { x: playerPos.x, y: playerPos.y, direction: "left", ttl: 1 },
            ]);
            break;
          case "punch":
            const punchX =
              playerPos.x === 0 ? GRID_SIZE - 1 : playerPos.x - 1 + GRID_SIZE;
            setPunch({ x: punchX, y: playerPos.y, ttl: 1 });
            break;
          case "slash":
            const baseX =
              playerPos.x === 0 ? GRID_SIZE - 1 : playerPos.x - 1 + GRID_SIZE;
            const newSlash = [
              { x: baseX, y: playerPos.y - 1, ttl: 1 },
              { x: baseX, y: playerPos.y, ttl: 1 },
              { x: baseX, y: playerPos.y + 1, ttl: 1 },
            ].filter((s) => s.y >= 0 && s.y < GRID_SIZE);
            setSlash(newSlash);
            break;
          case "bomb":
            const bombX =
              playerPos.x <= 1
                ? GRID_SIZE - 2 + playerPos.x
                : playerPos.x - 2 + GRID_SIZE;
            setBombs((prev) => [...prev, { x: bombX, y: playerPos.y }]);
            break;
          case "tractor beam":
            setTractorBeam({
              x: playerPos.x + GRID_SIZE - 1,
              y: playerPos.y,
              direction: "left",
              ttl: 1,
            });
            break;
          case "delay bomb":
            const delayBombX =
              playerPos.x <= 1
                ? GRID_SIZE - 2 + playerPos.x
                : playerPos.x - 2 + GRID_SIZE;
            setDelayBombs((prev) => [
              ...prev,
              { x: delayBombX, y: playerPos.y, timer: DELAY_BOMB_TIMER },
            ]);
            break;
          case "boomerang":
            const startX = playerPos.x + GRID_SIZE - 1;
            setBoomerang({
              x: startX,
              y: playerPos.y,
              phase: "forward",
              distanceTraveled: 0,
            });
            break;
          case "lasso":
            const lassoX = playerPos.x + GRID_SIZE - 4;
            setLasso({ x: lassoX, y: playerPos.y, ttl: 1 });
            break;
          case "leafstorm":
            const leafStormEffects: TimedEffect[] = [];
            for (let i = 0; i < GRID_SIZE; i++) {
              leafStormEffects.push({
                x: i,
                y: playerPos.y,
                ttl: 15,
                effectType: "leafstorm",
              });
              if (opponentPos.x === i && opponentPos.y === playerPos.y) {
                setOpponentHP((prev) => Math.max(0, prev - 20));
                setOpponentStunned(15);
              }
            }
            setExplosionEffects((prev) => [...prev, ...leafStormEffects]);
            break;
          case "flying sword":
            setExplosionEffects((prev) => [
              ...prev,
              {
                x: GRID_SIZE - 1,
                y: opponentPos.y,
                ttl: GRID_SIZE * 2,
                effectType: "flyingsword",
                direction: "right",
              },
            ]);
            break;
          case "clawingsword":
            setExplosionEffects((prev) => [
              ...prev,
              {
                x: 0,
                y: playerPos.y,
                ttl: GRID_SIZE * 2,
                effectType: "clawingsword",
                direction: "left",
              },
            ]);
            break;
          case "wall":
            const wallX = playerPos.x + GRID_SIZE - 2;
            for (let i = 0; i < GRID_SIZE; i++) {
              setBlocks((prev) => [...prev, { x: wallX, y: i, health: 1 }]);
            }
            break;
          case "rat pack":
            const ratPackEffects: TimedEffect[] = [];
            const frontX1 = playerPos.x + GRID_SIZE - 1;
            const frontX2 = playerPos.x + GRID_SIZE - 2;

            ratPackEffects.push({
              x: frontX1,
              y: playerPos.y,
              ttl: 3,
              effectType: "ratpack",
            });
            ratPackEffects.push({
              x: frontX2,
              y: playerPos.y,
              ttl: 3,
              effectType: "ratpack",
            });

            setExplosionEffects((prev) => [...prev, ...ratPackEffects]);
            break;
          case "trash toss":
            const targetX = playerPos.x + GRID_SIZE - 4;
            setExplosionEffects((prev) => [
              ...prev,
              {
                x: targetX,
                y: playerPos.y,
                ttl: 20,
                effectType: "ratstorm",
              },
            ]);
            break;
          case "street swarm":
            const swarmEffects: TimedEffect[] = [];

            for (let i = 0; i < 4; i++) {
              const offsetY = i - 1.5;
              const ratY = Math.max(
                0,
                Math.min(GRID_SIZE - 1, Math.round(playerPos.y + offsetY))
              );

              swarmEffects.push({
                x: playerPos.x + GRID_SIZE,
                y: ratY,
                ttl: 50,
                effectType: "ratstorm",
              });
            }

            setExplosionEffects((prev) => [...prev, ...swarmEffects]);
            break;
        }
      }
    },
    [gameOver, hand, playerMana, playerPos, opponentPos, selectedCharacter]
  );

  const drawCard = useCallback(() => {
    if (hand.length >= MAX_HAND_SIZE || deck.length === 0) return;

    const cardIndex = Math.floor(Math.random() * deck.length);
    const drawnCard = deck[cardIndex];

    setHand((prev) => [...prev, drawnCard]);
    setDeck((prev) => prev.filter((_, index) => index !== cardIndex));
  }, [hand, deck]);

  const moveOpponent = useCallback(() => {
    if (gameOver) return;
    const dx = Math.floor(Math.random() * 3) - 1;
    const dy = Math.floor(Math.random() * 3) - 1;

    const newX = Math.max(0, Math.min(GRID_SIZE - 1, opponentPos.x + dx));
    const newY = Math.max(0, Math.min(GRID_SIZE - 1, opponentPos.y + dy));

    const isBlocked = blocks.some(
      (block) => block.x === newX && block.y === newY
    );

    if (!isBlocked) {
      setOpponentPos({ x: newX, y: newY });
    }

    if (Math.random() < 0.3 && opponentBullets.length < MAX_SHOTS) {
      fireBullet(false);
    }
  }, [gameOver, opponentBullets.length, fireBullet, blocks, opponentPos]);

  // Game loop (keeping same logic but abbreviated for brevity)
  useEffect(() => {
    const gameLoop = setInterval(() => {
      if (gameOver) return;

      setTickCount((prev) => prev + 1);

      if (isCharging) {
        if (selectedCharacter.name === "Rat King" || selectedCharacter.name === "Malipole") {
          setChargeTime((prev) => prev + 1);
        }
      }

      if (malipoleFrenzyActive) {
        setMalipoleFrenzyTimer((prev) => prev - 1);
        if (malipoleFrenzyTimer <= 0) {
          setMalipoleFrenzyActive(false);
        }
      }

      if (tongueWhipActive) {
        setTongueWhipActive((prev) => 
          prev ? { ...prev, ttl: prev.ttl - 1 } : null
        );
        if (tongueWhipActive.ttl <= 0) {
          setTongueWhipActive(null);
        }
      }

      setLilyPadTraps((prev) => 
        prev
          .map(trap => ({ ...trap, ttl: trap.ttl - 1 }))
          .filter(trap => {
            if (trap.x === opponentPos.x && trap.y === opponentPos.y) {
              setOpponentHP((prevHP) => Math.max(0, prevHP - 10));
              setOpponentStunned(10);
              return false;
            }
            return trap.ttl > 0;
          })
      );

      if (tickCount % OPPONENT_MOVE_INTERVAL === 0 && opponentStunned === 0) {
        moveOpponent();
      }

      if (tickCount % 10 === 0) {
        setPlayerMana((prev) => Math.min(prev + 1, MAX_MANA));
        if (hand.length < MAX_HAND_SIZE) {
          drawCard();
        }
      }

      setExplosionEffects((prev) => {
        const updatedEffects = prev.map((effect) => {
          if (effect.effectType === "flyingsword") {
            return {
              ...effect,
              x: effect.x - 1,
              ttl: effect.ttl - 1,
            };
          }

          if (effect.effectType === "clawingsword") {
            return {
              ...effect,
              x: effect.x + 1,
              ttl: effect.ttl - 1,
            };
          }

          if (effect.effectType === "ratpack") {
            return {
              ...effect,
              ttl: effect.ttl - 1,
            };
          }

          if (effect.effectType === "ratstorm") {
            if (effect.ttl % 5 === 0) {
              const randomDx =
                Math.random() < 0.7 ? -1 : Math.floor(Math.random() * 3) - 1;
              const randomDy = Math.floor(Math.random() * 3) - 1;
              return {
                ...effect,
                x: Math.max(
                  0,
                  Math.min(GRID_SIZE * 2 - 1, effect.x + randomDx)
                ),
                y: Math.max(0, Math.min(GRID_SIZE - 1, effect.y + randomDy)),
                ttl: effect.ttl - 1,
              };
            } else {
              return {
                ...effect,
                ttl: effect.ttl - 1,
              };
            }
          }

          return {
            ...effect,
            ttl: effect.ttl - 1,
          };
        });

        return updatedEffects.filter((effect) => {
          if (effect.effectType === "flyingsword") {
            if (
              effect.x === GRID_SIZE - 1 ||
              (effect.x === opponentPos.x && effect.y === opponentPos.y)
            ) {
              setOpponentHP((prev) => Math.max(0, prev - 15));
            }
            return effect.ttl > 0 && effect.x >= 0;
          }

          if (effect.effectType === "clawingsword") {
            if (effect.x === opponentPos.x && effect.y === opponentPos.y) {
              setOpponentHP((prev) => Math.max(0, prev - 30));
            }
            return effect.ttl > 0 && effect.x < GRID_SIZE * 2;
          }

          if (effect.effectType === "ratpack") {
            if (effect.x === opponentPos.x && effect.y === opponentPos.y) {
              setOpponentHP((prev) => Math.max(0, prev - 10));
            }
            return effect.ttl > 0;
          }

          if (effect.effectType === "ratstorm") {
            if (effect.x === opponentPos.x && effect.y === opponentPos.y) {
              setOpponentHP((prev) => Math.max(0, prev - 10));
              return false;
            }

            if (
              effect.x < 0 ||
              effect.x >= GRID_SIZE * 2 ||
              effect.y < 0 ||
              effect.y >= GRID_SIZE
            ) {
              return false;
            }

            return effect.ttl > 0;
          }

          return effect.ttl > 0;
        });
      });

      setPlayerBullets((prev) =>
        prev
          .map((bullet) => {
            if (bullet.isRat) {
              const randomDy = Math.floor(Math.random() * 3) - 1;
              return {
                ...bullet,
                x: bullet.x - 1,
                y: Math.max(0, Math.min(GRID_SIZE - 1, bullet.y + randomDy)),
              };
            } else if (bullet.chargePower) {
              return {
                ...bullet,
                x: bullet.x - 1,
              };
            } else {
              return {
                ...bullet,
                x: bullet.x - 1,
              };
            }
          })
          .filter((bullet) => {
            if (bullet.x === opponentPos.x && bullet.y === opponentPos.y) {
              let damage = 10;
              
              if (bullet.chargePower) {
                damage = bullet.chargePower * 10;
                
                setMalipoleBulletHits((prev) => {
                  const newHits = prev + 1;
                  
                  if (newHits >= 3) {
                    setMalipoleFrenzyActive(true);
                    setMalipoleFrenzyTimer(50);
                    setMalipoleBulletHits(0);
                  }
                  
                  return newHits;
                });
              } else if (bullet.isRat) {
                damage = 20;
              }
              
              if (malipoleFrenzyActive && selectedCharacter.name === "Malipole") {
                const randomMultiplier = Math.random() * 5;
                damage = Math.min(50, Math.floor(damage * randomMultiplier));
              }
              
              setOpponentHP((prev) => Math.max(0, prev - damage));
              return false;
            }

            return bullet.x >= 0 && bullet.x < GRID_SIZE * 2;
          })
      );

      setOpponentBullets((prev) => {
        const updatedBullets = prev.map((bullet) => ({
          ...bullet,
          x: bullet.x + 1,
        }));

        return updatedBullets.filter((bullet) => {
          const hitBlock = blocks.find(
            (block) => block.x === bullet.x && block.y === bullet.y
          );

          if (hitBlock) {
            setBlocks((prevBlocks) =>
              prevBlocks.filter(
                (block) => block.x !== hitBlock.x || block.y !== hitBlock.y
              )
            );
            return false;
          }

          if (
            bullet.x === playerPos.x + GRID_SIZE &&
            bullet.y === playerPos.y
          ) {
            setPlayerHP((prev) => Math.max(0, prev - 10));
            return false;
          }

          return bullet.x >= 0 && bullet.x < GRID_SIZE * 2;
        });
      });
      
      setBeams((prev) =>
        prev
          .map((beam) => ({ ...beam, ttl: beam.ttl - 1 }))
          .filter((beam) => beam.ttl > 0)
      );

      setSlash((prev) =>
        prev.map((s) => ({ ...s, ttl: s.ttl - 1 })).filter((s) => s.ttl > 0)
      );

      setDelayBombs((prev) => {
        const updatedBombs = prev.map((bomb) => ({
          ...bomb,
          timer: bomb.timer - 1,
        }));

        const newExplosionEffects: TimedEffect[] = [];

        updatedBombs.forEach((bomb) => {
          if (bomb.timer <= 0) {
            const surroundingTiles: Position[] = [
              { x: bomb.x, y: bomb.y },
              { x: bomb.x - 1, y: bomb.y },
              { x: bomb.x + 1, y: bomb.y },
              { x: bomb.x, y: bomb.y - 1 },
              { x: bomb.x, y: bomb.y + 1 },
              { x: bomb.x - 1, y: bomb.y - 1 },
              { x: bomb.x - 1, y: bomb.y + 1 },
              { x: bomb.x + 1, y: bomb.y - 1 },
              { x: bomb.x + 1, y: bomb.y + 1 },
            ];

            surroundingTiles.forEach((tile) => {
              newExplosionEffects.push({
                ...tile,
                ttl: 5,
                effectType: "explosion",
              });

              if (tile.x === opponentPos.x && tile.y === opponentPos.y) {
                const damage = tile.x === bomb.x && tile.y === bomb.y ? 40 : 10;
                setOpponentHP((prev) => Math.max(0, prev - damage));
              }
            });
          }
        });

        setExplosionEffects((prev) => [...prev, ...newExplosionEffects]);

        return updatedBombs.filter((bomb) => bomb.timer > 0);
      });

      setBoomerang((prev) => {
        if (!prev) return null;

        let newX = prev.x;
        let newY = prev.y;
        let newPhase = prev.phase;
        let newDistanceTraveled = prev.distanceTraveled;

        if (prev.phase === "forward") {
          if (prev.distanceTraveled < 3) {
            newX -= 1;
            newDistanceTraveled += 1;
          } else if (prev.distanceTraveled === 3) {
            newX -= 1;
            newY -= 1;
            newDistanceTraveled += 1;
          } else {
            newPhase = "backward";
          }
        } else if (prev.phase === "backward") {
          newX += 1;
        }

        if (newX === opponentPos.x && newY === opponentPos.y) {
          setOpponentHP((prevHP) => Math.max(0, prevHP - 30));
        }

        if (newX === playerPos.x + GRID_SIZE - 1 && newY === playerPos.y) {
          setHand((prevHand) => {
            const boomerangMove = CHARACTERS[0].moves.find(
              (move) => move.name === "boomerang"
            );
            if (boomerangMove) {
              return [boomerangMove, ...prevHand.slice(1)];
            }
            return prevHand;
          });
          return null;
        }

        if (newX < 0 || newX >= GRID_SIZE * 2) {
          return null;
        }

        return {
          x: newX,
          y: newY,
          phase: newPhase,
          distanceTraveled: newDistanceTraveled,
        };
      });

      if (lasso) {
        if (lasso.x === opponentPos.x && lasso.y === opponentPos.y) {
          setOpponentHP((prev) => Math.max(0, prev - 15));
          setOpponentPos((prev) => ({ ...prev, x: 4 }));
          setOpponentStunned(15);
        }
        setLasso(null);
      }

      if (opponentStunned > 0) {
        setOpponentStunned((prev) => prev - 1);
      }

      beams.forEach((beam) => {
        if (beam.y === opponentPos.y && opponentPos.x < GRID_SIZE) {
          setOpponentHP((prev) => Math.max(0, prev - 20));
        }
      });

      if (punch) {
        if (punch.x === opponentPos.x && punch.y === opponentPos.y) {
          setOpponentHP((prev) => Math.max(0, prev - 40));
        }
        setPunch(null);
      }

      slash.forEach((s) => {
        if (s.x === opponentPos.x && s.y === opponentPos.y) {
          setOpponentHP((prev) => Math.max(0, prev - 30));
        }
      });

      bombs.forEach((bomb) => {
        if (bomb.x === opponentPos.x && bomb.y === opponentPos.y) {
          setOpponentHP((prev) => Math.max(0, prev - 40));
          setBombs((prev) => prev.filter((b) => b !== bomb));
        }
      });

      if (tractorBeam) {
        const isOpponentInBeam =
          opponentPos.y === tractorBeam.y &&
          opponentPos.x < tractorBeam.x &&
          opponentPos.x >= 0;
        if (isOpponentInBeam) {
          setOpponentHP((prev) => Math.max(0, prev - 10));
          const newX = Math.min(opponentPos.x + 2, tractorBeam.x - 1);
          const isBlocked = blocks.some(
            (block) => block.x === newX && block.y === opponentPos.y
          );

          if (!isBlocked) {
            setOpponentPos((prev) => ({
              ...prev,
              x: newX,
            }));
          }
        }
        setTractorBeam(null);
      }

      if (playerHP <= 0 || opponentHP <= 0) {
        setGameOver(true);
      }
    }, GAME_TICK);
    return () => clearInterval(gameLoop);
  }, [
    gameOver,
    moveOpponent,
    playerBullets,
    opponentBullets,
    beams,
    punch,
    slash,
    bombs,
    delayBombs,
    tractorBeam,
    boomerang,
    lasso,
    playerPos,
    opponentPos,
    playerHP,
    opponentHP,
    tickCount,
    hand,
    drawCard,
    opponentStunned,
    blocks,
    chargeTime,
    isCharging,
    selectedCharacter,
    malipoleFrenzyActive,
    malipoleFrenzyTimer,
    malipoleBulletHits,
    tongueWhipActive,
    lilyPadTraps
  ]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;

      if (
        e.key === " " &&
        (selectedCharacter.name === "Rat King" || selectedCharacter.name === "Malipole") &&
        isCharging
      ) {
        return;
      }

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
          if (selectedCharacter.name === "Rat King" || selectedCharacter.name === "Malipole") {
            setIsCharging(true);
          } else {
            fireBullet(true);
          }
          break;
        case "1":
          if (hand[0]) useMove(hand[0].name);
          break;
        case "2":
          if (hand[1]) useMove(hand[1].name);
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (
        e.key === " " &&
        (selectedCharacter.name === "Rat King" || selectedCharacter.name === "Malipole") &&
        isCharging
      ) {
        fireBullet(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
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

  // Character selection screen
  if (!gameStarted) {
    return (
      <div style={{ 
        background: '#5465FF', 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        fontFamily: 'Inter, sans-serif',
        userSelect: 'none'
      }}>
        <h1 style={{ 
          fontSize: '4rem', 
          fontWeight: '700', 
          marginBottom: '3rem', 
          color: '#E8E8E8',
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }}>
          Choose Your Fighter
        </h1>
        <div style={{ display: 'flex', gap: '2rem' }}>
          {CHARACTERS.map((character) => (
            <button
              key={character.name}
              onClick={() => startGame(character)}
              style={{
                padding: '2rem',
                background: '#E8E8E8',
                borderRadius: '16px',
                border: '2px solid #1A1A1A',
                boxShadow: '-8px 8px 0 #FF6B35',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'Inter, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
                e.currentTarget.style.boxShadow = '-12px 12px 0 #FF6B35';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '-8px 8px 0 #FF6B35';
              }}
            >
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{character.emoji}</div>
              <div style={{ 
                fontWeight: '700', 
                color: '#1A1A1A', 
                fontSize: '1.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {character.name}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Main game view with card-inspired UI
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#5465FF',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      {/* Game Viewport Container */}
      <div style={{
        width: '90vw',
        maxWidth: '1400px',
        height: '85vh',
        background: '#E8E8E8',
        borderRadius: '32px',
        boxShadow: '0 40px 80px rgba(0,0,0,0.2)',
        display: 'grid',
        gridTemplateRows: '1fr 40px 280px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        
        {/* TOP SECTION: 3D Game Field */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          {/* 3D Canvas */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <Canvas
              shadows
              camera={{ position: [8, 12, 12], fov: 50 }}
              gl={{ antialias: true }}
            >
              <GameScene3D
                playerPos={playerPos}
                opponentPos={opponentPos}
                playerBullets={playerBullets}
                opponentBullets={opponentBullets}
                blocks={blocks}
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
              />
              <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={8}
                maxDistance={20}
                maxPolarAngle={Math.PI / 2.5}
              />
            </Canvas>
          </div>

          {/* HUD Overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            padding: '24px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            zIndex: 10,
            pointerEvents: 'none'
          }}>
            <div style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#1A1A1A',
              lineHeight: '1.5'
            }}>
              {selectedCharacter.name} {selectedCharacter.emoji}<br />
              ( ARROW KEYS + SPACE )
            </div>
            <div style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#1A1A1A',
              textAlign: 'right',
              lineHeight: '1.5'
            }}>
              {gameOver ? "BATTLE ENDED" : "BATTLE ACTIVE"}<br />
              Controls: 1 / 2
            </div>
          </div>
        </div>

        {/* MARQUEE STRIP */}
        <div style={{
          background: 'white',
          borderTop: '1px solid #1A1A1A',
          borderBottom: '1px solid #1A1A1A',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}>
          <div style={{
            display: 'inline-block',
            animation: 'scroll 20s linear infinite',
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            fontWeight: '700',
            color: '#5465FF',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <span style={{ marginRight: '40px' }}>Player HP: {playerHP}</span> ✽ 
            <span style={{ marginRight: '40px' }}> Opponent HP: {opponentHP}</span> ✽ 
            <span style={{ marginRight: '40px' }}> Mana: {playerMana}/{MAX_MANA}</span> ✽ 
            {selectedCharacter.name === "Malipole" && malipoleFrenzyActive && (
              <>
                <span style={{ marginRight: '40px' }}> FRENZY MODE ACTIVE</span> ✽ 
              </>
            )}
            <span style={{ marginRight: '40px' }}> Player HP: {playerHP}</span> ✽ 
            <span style={{ marginRight: '40px' }}> Opponent HP: {opponentHP}</span> ✽ 
            <span style={{ marginRight: '40px' }}> Mana: {playerMana}/{MAX_MANA}</span> ✽ 
          </div>
        </div>

        {/* BOTTOM SECTION: Player Dashboard with Cards */}
        <div style={{
          background: '#FF6B35',
          display: 'flex',
          flexDirection: 'column',
          padding: '0 40px',
          position: 'relative'
        }}>
          {/* Dashboard Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '20px',
            marginBottom: '10px'
          }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                color: '#1A1A1A',
                fontWeight: '700'
              }}>
                <span style={{ opacity: 0.6 }}>(</span> HP <span style={{ opacity: 0.6 }}>)</span> {playerHP}
              </div>
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                color: '#1A1A1A',
                fontWeight: '700'
              }}>
                <span style={{ opacity: 0.6 }}>(</span> MANA <span style={{ opacity: 0.6 }}>)</span> {playerMana}/{MAX_MANA}
              </div>
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                color: '#1A1A1A',
                fontWeight: '700'
              }}>
                <span style={{ opacity: 0.6 }}>(</span> ENEMY <span style={{ opacity: 0.6 }}>)</span> {opponentHP}
              </div>
            </div>
            {selectedCharacter.name === "Malipole" && (
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                color: malipoleFrenzyActive ? '#00ff00' : '#1A1A1A',
                fontWeight: '700',
                background: '#1A1A1A',
                padding: '4px 12px',
                borderRadius: '12px'
              }}>
                {malipoleFrenzyActive ? "FRENZY!" : `${malipoleBulletHits}/3`}
              </div>
            )}
          </div>

          {/* Hand Container - Cards */}
          <div style={{
            flexGrow: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: '16px',
            paddingBottom: '40px'
          }}>
            {hand.map((move, index) => (
              <div
                key={index}
                onClick={() => useMove(move.name)}
                style={{
                  width: '160px',
                  height: '200px',
                  background: 'white',
                  borderRadius: '16px',
                  border: '2px solid #1A1A1A',
                  boxShadow: '-4px 4px 0 rgba(0,0,0,0.1)',
                  cursor: playerMana >= move.manaCost ? 'pointer' : 'not-allowed',
                  opacity: playerMana >= move.manaCost ? 1 : 0.5,
                  transition: 'all 0.2s',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  pointerEvents: 'auto'
                }}
                onMouseEnter={(e) => {
                  if (playerMana >= move.manaCost) {
                    e.currentTarget.style.transform = 'translateY(-40px) scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)';
                    e.currentTarget.style.zIndex = '10';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '-4px 4px 0 rgba(0,0,0,0.1)';
                  e.currentTarget.style.zIndex = '1';
                }}
              >
                <div style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  color: '#888',
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span>ABILITY</span>
                  <span>KEY {index + 1}</span>
                </div>
                <div style={{
                  flexGrow: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {/* Abstract shape icon */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    border: '2px solid #1A1A1A',
                    borderRadius: '50%',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '140%',
                      height: '2px',
                      background: '#1A1A1A',
                      transform: 'translate(-50%, -50%) rotate(45deg)'
                    }}></div>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '2px',
                      height: '140%',
                      background: '#1A1A1A',
                      transform: 'translate(-50%, -50%) rotate(45deg)'
                    }}></div>
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '18px',
                    lineHeight: '1',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    color: '#1A1A1A',
                    fontWeight: '700'
                  }}>
                    {move.name}
                  </div>
                  <div style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px',
                    background: '#1A1A1A',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    display: 'inline-block'
                  }}>
                    {move.manaCost} MANA
                  </div>
                </div>
              </div>
            ))}
            
            {/* Empty card slots */}
            {Array.from({ length: MAX_HAND_SIZE - hand.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  width: '160px',
                  height: '200px',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '16px',
                  border: '2px dashed rgba(26,26,26,0.3)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'rgba(26,26,26,0.5)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                EMPTY
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game Over Overlay */}
      {gameOver && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: '#1f2937',
            padding: '48px',
            borderRadius: '24px',
            textAlign: 'center',
            color: 'white',
            fontFamily: 'Inter, sans-serif'
          }}>
            <div style={{
              fontSize: '48px',
              fontWeight: '700',
              marginBottom: '24px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              {playerHP <= 0 ? "DEFEATED" : "VICTORY"}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#10b981',
                color: 'white',
                padding: '16px 32px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes scroll {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
};

export default IsometricGame3D;

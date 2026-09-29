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

// 3D Tile Component
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
    <Box
      position={position}
      args={[0.9, 0.1, 0.9]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        emissive={highlight ? color : "#000000"}
        emissiveIntensity={highlight ? 0.5 : 0}
      />
    </Box>
  );
};

// 3D Character Component
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
      {/* Character body */}
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
      {/* Emoji label */}
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {stunned ? "😵" : emoji}
      </Text>
      {/* Charging indicator */}
      {isCharging && (
        <Sphere args={[0.4, 16, 16]} position={[0, 0, 0]}>
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

// 3D Projectile Component - FIXED DIRECTION
const Projectile3D: React.FC<{
  x: number;
  y: number;
  type: "normal" | "rat" | "charged" | "opponent";
  direction: "left" | "right";
}> = ({ x, y, type, direction }) => {
  const position: [number, number, number] = [x, 0.4, y];

  const getColor = () => {
    switch (type) {
      case "rat":
        return "#ff9900";
      case "charged":
        return "#00ff00";
      case "opponent":
        return "#4444ff";
      default:
        return "#ffff00";
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

// 3D Effect Component
const Effect3D: React.FC<{
  x: number;
  y: number;
  type: string;
  ttl: number;
}> = ({ x, y, type, ttl }) => {
  const position: [number, number, number] = [x, 0.5, y];
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
      default:
        return "#ffffff";
    }
  };

  return (
    <Sphere position={position} args={[0.3 * scale, 16, 16]} castShadow>
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

// 3D Block Component
const Block3D: React.FC<{ x: number; y: number; health: number }> = ({ x, y, health }) => {
  const position: [number, number, number] = [x, 0.4, y];
  const color = health > 1 ? "#ff8800" : "#ff4400";

  return (
    <Box position={position} args={[0.8, 0.8, 0.8]} castShadow>
      <meshStandardMaterial color={color} />
    </Box>
  );
};

// 3D Beam Component
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

// Main 3D Game Scene
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
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[GRID_SIZE, 5, GRID_SIZE]} intensity={0.5} />

      {/* Grid tiles */}
      {Array.from({ length: GRID_SIZE * 2 }, (_, x) =>
        Array.from({ length: GRID_SIZE }, (_, y) => {
          const isPlayerGrid = x >= GRID_SIZE;
          const localX = isPlayerGrid ? x - GRID_SIZE : x;

          let color = isPlayerGrid ? "#ff4444" : "#4444ff";
          let highlight = false;

          if (isPlayerGrid && localX === playerPos.x && y === playerPos.y) {
            highlight = true;
          }
          if (!isPlayerGrid && localX === opponentPos.x && y === opponentPos.y) {
            highlight = true;
          }

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

      {/* Characters */}
      <Character3D
        x={playerPos.x}
        y={playerPos.y}
        emoji={selectedCharacter.emoji}
        isCharging={isCharging}
        frenzy={malipoleFrenzyActive}
      />
      <Character3D
        x={opponentPos.x}
        y={opponentPos.y}
        emoji="👾"
        isOpponent
        stunned={opponentStunned > 0}
      />

      {/* Player projectiles */}
      {playerBullets.map((bullet, i) => (
        <Projectile3D
          key={`player-bullet-${i}`}
          x={bullet.x}
          y={bullet.y}
          type={bullet.isRat ? "rat" : bullet.chargePower ? "charged" : "normal"}
          direction="left"
        />
      ))}

      {/* Opponent projectiles */}
      {opponentBullets.map((bullet, i) => (
        <Projectile3D
          key={`opponent-bullet-${i}`}
          x={bullet.x}
          y={bullet.y}
          type="opponent"
          direction="right"
        />
      ))}

      {/* Blocks */}
      {blocks.map((block, i) => (
        <Block3D key={`block-${i}`} x={block.x} y={block.y} health={block.health} />
      ))}

      {/* Beams */}
      {beams.map((beam, i) => (
        <Beam3D
          key={`beam-${i}`}
          y={beam.y}
          direction={beam.direction}
          isPlayerGrid={true}
        />
      ))}

      {/* Tractor beam */}
      {tractorBeam && (
        <Beam3D
          y={tractorBeam.y}
          direction={tractorBeam.direction}
          isPlayerGrid={true}
        />
      )}

      {/* Effects */}
      {explosionEffects.map((effect, i) => (
        <Effect3D
          key={`effect-${i}`}
          x={effect.x}
          y={effect.y}
          type={effect.effectType || "explosion"}
          ttl={effect.ttl}
        />
      ))}

      {/* Lily pad traps */}
      {lilyPadTraps.map((trap, i) => (
        <Effect3D
          key={`lilypad-${i}`}
          x={trap.x}
          y={trap.y}
          type="lilypad"
          ttl={trap.ttl}
        />
      ))}

      {/* Tongue whip */}
      {tongueWhipActive && (
        <Effect3D
          x={tongueWhipActive.x}
          y={tongueWhipActive.y}
          type="tonguewhip"
          ttl={tongueWhipActive.ttl}
        />
      )}

      {/* Slash effect */}
      {slash.map((s, i) => (
        <Effect3D key={`slash-${i}`} x={s.x} y={s.y} type="flyingsword" ttl={s.ttl} />
      ))}

      {/* Punch */}
      {punch && <Effect3D x={punch.x} y={punch.y} type="explosion" ttl={punch.ttl} />}

      {/* Lasso */}
      {lasso && <Effect3D x={lasso.x} y={lasso.y} type="tonguewhip" ttl={lasso.ttl} />}

      {/* Bombs */}
      {bombs.map((bomb, i) => (
        <Sphere key={`bomb-${i}`} position={[bomb.x, 0.3, bomb.y]} args={[0.25, 16, 16]} castShadow>
          <meshStandardMaterial color="#333333" />
        </Sphere>
      ))}

      {/* Delay bombs */}
      {delayBombs.map((bomb, i) => (
        <group key={`delay-bomb-${i}`} position={[bomb.x, 0.3, bomb.y]}>
          <Sphere args={[0.25, 16, 16]} castShadow>
            <meshStandardMaterial
              color="#ff00ff"
              emissive="#ff00ff"
              emissiveIntensity={0.5}
            />
          </Sphere>
          <Text position={[0, 0.5, 0]} fontSize={0.2} color="white">
            {Math.ceil(bomb.timer / 10)}
          </Text>
        </group>
      ))}

      {/* Boomerang */}
      {boomerang && (
        <Sphere position={[boomerang.x, 0.4, boomerang.y]} args={[0.2, 16, 16]} castShadow>
          <meshStandardMaterial
            color="#ffff00"
            emissive="#ffff00"
            emissiveIntensity={0.7}
          />
        </Sphere>
      )}

      {/* Ground plane */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[GRID_SIZE, -0.1, GRID_SIZE / 2]}
      >
        <planeGeometry args={[GRID_SIZE * 3, GRID_SIZE * 2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </>
  );
};

// Main Game Component
const IsometricGame3D = () => {
  // All state management
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

  // Game loop
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
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <h1 className="text-6xl font-bold mb-12 text-white">
          Choose Your Character
        </h1>
        <div className="flex gap-6">
          {CHARACTERS.map((character) => (
            <button
              key={character.name}
              onClick={() => startGame(character)}
              className="p-8 bg-gray-800 rounded-2xl shadow-2xl hover:shadow-purple-500/50 hover:bg-gray-700 transition-all transform hover:scale-110 border-2 border-purple-500"
            >
              <div className="text-6xl mb-4">{character.emoji}</div>
              <div className="font-bold text-white text-xl">{character.name}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Main game view with ACTUAL full-screen 3D canvas
  return (
    <>
      {/* Full-screen 3D Canvas - NO PADDING, NO CONSTRAINTS */}
      <Canvas
        shadows
        camera={{
          position: [8, 12, 12],
          fov: 50,
        }}
        gl={{ antialias: true }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0
        }}
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

      {/* UI Overlays - positioned absolutely on top */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 10, background: 'rgba(0,0,0,0.7)', padding: 16, borderRadius: 8, color: 'white' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Player HP: {playerHP}</div>
        <div>
          {selectedCharacter.name === "Rat King" ? (
            <span>Charge: {Math.min(5, Math.floor(chargeTime / 10))}/5 {isCharging && "[CHARGING]"}</span>
          ) : selectedCharacter.name === "Malipole" ? (
            <span>Charge: {Math.min(3, Math.floor(chargeTime / 10))}/3 {isCharging && "[CHARGING]"}</span>
          ) : (
            <span>Ammo: {selectedCharacter.name === "Hogglin" ? MAX_SHOTS - blocks.length : MAX_SHOTS - playerBullets.length}</span>
          )}
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 'bold' }}>Opponent HP: {opponentHP}</div>
          <div>Bullets: {MAX_SHOTS - opponentBullets.length}</div>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(0,0,0,0.7)', padding: 16, borderRadius: 8, color: 'white', minWidth: 500 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Mana: {playerMana}/{MAX_MANA}</div>
        <div style={{ width: '100%', height: 8, background: '#333', borderRadius: 4, marginBottom: 16 }}>
          <div style={{ width: `${(playerMana / MAX_MANA) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: 4, transition: 'width 0.3s' }}></div>
        </div>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Hand:</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hand.map((move, index) => (
            <button
              key={index}
              onClick={() => useMove(move.name)}
              disabled={playerMana < move.manaCost}
              style={{
                padding: '8px 16px',
                borderRadius: 4,
                border: 'none',
                cursor: playerMana >= move.manaCost ? 'pointer' : 'not-allowed',
                background: playerMana >= move.manaCost ? '#3b82f6' : '#666',
                color: 'white'
              }}
            >
              {move.name} ({move.manaCost})
            </button>
          ))}
        </div>
        {selectedCharacter.name === "Malipole" && (
          <div style={{ fontSize: 12, color: '#4ade80', marginTop: 8 }}>
            {malipoleBulletHits}/3 hits until Frenzy
            {malipoleFrenzyActive && " - FRENZY MODE!"}
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 10, background: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 8, color: 'white', fontSize: 14 }}>
        <div>Arrow Keys: Move</div>
        <div>Space: Fire/Charge</div>
        <div>1, 2: Abilities</div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>Drag: Rotate • Scroll: Zoom</div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Playing as: {selectedCharacter.name} {selectedCharacter.emoji}</div>
      </div>

      {gameOver && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ background: '#1f2937', padding: 32, borderRadius: 16, textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 16 }}>
              {playerHP <= 0 ? "Game Over!" : "Victory!"}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#10b981', color: 'white', padding: '12px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default IsometricGame3D;

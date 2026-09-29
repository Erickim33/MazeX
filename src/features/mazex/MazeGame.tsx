import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Info, Lightbulb, Map, Pause, Play, RotateCcw, Settings, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { canMove, cellsFrom, findPath, generateMaze, type Maze } from "./game";
import { HelpPage, SettingsPage, MultiplayerPage } from "./Pages";
import { DEFAULT_SETTINGS, clearRun, loadRun, loadSettings, saveRun, saveSettings, type GameSettings, type SavedRun } from "./storage";
import { initializeAds, showInterstitial, showRewardedForLives } from "./ads";

type Screen = "home" | "help" | "settings" | "multiplayer" | "playing" | "paused" | "caught" | "escaped" | "gameover";
type Point = { x: number; y: number };
const PLAYER_SPEED = 2.7;
const HUNTER_SPEED_MULTIPLIER = 0.9;
const HUNTER_DELAY_SECONDS = 5;
const HUNTER_MIN_DISTANCE = 8;
const DASH_SECONDS = 0.85;
const DASH_COOLDOWN = 4;
const HINTS_PER_MAZE = 3;
const HINT_SECONDS = 4;
const HINT_COST = 100;
const RESUME_GRACE_MS = 3000;

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function MazeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const mazeRef = useRef<Maze>(generateMaze(1));
  const playerRef = useRef<Point>({ x: mazeRef.current.start.col + 0.5, y: mazeRef.current.start.row + 0.5 });
  const hunterRef = useRef<Point | null>(null);
  const secretDoorsRef = useRef<{ entry: Point; exits: Point[] }>({ entry: { x: 0, y: 0 }, exits: [] });
  const keysRef = useRef(new Set<string>());
  const joystickRef = useRef<Point>({ x: 0, y: 0 });
  const joystickKnobRef = useRef<HTMLSpanElement | null>(null);
  const dashUntilRef = useRef(0);
  const dashReadyAtRef = useRef(0);
  const pathRef = useRef<ReturnType<typeof findPath>>([]);
  const lastPathAtRef = useRef(0);
  const lastFrameRef = useRef(0);
  const startAtRef = useRef(0);
  const screenRef = useRef<Screen>("home");
  const levelRef = useRef(1);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const hintUntilRef = useRef(0);
  const hintsUsedRef = useRef(0);
  const pausedAtRef = useRef(0);
  const graceUntilRef = useRef(0);
  const backToRef = useRef<Screen>("home");
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS);
  const [screen, setScreenState] = useState<Screen>("home");
  const [level, setLevelState] = useState(1);
  const [lives, setLivesState] = useState(3);
  const [score, setScoreState] = useState(0);
  const [time, setTime] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [dashCooldown, setDashCooldown] = useState(0);
  const [settings, setSettingsState] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [savedRun, setSavedRun] = useState<SavedRun | null>(null);
  const [hintsLeft, setHintsLeft] = useState(HINTS_PER_MAZE);
  const [confirmNew, setConfirmNew] = useState(false);
  const [rewardLoading, setRewardLoading] = useState(false);
  const levelsCompletedRef = useRef(0);
  const [showMap, setShowMap] = useState(false);
  const [danger, setDanger] = useState(0);
  const [hunterAlert, setHunterAlert] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const beatRef = useRef(0);

  const setScreen = useCallback((next: Screen) => {
    screenRef.current = next;
    setScreenState(next);
  }, []);

  const syncLevel = (next: number) => { levelRef.current = next; setLevelState(next); };
  const syncLives = (next: number) => { livesRef.current = next; setLivesState(next); };
  const syncScore = (next: number) => { scoreRef.current = next; setScoreState(next); };
  const persist = (nextLevel: number, nextLives: number, nextScore: number) => {
    const run = { level: nextLevel, lives: nextLives, score: nextScore };
    saveRun(run);
    setSavedRun(run);
  };
  const dropRun = () => { clearRun(); setSavedRun(null); };
  const buzz = (ms: number) => { if (settingsRef.current.vibration) navigator.vibrate?.(ms); };
  const releaseHunter = () => {
    const maze = mazeRef.current;
    const player = playerRef.current;
    const from = {
      row: Math.max(0, Math.min(maze.rows - 1, Math.floor(player.y))),
      col: Math.max(0, Math.min(maze.cols - 1, Math.floor(player.x))),
    };

    const reachable = cellsFrom(maze, from).filter(
      (cell) =>
        Math.hypot(
          cell.col + 0.5 - player.x,
          cell.row + 0.5 - player.y,
        ) >= HUNTER_MIN_DISTANCE,
    );

    const candidates = reachable.length
      ? reachable
      : cellsFrom(maze, from).sort((a, b) => b.distance - a.distance);

    const pick =
      candidates[Math.floor(Math.random() * candidates.length)] ??
      maze.hunter;

    hunterRef.current = {
      x: pick.col + 0.5,
      y: pick.row + 0.5,
    };
    pathRef.current = [];
    lastPathAtRef.current = 0;
    buzz(120);
    setHunterAlert(true);
    window.setTimeout(() => setHunterAlert(false), 1800);
  };
  const updateSettings = (next: GameSettings) => { settingsRef.current = next; setSettingsState(next); saveSettings(next); };
  const openPage = (page: Screen) => { backToRef.current = screenRef.current === "paused" ? "paused" : "home"; setScreen(page); };

  const resetPositions = useCallback(() => {
    const maze = mazeRef.current;
    const start = maze.start;
    const reachable = cellsFrom(maze, start);

    const spawnCandidates = reachable.filter((cell) =>
      Math.abs(cell.row - maze.exit.row) +
        Math.abs(cell.col - maze.exit.col) > 4
    );

    const spawn =
      spawnCandidates[Math.floor(Math.random() * spawnCandidates.length)] ??
      start;

    playerRef.current = {
      x: spawn.col + 0.5,
      y: spawn.row + 0.5,
    };

    hunterRef.current = null;
    setHunterAlert(false);
    pathRef.current = [];
    dashReadyAtRef.current = 0;
    dashUntilRef.current = 0;
    hintUntilRef.current = 0;

    const doorCandidates = reachable.filter((cell) =>
      Math.abs(cell.row - maze.exit.row) +
        Math.abs(cell.col - maze.exit.col) <= 8 &&
      Math.abs(cell.row - spawn.row) +
        Math.abs(cell.col - spawn.col) >= 5
    );

    const door =
      reachable[Math.floor(Math.random() * reachable.length)] ?? start;

    const exits = doorCandidates
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map((cell) => ({
        x: cell.col + 0.5,
        y: cell.row + 0.5,
      }));

    secretDoorsRef.current = {
      entry: {
        x: door.col + 0.5,
        y: door.row + 0.5,
      },
      exits,
    };
  }, []);

  const beginRound = useCallback((nextLevel: number, freshRun: boolean) => {
    if (freshRun) {
      syncLives(3);
      syncScore(0);
      syncLevel(1);
      nextLevel = 1;
    } else syncLevel(nextLevel);
    mazeRef.current = generateMaze(nextLevel);
    resetPositions();
    startAtRef.current = performance.now() + 3000;
    setCountdown(3);
    setTime(0);
    setDanger(0);
    hintsUsedRef.current = 0;
    graceUntilRef.current = 0;
    setHintsLeft(HINTS_PER_MAZE);
    setShowMap(settingsRef.current.miniMap);
    persist(nextLevel, livesRef.current, scoreRef.current);
    setScreen("playing");
  }, [resetPositions, setScreen]);

  const continueRun = () => {
    if (!savedRun) return;
    syncLives(savedRun.lives);
    syncScore(savedRun.score);
    beginRound(savedRun.level, false);
  };

  const dash = useCallback(() => {
    const now = performance.now() / 1000;
    if (screenRef.current === "playing" && now >= dashReadyAtRef.current && countdown === 0) {
      dashUntilRef.current = now + DASH_SECONDS;
      dashReadyAtRef.current = now + DASH_COOLDOWN;
    }
  }, [countdown]);

  const hint = useCallback(() => {
    const now = performance.now() / 1000;
    if (screenRef.current !== "playing" || countdown > 0 || !settingsRef.current.hints) return;
    if (hintsUsedRef.current >= HINTS_PER_MAZE || now < hintUntilRef.current) return;
    hintsUsedRef.current += 1;
    setHintsLeft(HINTS_PER_MAZE - hintsUsedRef.current);
    hintUntilRef.current = now + HINT_SECONDS;
  }, [countdown]);

  const pauseGame = useCallback(() => {
    if (screenRef.current !== "playing") return;
    pausedAtRef.current = performance.now();
    setScreen("paused");
  }, [setScreen]);

  const resumeGame = useCallback(() => {
    if (screenRef.current !== "paused") return;
    const now = performance.now();
    const gap = now - pausedAtRef.current;
    const wasCounting = pausedAtRef.current < startAtRef.current;
    startAtRef.current += gap + (wasCounting ? 0 : RESUME_GRACE_MS);
    graceUntilRef.current = wasCounting ? 0 : now + RESUME_GRACE_MS;
    dashReadyAtRef.current += gap / 1000;
    dashUntilRef.current += gap / 1000;
    hintUntilRef.current += gap / 1000;
    setScreen("playing");
  }, [setScreen]);

  const watchAdForLives = useCallback(async () => {
    if (rewardLoading) return;
    setRewardLoading(true);
    try {
      const rewarded = await showRewardedForLives();
      if (!rewarded) return;
      const nextLives = livesRef.current + 2;
      syncLives(nextLives);
      persist(levelRef.current, nextLives, scoreRef.current);
      setScreen("playing");
    } finally {
      setRewardLoading(false);
    }
  }, [rewardLoading, setScreen]);

  useEffect(() => {
    initializeAds().catch((error) => {
      console.warn("MazeX AdMob initialization failed:", error);
    });
  }, []);

  useEffect(() => {
    const stored = loadSettings();
    settingsRef.current = stored;
    setSettingsState(stored);
    setSavedRun(loadRun());
  }, []);

  useEffect(() => {
    const onHide = () => { if (document.hidden) pauseGame(); };
    window.addEventListener("blur", pauseGame);
    document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("blur", pauseGame); document.removeEventListener("visibilitychange", onHide); };
  }, [pauseGame]);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      keysRef.current.add(event.key.toLowerCase());
      if (event.code === "Space") { event.preventDefault(); dash(); }
      const k = event.key.toLowerCase();
      if (k === "p" || k === "escape") {
        if (screenRef.current === "playing") pauseGame();
        else if (screenRef.current === "paused") resumeGame();
      }
      if (k === "h") hint();
    };
    const onUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [dash, hint, pauseGame, resumeGame]);

  useEffect(() => {
    let frame = 0;
    const render = (now: number) => {
      const canvas = canvasRef.current;
      const shell = shellRef.current;
      if (!canvas || !shell) { frame = requestAnimationFrame(render); return; }
      const rect = shell.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) { frame = requestAnimationFrame(render); return; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dt = Math.min((now - (lastFrameRef.current || now)) / 1000, 0.035);
      lastFrameRef.current = now;
      const maze = mazeRef.current;
      const running = screenRef.current === "playing" && now >= startAtRef.current && now >= graceUntilRef.current;
      const secondsNow = now / 1000;

      if (screenRef.current === "playing") {
        const remaining = Math.max(0, Math.ceil((Math.max(startAtRef.current, graceUntilRef.current) - now) / 1000));
        setCountdown((old) => old === remaining ? old : remaining);
        setDashCooldown(Math.max(0, dashReadyAtRef.current - secondsNow));
      }

      if (running) {
        const keys = keysRef.current;
        let dx = joystickRef.current.x + (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
        let dy = joystickRef.current.y + (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
        const magnitude = Math.hypot(dx, dy);
        if (magnitude > 0) { dx /= Math.max(1, magnitude); dy /= Math.max(1, magnitude); }
        const playerSpeed = PLAYER_SPEED * (secondsNow < dashUntilRef.current ? 1.9 : 1);
        const player = playerRef.current;
        const nextX = player.x + dx * playerSpeed * dt;
        if (canMove(maze, player.x, player.y, nextX, player.y)) player.x = nextX;
        const nextY = player.y + dy * playerSpeed * dt;
        if (canMove(maze, player.x, player.y, player.x, nextY)) player.y = nextY;

        const secretDoor = secretDoorsRef.current.entry;
        const doorDistance = Math.hypot(
          player.x - secretDoor.x,
          player.y - secretDoor.y,
        );

        if (doorDistance < 0.48 && secretDoorsRef.current.exits.length) {
          const hunter = hunterRef.current;

          const destination = [...secretDoorsRef.current.exits].sort((a, b) => {
            const hunterA = hunter
              ? Math.hypot(a.x - hunter.x, a.y - hunter.y)
              : 999;
            const hunterB = hunter
              ? Math.hypot(b.x - hunter.x, b.y - hunter.y)
              : 999;

            return hunterB - hunterA;
          })[0];

          if (destination) {
            player.x = destination.x;
            player.y = destination.y;
            pathRef.current = [];
            lastPathAtRef.current = 0;
            buzz(120);
          }
        }

        if (!hunterRef.current && (now - startAtRef.current) / 1000 >= HUNTER_DELAY_SECONDS) releaseHunter();
        if (hunterRef.current && now - lastPathAtRef.current > Math.max(180, 500 - levelRef.current * 18)) {
          pathRef.current = findPath(maze,
            { row: Math.max(0, Math.min(maze.rows - 1, Math.floor(hunterRef.current.y))), col: Math.max(0, Math.min(maze.cols - 1, Math.floor(hunterRef.current.x))) },
            { row: Math.max(0, Math.min(maze.rows - 1, Math.floor(player.y))), col: Math.max(0, Math.min(maze.cols - 1, Math.floor(player.x))) },
          );
          lastPathAtRef.current = now;
        }
        const targetCell = pathRef.current[1] ?? pathRef.current[0];
        if (hunterRef.current && targetCell) {
          const hunter = hunterRef.current;
          const tx = targetCell.col + 0.5, ty = targetCell.row + 0.5;
          const angle = Math.atan2(ty - hunter.y, tx - hunter.x);
          const hunterSpeed = Math.min(2.52, 1.38 + levelRef.current * 0.055) * HUNTER_SPEED_MULTIPLIER;
          const hunterNextX = hunter.x + Math.cos(angle) * hunterSpeed * dt;
          if (canMove(maze, hunter.x, hunter.y, hunterNextX, hunter.y, 0.19)) hunter.x = hunterNextX;
          const hunterNextY = hunter.y + Math.sin(angle) * hunterSpeed * dt;
          if (canMove(maze, hunter.x, hunter.y, hunter.x, hunterNextY, 0.19)) hunter.y = hunterNextY;
        }

        const hunterDistance = hunterRef.current ? Math.hypot(player.x - hunterRef.current.x, player.y - hunterRef.current.y) : Infinity;
        const nextDanger = Math.max(0, Math.min(1, 1 - hunterDistance / 5));
        setDanger((old) => Math.abs(old - nextDanger) > 0.03 ? nextDanger : old);
        if (settingsRef.current.sound && nextDanger > 0.48 && now - beatRef.current > 900 - nextDanger * 520) {
          beatRef.current = now;
          try {
            const audio = audioRef.current ?? new AudioContext();
            audioRef.current = audio;
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = 62;
            gain.gain.setValueAtTime(0.0001, audio.currentTime);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.08 * settingsRef.current.volume), audio.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.15);
            oscillator.connect(gain).connect(audio.destination);
            oscillator.start(); oscillator.stop(audio.currentTime + 0.16);
          } catch { /* sound is optional */ }
        }
        if (hunterDistance < 0.46) {
          const nextLives = livesRef.current - 1;
          syncLives(nextLives);
          if (nextLives <= 0) dropRun(); else persist(levelRef.current, nextLives, scoreRef.current);
          buzz(200);
          setScreen(nextLives <= 0 ? "gameover" : "caught");
        } else if (Math.hypot(player.x - (maze.exit.col + 0.5), player.y - (maze.exit.row + 0.5)) < 0.42) {
          const elapsed = Math.max(1, (now - startAtRef.current) / 1000);
          const bonus = Math.max(250, Math.round(1100 - elapsed * 12)) + levelRef.current * 100;
          syncScore(scoreRef.current + Math.max(100, bonus - hintsUsedRef.current * HINT_COST));
          persist(levelRef.current + 1, livesRef.current, scoreRef.current);
          levelsCompletedRef.current += 1;
          buzz(80);
          setScreen("escaped");
        }
        setTime((now - startAtRef.current) / 1000);
      }

      ctx.clearRect(0, 0, width, height);
      const visibleCells = width < 640 ? 7.2 : 9.5;
      const cell = Math.min(width / visibleCells, height / (visibleCells + 0.5));
      const cameraX = playerRef.current.x * cell - width / 2;
      const cameraY = playerRef.current.y * cell - height / 2;
      ctx.save();
      ctx.translate(-cameraX, -cameraY);
      ctx.fillStyle = "#080b12";
      ctx.fillRect(0, 0, maze.cols * cell, maze.rows * cell);
      ctx.strokeStyle = "#263648";
      ctx.lineWidth = Math.max(3, cell * 0.08);
      ctx.lineCap = "round";
      ctx.shadowColor = "#20344c";
      ctx.shadowBlur = 7;
      ctx.beginPath();
      for (let r = 0; r <= maze.rows; r += 1) for (let c = 0; c < maze.cols; c += 1) if (maze.horizontal[r]?.[c]) { ctx.moveTo(c * cell, r * cell); ctx.lineTo((c + 1) * cell, r * cell); }
      for (let r = 0; r < maze.rows; r += 1) for (let c = 0; c <= maze.cols; c += 1) if (maze.vertical[r]?.[c]) { ctx.moveTo(c * cell, r * cell); ctx.lineTo(c * cell, (r + 1) * cell); }
      ctx.stroke();

      const exitX = (maze.exit.col + 0.5) * cell, exitY = (maze.exit.row + 0.5) * cell;
      const pulse = 0.8 + Math.sin(now / 180) * 0.15;
      ctx.shadowColor = "#39ff88"; ctx.shadowBlur = 24;
      ctx.strokeStyle = "#39ff88"; ctx.lineWidth = 3;
      ctx.strokeRect(exitX - cell * 0.24 * pulse, exitY - cell * 0.24 * pulse, cell * 0.48 * pulse, cell * 0.48 * pulse);
      ctx.fillStyle = "rgba(57,255,136,.18)"; ctx.fillRect(exitX - cell * 0.18, exitY - cell * 0.18, cell * 0.36, cell * 0.36);

      const secretDoor = secretDoorsRef.current.entry;
      const doorDistance = Math.hypot(
        playerRef.current.x - secretDoor.x,
        playerRef.current.y - secretDoor.y,
      );

      if (doorDistance < 1.7) {
        ctx.save();
        ctx.globalAlpha = Math.max(0.2, 1 - doorDistance / 2);
        ctx.shadowColor = "#39ff88";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = "#39ff88";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(secretDoor.x * cell, secretDoor.y * cell, cell * 0.24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const hunter = hunterRef.current;
      if (hunter) {
        ctx.shadowColor = "#ff1744"; ctx.shadowBlur = 18 + danger * 48;
        ctx.fillStyle = "#ff1744"; ctx.beginPath(); ctx.arc(hunter.x * cell, hunter.y * cell, cell * 0.21, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hunter.x * cell, hunter.y * cell, cell * 0.1, 0, Math.PI * 2); ctx.stroke();
      }

      const player = playerRef.current;
      ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = secondsNow < dashUntilRef.current ? 38 : 20;
      ctx.fillStyle = "#00e5ff"; ctx.beginPath(); ctx.arc(player.x * cell, player.y * cell, cell * 0.19, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e8fdff"; ctx.beginPath(); ctx.arc(player.x * cell, player.y * cell, cell * 0.07, 0, Math.PI * 2); ctx.fill();

      const gradient = ctx.createRadialGradient(player.x * cell, player.y * cell, cell * 1.4, player.x * cell, player.y * cell, cell * (3.9 + levelRef.current * 0.05));
      gradient.addColorStop(0, "rgba(8,11,18,0)"); gradient.addColorStop(0.6, "rgba(8,11,18,.08)"); gradient.addColorStop(1, "rgba(8,11,18,.94)");
      ctx.fillStyle = gradient; ctx.fillRect(cameraX, cameraY, width, height);

      if (secondsNow < hintUntilRef.current) {
        const route = findPath(maze,
          { row: Math.max(0, Math.min(maze.rows - 1, Math.floor(player.y))), col: Math.max(0, Math.min(maze.cols - 1, Math.floor(player.x))) },
          maze.exit,
        );
        ctx.save();
        ctx.globalAlpha = Math.min(1, (hintUntilRef.current - secondsNow) / 0.8);
        ctx.strokeStyle = "#ffd54a"; ctx.shadowColor = "#ffd54a"; ctx.shadowBlur = 16;
        ctx.lineWidth = Math.max(3, cell * 0.09); ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.setLineDash([cell * 0.22, cell * 0.16]); ctx.lineDashOffset = -now / 40;
        ctx.beginPath(); ctx.moveTo(player.x * cell, player.y * cell);
        for (const step of route.slice(1)) ctx.lineTo((step.col + 0.5) * cell, (step.row + 0.5) * cell);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      if (danger > 0.35) {
        const warning = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.72);
        warning.addColorStop(0, "rgba(255,23,68,0)"); warning.addColorStop(1, `rgba(255,23,68,${danger * 0.3})`);
        ctx.fillStyle = warning; ctx.fillRect(0, 0, width, height);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [setScreen]);

  const joystickMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const maxDistance = Math.min(rect.width, rect.height) * 0.34;
    const rawDistance = Math.hypot(rawX, rawY);
    const distance = Math.min(rawDistance, maxDistance);
    const angle = Math.atan2(rawY, rawX);

    const knobX = Math.cos(angle) * distance;
    const knobY = Math.sin(angle) * distance;

    joystickRef.current = {
      x: maxDistance > 0 ? knobX / maxDistance : 0,
      y: maxDistance > 0 ? knobY / maxDistance : 0,
    };

    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const joystickEnd = () => {
    joystickRef.current = { x: 0, y: 0 };

    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = "translate(-50%, -50%) translate(0px, 0px)";
    }
  };

  if (screen === "help") return <HelpPage onBack={() => setScreen(backToRef.current)} />;
  if (screen === "settings") return <SettingsPage settings={settings} onChange={updateSettings} hasSave={savedRun !== null} onReset={dropRun} onBack={() => setScreen(backToRef.current)} />;
  if (screen === "multiplayer") return <MultiplayerPage onBack={() => setScreen("home")} />;

  if (screen === "home") return (
    <main className="game-home">
      <div className="home-grid" aria-hidden="true" />
      <div className="brand-lockup animate-fade-in">
        <div className="brand-mark"><span>MAZE</span><b>X</b></div>
        <p>Escape the maze. Outrun the Hunter.</p>
      </div>
      <div className="home-runner" aria-hidden="true"><i /><span /><b /></div>
      <div className="home-actions animate-fade-in">
        <Button className="w-full" disabled={!savedRun} onClick={continueRun}><Play fill="currentColor" size={17} /> Continue <span className="status-tag">{savedRun ? `Maze ${savedRun.level}` : "no save"}</span></Button>
        <Button className="w-full" variant={savedRun ? "outline" : "default"} onClick={() => (savedRun ? setConfirmNew(true) : beginRound(1, true))}><RotateCcw size={17} /> New game</Button>
        <Button className="w-full" variant="outline" onClick={() => openPage("help")}><Info size={17} /> Help</Button>
        <Button className="w-full" variant="outline" onClick={() => openPage("settings")}><Settings size={17} /> Settings</Button>
        <Button className="w-full" variant="ghost" onClick={() => openPage("multiplayer")}>Multiplayer</Button>
      </div>
      <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new game?</AlertDialogTitle>
            <AlertDialogDescription>Your saved run (Maze {savedRun?.level}) will be replaced.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => beginRound(1, true)}>New game</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p className="home-rule">Every maze has a way out.</p>
    </main>
  );

  return (
    <main className={`game-screen ${danger > 0.62 ? "is-danger" : ""}`}>
      <div className="game-shell" ref={shellRef}>
        <canvas ref={canvasRef} className="game-canvas" aria-label="MazeX game maze" />
        <header className="game-hud">
          <div className="hud-cluster"><span className="hud-label">Maze</span><strong>{level.toString().padStart(2, "0")}</strong></div>
          <div className="timer"><span>{formatTime(time)}</span><small>{score.toLocaleString()} pts</small></div>
          <div className="hud-actions">
            <div className="lives" aria-label={`${lives} lives`}>{[0,1,2].map((i) => <Heart key={i} size={18} fill={i < lives ? "currentColor" : "none"} className={i < lives ? "life-on" : "life-off"} />)}</div>
            <button className="icon-control" onClick={pauseGame} aria-label="Pause game"><Pause size={19} /></button>
          </div>
        </header>

        {hunterAlert && screen === "playing" && <div className="danger-label">Hunter released</div>}
        {!hunterAlert && danger > 0.62 && screen === "playing" && <div className="danger-label">Hunter close</div>}
        {countdown > 0 && screen === "playing" && <div className="countdown"><span>READY?</span><strong key={countdown}>{countdown}</strong></div>}
        {countdown === 0 && time < 0.7 && screen === "playing" && <div className="countdown run"><strong>RUN!</strong></div>}

        <div className="controls">
          <div className="joystick" onPointerDown={joystickMove} onPointerMove={(event) => event.buttons && joystickMove(event)} onPointerUp={joystickEnd} onPointerCancel={joystickEnd} aria-label="Movement joystick">
            <div className="joystick-ring"><span ref={joystickKnobRef} /></div>
          </div>
          <div className="ability-controls">
            {settings.hints && <button className="icon-control hint-control" onClick={hint} disabled={hintsLeft === 0 || countdown > 0} aria-label={`Hint, ${hintsLeft} left`}><Lightbulb size={19} /><b>{hintsLeft}</b></button>}
            <button className="icon-control map-control" onClick={() => setShowMap((value) => !value)} aria-label="Toggle mini map"><Map size={19} /></button>
            <button className={`dash-control ${dashCooldown > 0 ? "cooling" : ""}`} onClick={dash} disabled={dashCooldown > 0} aria-label="Dash">
              <Zap size={24} fill="currentColor" />
              <span>{dashCooldown > 0 ? dashCooldown.toFixed(1) : "DASH"}</span>
              <i style={{ transform: `scaleX(${Math.max(0, 1 - dashCooldown / DASH_COOLDOWN)})` }} />
            </button>
          </div>
        </div>

        {showMap && <MiniMap maze={mazeRef.current} player={playerRef.current} hunter={hunterRef.current} />}

        {screen !== "playing" && <div className="modal-backdrop">
          <section className={`game-modal ${screen === "gameover" ? "modal-danger" : ""}`}>
            {screen === "paused" && <><Pause size={26} /><p className="eyebrow">Maze {level}</p><h1>Paused</h1><p>The Hunter waits in the dark.</p><Button className="w-full" onClick={resumeGame}><Play size={17} fill="currentColor" /> Resume</Button><Button className="w-full" variant="outline" onClick={() => openPage("help")}><Info size={17} /> Help</Button><Button className="w-full" variant="outline" onClick={() => openPage("settings")}><Settings size={17} /> Settings</Button><Button className="w-full" variant="ghost" onClick={() => setScreen("home")}>Exit to menu</Button></>}
            {screen === "caught" && <><Heart size={28} /><p className="eyebrow">{lives} lives remaining</p><h1>Caught</h1><p>The maze gives you another chance.</p><Button onClick={() => { resetPositions(); startAtRef.current = performance.now() + 3000; setCountdown(3); setScreen("playing"); }}><RotateCcw size={17} /> Try again</Button></>}
            {screen === "escaped" && <><Trophy size={29} /><p className="eyebrow">Maze {level} cleared</p><h1>Escaped</h1><div className="result-stats"><span><small>Time</small>{formatTime(time)}</span><span><small>Score</small>{score.toLocaleString()}</span></div>{hintsUsedRef.current > 0 && <p>Hints used: {hintsUsedRef.current}</p>}<Button onClick={async () => { const nextLevel = level + 1; if (levelsCompletedRef.current % 2 === 0) await showInterstitial(); beginRound(nextLevel, false); }}>Next maze <Zap size={17} /></Button></>}
            {screen === "gameover" && <><Heart size={29} /><p className="eyebrow">Maze {level}</p><h1>Game over</h1><div className="result-stats"><span><small>Score</small>{score.toLocaleString()}</span><span><small>Reached</small>{level}</span></div><Button onClick={watchAdForLives} disabled={rewardLoading}>{rewardLoading ? "Loading ad..." : "Watch ad +2 lives"}</Button><Button variant="danger" onClick={() => beginRound(1, true)}><RotateCcw size={17} /> New run</Button><Button variant="ghost" onClick={() => setScreen("home")}>Main menu</Button></>}
          </section>
        </div>}
      </div>
      <p className="desktop-hint">Move with WASD or arrow keys Â· Space to dash Â· H for a hint Â· P to pause</p>
    </main>
  );
}

function MiniMap({ maze, player, hunter }: { maze: Maze; player: Point; hunter: Point | null }) {
  return <div className="minimap" style={{ gridTemplateColumns: `repeat(${maze.cols}, 1fr)` }} aria-label="Mini map">
    {Array.from({ length: maze.rows * maze.cols }, (_, index) => {
      const row = Math.floor(index / maze.cols), col = index % maze.cols;
      const kind = row === Math.floor(player.y) && col === Math.floor(player.x) ? "runner" : hunter && row === Math.floor(hunter.y) && col === Math.floor(hunter.x) ? "hunter" : row === maze.exit.row && col === maze.exit.col ? "exit" : "";
      return <span key={index} className={kind} />;
    })}
  </div>;
}



























'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

// --------------- INTERFACES ---------------
interface Obstacle {
  id: number;
  x: number;
  width: number;
  height: number;
  fontSize: number;
}

interface JumpGameProps {
  onExit: () => void;
  gameTheme: 'day' | 'night';
}

interface BackgroundLayer {
  image: HTMLImageElement | null;
  src: string;
  x: number;
  speedMultiplier: number;
  y: number;
  width: number;
  height: number;
  isLoaded: boolean;
  isBaseLayer?: boolean;
}

interface HighScore {
  id: number;
  player_name: string;
  score: number;
}

// --------------- CONSTANTS ---------------
const GAME_INTERNAL_WIDTH = 800;
const GAME_INTERNAL_HEIGHT = 450;
const GAME_ASPECT_RATIO = 16 / 9;

const TARGET_FPS_FOR_ORIGINAL_BALANCE = 60;
const GRAVITY_ACCEL_PPS2 = 1.0 * TARGET_FPS_FOR_ORIGINAL_BALANCE * TARGET_FPS_FOR_ORIGINAL_BALANCE;
const JUMP_INITIAL_VELOCITY_PPS = -15 * TARGET_FPS_FOR_ORIGINAL_BALANCE;
const INITIAL_GAME_SPEED_PPS = 5 * TARGET_FPS_FOR_ORIGINAL_BALANCE;
const MAX_GAME_SPEED_PPS = 100 * TARGET_FPS_FOR_ORIGINAL_BALANCE;
const GAME_SPEED_INCREMENT_PPS = 1.4 * TARGET_FPS_FOR_ORIGINAL_BALANCE;

// --- PRECISION HITBOX SCALES ---
const ROBOT_HITBOX_SCALE_X = 0.5;    
const ROBOT_HITBOX_SCALE_Y = 0.85;   
const OBSTACLE_HITBOX_SCALE_X = 0.5; 
const OBSTACLE_HITBOX_SCALE_Y = 0.6; 

const exitButtonConfig = {
  radius: 25,
  padding: 15,
  get x() { return GAME_INTERNAL_WIDTH - this.radius - this.padding; },
  get y() { return this.radius + this.padding; },
};

// --------------- JUMP GAME COMPONENT ---------------
const JumpGame: React.FC<JumpGameProps> = ({ onExit, gameTheme }) => {
  // --------------- STATE ---------------
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [highScore, setHighScore] = useState(() =>
    typeof window !== 'undefined' ? Number(localStorage.getItem('highScore') || '0') : 0
  );
  const [currentBackgroundSet, setCurrentBackgroundSet] = useState<number>(1);
  const [isPortrait, setIsPortrait] = useState(false);
  const [viewportDims, setViewportDims] = useState({ w: 0, h: 0 });

  // --- Leaderboard & Celebration State ---
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<HighScore[]>([]);
  const [newHighScoreObj, setNewHighScoreObj] = useState<{score: number} | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --------------- REFS ---------------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null); 
  
  const animationFrameRef = useRef<number | null>(null);
  const gameThemeRef = useRef(gameTheme); 

  const robot = useRef({ x: 100, y: 0, vy: 0, width: 80, height: 80, jumping: false });
  const groundY = GAME_INTERNAL_HEIGHT - robot.current.height - 100;

  const gameStartedRef = useRef(gameStarted);
  const gameOverRef = useRef(gameOver);

  const frameIndex = useRef(0);
  const groundOffset = useRef(0);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const youDiedImageRef = useRef<HTMLImageElement | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const lastDeltaFrameTimeRef = useRef<number | null>(null);
  const frameDelay = 120;

  const scoreRef = useRef(0);
  const currentSpeed = useRef(INITIAL_GAME_SPEED_PPS);
  const lastSpeedIncreaseTimeRef = useRef<number>(performance.now());
  const scoreMultiplier = 0.01;

  const fadeOpacityRef = useRef(0);
  const allowRestartRef = useRef(false);
  
  const deathAudioRef = useRef<HTMLAudioElement | null>(null);
  const jumpAudioRef = useRef<HTMLAudioElement | null>(null);
  const soundtrackAudioRef = useRef<HTMLAudioElement | null>(null);

  const backgroundLayersRef = useRef<BackgroundLayer[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const nextObstacleId = useRef(0);
  const lastObstacleSpawnTimeRef = useRef<number>(performance.now());
  const nextObstacleSpawnDelayRef = useRef(2000);
  const minObstacleSpawnDelay = 500;
  const maxObstacleSpawnDelay = 3800;

  const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExitingRef = useRef<boolean>(false);

  // --------------- REF SYNCHRONIZATION ---------------
  useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { gameThemeRef.current = gameTheme; }, [gameTheme]); 

  // --------------- HELPER FUNCTIONS ---------------
  const getRandomSpawnDelay = useCallback(() => Math.random() * (maxObstacleSpawnDelay - minObstacleSpawnDelay) + minObstacleSpawnDelay, [maxObstacleSpawnDelay, minObstacleSpawnDelay]);
  const getRandomFontSize = useCallback(() => Math.random() * 32 + 24, []);

  const isCollision = useCallback((r: { x: number, y: number, width: number, height: number }, o: Obstacle): boolean => {
      const rx = r.x + (r.width * (1 - ROBOT_HITBOX_SCALE_X) / 2);
      const ry = r.y + (r.height * (1 - ROBOT_HITBOX_SCALE_Y) / 2);
      const rw = r.width * ROBOT_HITBOX_SCALE_X;
      const rh = r.height * ROBOT_HITBOX_SCALE_Y;
      
      const obstacleVisualTopY = groundY + robot.current.height - o.height;
      const ox = o.x + (o.width * (1 - OBSTACLE_HITBOX_SCALE_X) / 2);
      const oy = obstacleVisualTopY + (o.height * (1 - OBSTACLE_HITBOX_SCALE_Y) / 2);
      const ow = o.width * OBSTACLE_HITBOX_SCALE_X;
      const oh = o.height * OBSTACLE_HITBOX_SCALE_Y;
      
      return (
        rx < ox + ow && rx + rw > ox &&
        ry < oy + oh && ry + rh > oy
      );
  }, [groundY]);

  const requestExitWithDelay = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    exitTimeoutRef.current = setTimeout(() => {
      onExit();
      isExitingRef.current = false; exitTimeoutRef.current = null;
    }, 300);
  }, [onExit]);
  
  const getLogicalCoordinates = useCallback((clientX: number, clientY: number, currentCanvas: HTMLCanvasElement, rect: DOMRect) => {
    const css_x = clientX - rect.left; 
    const css_y = clientY - rect.top;
    let logicalX: number, logicalY: number;
    const isViewportPortrait = window.innerHeight > window.innerWidth;
    
    if (isViewportPortrait) {
        logicalX = (css_y / rect.height) * GAME_INTERNAL_WIDTH;
        logicalY = (1 - css_x / rect.width) * GAME_INTERNAL_HEIGHT;
    } else {
        logicalX = (css_x / rect.width) * GAME_INTERNAL_WIDTH;
        logicalY = (css_y / rect.height) * GAME_INTERNAL_HEIGHT;
    }
    return { logicalX, logicalY };
  }, []);

  // --------------- LEADERBOARD ACTIONS ---------------
  useEffect(() => {
    if (showLeaderboard) {
      fetch('https://api.cortaku.com/api/highscores')
        .then(res => res.json())
        .then(data => setLeaderboardData(data))
        .catch(err => console.error("Failed to load leaderboard", err));
    }
  }, [showLeaderboard]);

  const handleSaveScore = async () => {
    if (!playerName.trim() || !newHighScoreObj) return;
    setIsSubmitting(true);
    
    try {
      await fetch('https://api.cortaku.com/api/highscores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim(), score: newHighScoreObj.score })
      });
    } catch (err) {
      console.error("Failed to save score", err);
    }

    setIsSubmitting(false);
    setNewHighScoreObj(null);
    setShowLeaderboard(true); 
  };

  // --------------- CORE GAME ACTIONS ---------------
  const handleJump = useCallback(() => {
    if (!gameStartedRef.current || robot.current.jumping || gameOverRef.current) return;
    robot.current.vy = JUMP_INITIAL_VELOCITY_PPS;
    robot.current.jumping = true;
    if (jumpAudioRef.current) {
      jumpAudioRef.current.currentTime = 0;
      jumpAudioRef.current.play().catch(error => console.error("Error playing jump sound:", error));
    }
  }, []);

  const resetGame = useCallback(() => {
    gameOverRef.current = false; setGameOver(false); 
    fadeOpacityRef.current = 0; scoreRef.current = 0;
    robot.current.y = groundY; robot.current.vy = 0; robot.current.jumping = false;
    obstaclesRef.current = []; currentSpeed.current = INITIAL_GAME_SPEED_PPS;
    lastSpeedIncreaseTimeRef.current = performance.now();
    lastObstacleSpawnTimeRef.current = performance.now();
    nextObstacleSpawnDelayRef.current = getRandomSpawnDelay();
    allowRestartRef.current = false; setTimeout(() => { allowRestartRef.current = true; }, 500);
    lastFrameTimeRef.current = performance.now();
  }, [groundY, getRandomSpawnDelay]);

  const handleStartGame = useCallback(() => {
    if (gameStartedRef.current) return;
    if (!audioUnlocked) {
      if (soundtrackAudioRef.current) {
        soundtrackAudioRef.current.muted = false; soundtrackAudioRef.current.volume = 0.3; 
        const playPromise = soundtrackAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => setAudioUnlocked(true)).catch(() => setAudioUnlocked(true));
        } else { setAudioUnlocked(true); }
      } else { setAudioUnlocked(true); }
    }
    setGameStarted(true); 
    resetGame();
  }, [audioUnlocked, resetGame]);
  
  // --------------- GAME LOOP ---------------
  const gameLoop = useCallback((time: number) => {
    animationFrameRef.current = requestAnimationFrame(gameLoop); 
    
    const ctx = ctxRef.current;
    if (!ctx) return;

    const currentFrameTime = time;
    let deltaMs = currentFrameTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = currentFrameTime;
    if (deltaMs > 100) deltaMs = 100; 
    const deltaTimeSeconds = deltaMs / 1000.0;
    const currentTheme = gameThemeRef.current;

    ctx.clearRect(0, 0, GAME_INTERNAL_WIDTH, GAME_INTERNAL_HEIGHT);

    const layers = backgroundLayersRef.current;
    let hasBaseLayer = false;
    
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (!layer.isLoaded || !layer.image) continue;

        if (layer.isBaseLayer) {
            ctx.drawImage(layer.image, 0, 0, layer.width, layer.height);
            hasBaseLayer = true;
            continue;
        }

        if (gameStartedRef.current && !gameOverRef.current) {
            layer.x -= (currentSpeed.current * layer.speedMultiplier) * deltaTimeSeconds;
        }
        if (layer.width > 0 && layer.x <= -layer.width) { layer.x += layer.width; }
        
        ctx.drawImage(layer.image, layer.x, layer.y, layer.width, layer.height);
        ctx.drawImage(layer.image, layer.x + layer.width, layer.y, layer.width, layer.height);
        if (layer.width > 0 && (layer.x + layer.width * 2) < (GAME_INTERNAL_WIDTH + layer.width)) {
             ctx.drawImage(layer.image, layer.x + layer.width * 2, layer.y, layer.width, layer.height);
        }
    }

    if (!hasBaseLayer) {
        ctx.fillStyle = currentTheme === 'day' ? '#87CEEB' : '#0b1028';
        ctx.fillRect(0, 0, GAME_INTERNAL_WIDTH, GAME_INTERNAL_HEIGHT);
    }
    
    // Handle "Start Game" Screen
    if (!gameStartedRef.current) {
        ctx.font = '48px monospace';
        ctx.fillStyle = currentTheme === 'day' ? '#000000' : '#FFFFFF';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Start Game', GAME_INTERNAL_WIDTH / 2, GAME_INTERNAL_HEIGHT / 2 - 30);
        ctx.font = '24px monospace';
        ctx.fillText('Tap, Click, or Press Space', GAME_INTERNAL_WIDTH / 2, GAME_INTERNAL_HEIGHT / 2 + 30);
        return; 
    }

    // Game Logic & Updates
    if (!gameOverRef.current) {
        const normalizedSpeed = currentSpeed.current / INITIAL_GAME_SPEED_PPS;
        scoreRef.current += deltaMs * Math.pow(normalizedSpeed, 1.5) * scoreMultiplier; 

        if (currentFrameTime - lastSpeedIncreaseTimeRef.current > 4000 && currentSpeed.current < MAX_GAME_SPEED_PPS) {
            currentSpeed.current = Math.min(currentSpeed.current + GAME_SPEED_INCREMENT_PPS, MAX_GAME_SPEED_PPS);
            lastSpeedIncreaseTimeRef.current = currentFrameTime;
        }
        if (currentFrameTime - lastObstacleSpawnTimeRef.current > nextObstacleSpawnDelayRef.current) {
            const fontSize = getRandomFontSize();
            obstaclesRef.current.push({ id: nextObstacleId.current++, x: GAME_INTERNAL_WIDTH, width: fontSize * 0.6, height: fontSize * 0.8, fontSize });
            lastObstacleSpawnTimeRef.current = currentFrameTime;
            nextObstacleSpawnDelayRef.current = getRandomSpawnDelay();
        }
        robot.current.vy += GRAVITY_ACCEL_PPS2 * deltaTimeSeconds;
        robot.current.y += robot.current.vy * deltaTimeSeconds;
        if (robot.current.y > groundY) { robot.current.y = groundY; robot.current.vy = 0; robot.current.jumping = false; }
        
        groundOffset.current -= currentSpeed.current * deltaTimeSeconds;
        if (groundOffset.current <= -40) groundOffset.current += 40;
        
        const aliveObstacles = [];
        for (let i = 0; i < obstaclesRef.current.length; i++) {
            const obs = obstaclesRef.current[i];
            obs.x -= currentSpeed.current * deltaTimeSeconds;
            
            if (obs.x + obs.width > 0) aliveObstacles.push(obs);
            
            if (!gameOverRef.current && isCollision(robot.current, obs)) {
                gameOverRef.current = true; setGameOver(true);
                allowRestartRef.current = false; setTimeout(() => { allowRestartRef.current = true; }, 2000);
                fadeOpacityRef.current = 0;
                if (deathAudioRef.current) { deathAudioRef.current.currentTime = 0; deathAudioRef.current.play().catch(e => console.error("Death sound error:", e));}
                
                if (scoreRef.current > highScore) { 
                  const newHS = Math.floor(scoreRef.current); 
                  setHighScore(newHS); 
                  localStorage.setItem('highScore', String(newHS));
                  setNewHighScoreObj({ score: newHS }); 
                }
            }
        }
        obstaclesRef.current = aliveObstacles;

        if (currentFrameTime - (lastDeltaFrameTimeRef.current ?? currentFrameTime) >= frameDelay) {
            frameIndex.current = (frameIndex.current + 1) % 7;
            lastDeltaFrameTimeRef.current = currentFrameTime;
        }
    }

    // Draw Game Elements
    const padding = 12;
    ctx.font = window.innerWidth < 600 ? '16px monospace' : '20px monospace';
    ctx.fillStyle = currentTheme === 'day' ? '#333333' : '#FFFFFF';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${Math.floor(scoreRef.current)}`, padding, padding);
    ctx.fillText(`High Score: ${highScore}`, padding, padding + (window.innerWidth < 600 ? 20 : 26));

    const btnX = exitButtonConfig.x; const btnY = exitButtonConfig.y; const btnR = exitButtonConfig.radius;
    ctx.save(); ctx.beginPath(); ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 3; const xOff = btnR * 0.4;
    ctx.beginPath(); ctx.moveTo(btnX - xOff, btnY - xOff); ctx.lineTo(btnX + xOff, btnY + xOff);
    ctx.moveTo(btnX + xOff, btnY - xOff); ctx.lineTo(btnX - xOff, btnY + xOff); ctx.stroke(); ctx.restore();

    // UPDATED: Ground is now white for better contrast
    const tileW = 40; const groundTopY = groundY + robot.current.height;
    ctx.fillStyle = '#E8E8E8';
    for (let xP = groundOffset.current - tileW; xP < GAME_INTERNAL_WIDTH; xP += tileW) { ctx.fillRect(Math.floor(xP), groundTopY, tileW - 4, 14); }
    
    for (let i = 0; i < obstaclesRef.current.length; i++) {
        const obs = obstaclesRef.current[i];
        ctx.font = `${obs.fontSize}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(String.fromCodePoint(0x1F4A9), obs.x, groundTopY);
    }

    if (spriteRef.current) {
        const sC = 5, sR = 2; const fW = 1600 / sC, fH = 640 / sR;
        const sx = (frameIndex.current % sC) * fW; const sy = Math.floor(frameIndex.current / sC) * fH;
        ctx.drawImage(spriteRef.current, sx, sy, fW, fH, robot.current.x, robot.current.y, robot.current.width, robot.current.height);
    }

    if (gameOverRef.current && youDiedImageRef.current) {
        fadeOpacityRef.current = Math.min(fadeOpacityRef.current + (0.5 * deltaTimeSeconds), 0.8);
        const iW = 500, iH = 180; const dX = GAME_INTERNAL_WIDTH / 2 - iW / 2; const dY = GAME_INTERNAL_HEIGHT / 2 - iH / 2 - 20;
        const msg = window.innerWidth < 600 ? 'Tap to play again' : 'Press SPACE to play again';
        ctx.save(); ctx.globalAlpha = fadeOpacityRef.current;
        ctx.drawImage(youDiedImageRef.current, dX, dY, iW, iH);
        ctx.font = window.innerWidth < 600 ? '18px monospace' : '24px monospace';
        ctx.textAlign = 'center'; ctx.fillStyle = currentTheme === 'day' ? '#ffffff' : '#FFFFFF';
        ctx.fillText(msg, GAME_INTERNAL_WIDTH / 2, dY + iH + 40); ctx.restore();
    }
  }, [groundY, isCollision, getRandomFontSize, getRandomSpawnDelay, highScore]); 

  // --------------- EVENT HANDLERS ---------------
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (newHighScoreObj || showLeaderboard) return;

    if (!gameStartedRef.current) {
        if (e.code === 'Space' || e.code === 'Enter') handleStartGame();
        if (e.code === 'Escape') onExit(); 
        return;
    }
    if (e.repeat && e.code === 'Space') return;
    if (e.code === 'Escape') onExit();
    else if (gameOverRef.current && e.code === 'Space' && allowRestartRef.current) resetGame();
    else if ((e.code === 'Space' || e.code === 'ArrowUp') && !gameOverRef.current) handleJump();
  }, [onExit, handleStartGame, resetGame, handleJump, newHighScoreObj, showLeaderboard]);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (newHighScoreObj || showLeaderboard) return; 
    if (!gameStartedRef.current) { handleStartGame(); return; }
    event.preventDefault(); 
    const currentCanvas = canvasRef.current; if (!currentCanvas) return;
    const touch = event.touches[0]; if (!touch) return;
    const rect = currentCanvas.getBoundingClientRect();
    const { logicalX, logicalY } = getLogicalCoordinates(touch.clientX, touch.clientY, currentCanvas, rect);
    const dx = logicalX - exitButtonConfig.x; const dy = logicalY - exitButtonConfig.y;
    if (Math.sqrt(dx * dx + dy * dy) < exitButtonConfig.radius) requestExitWithDelay();
    else if (gameOverRef.current && allowRestartRef.current) resetGame();
    else if (!gameOverRef.current) handleJump();
  }, [getLogicalCoordinates, requestExitWithDelay, resetGame, handleJump, handleStartGame, newHighScoreObj, showLeaderboard]);

  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (newHighScoreObj || showLeaderboard) return; 
    if (!gameStartedRef.current) { handleStartGame(); return; }
    const currentCanvas = canvasRef.current; if (!currentCanvas) return;
    const rect = currentCanvas.getBoundingClientRect();
    const { logicalX, logicalY } = getLogicalCoordinates(event.clientX, event.clientY, currentCanvas, rect);
    const dx = logicalX - exitButtonConfig.x; const dy = logicalY - exitButtonConfig.y;
    if (Math.sqrt(dx * dx + dy * dy) < exitButtonConfig.radius) requestExitWithDelay();
  }, [getLogicalCoordinates, requestExitWithDelay, handleStartGame, newHighScoreObj, showLeaderboard]);

  const handleResizeCanvas = useCallback(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    
    const currentIsPortrait = vpH > vpW;
    setIsPortrait(currentIsPortrait);
    setViewportDims({ w: vpW, h: vpH });

    const maxW = currentIsPortrait ? vpH : vpW;
    const maxH = currentIsPortrait ? vpW : vpH;

    cvs.width = GAME_INTERNAL_WIDTH;
    cvs.height = GAME_INTERNAL_HEIGHT;

    let sW = maxW;
    let sH = sW / GAME_ASPECT_RATIO;

    if (sH > maxH) {
        sH = maxH;
        sW = sH * GAME_ASPECT_RATIO;
    }

    sW = Math.max(1, Math.floor(sW));
    sH = Math.max(1, Math.floor(sH));

    cvs.style.width = `${sW}px`;
    cvs.style.height = `${sH}px`;
    cvs.style.imageRendering = (sW > GAME_INTERNAL_WIDTH || sH > GAME_INTERNAL_HEIGHT) ? 'pixelated' : 'auto';
    const c = cvs.getContext('2d'); if (c) c.imageSmoothingEnabled = false;
  }, []);

  // --------------- USEEFFECT HOOKS ---------------
  useEffect(() => {
    const spriteImg = new Image(); spriteImg.src = '/game-assets/robot-sprite.png';
    spriteImg.onload = () => { spriteRef.current = spriteImg; };
    const youDiedImgAsset = new Image(); youDiedImgAsset.src = '/game-assets/you_died.png';
    youDiedImgAsset.onload = () => { youDiedImageRef.current = youDiedImgAsset; };

    const layersDataConfig = [
      { imageName: '1.png', speedMultiplier: 0, isBaseLayer: true }, { imageName: '2.png', speedMultiplier: 0.05 },
      { imageName: '3.png', speedMultiplier: 0.15 }, { imageName: '4.png', speedMultiplier: 0.3 },
      { imageName: '5.png', speedMultiplier: 0.5 },
    ];
    const newLoadedLayers: BackgroundLayer[] = layersDataConfig.map(ld => ({
      image: null, src: `/game-assets/Backgrounds/${currentBackgroundSet}/${gameTheme}/${ld.imageName}`,
      x: 0, speedMultiplier: ld.speedMultiplier, y: 0, width: 0, height: GAME_INTERNAL_HEIGHT,
      isLoaded: false, isBaseLayer: ld.isBaseLayer || false,
    }));
    backgroundLayersRef.current = newLoadedLayers; 
    newLoadedLayers.forEach((layer) => {
      const img = new Image(); layer.isLoaded = false; img.src = layer.src;
      img.onload = () => {
        layer.image = img;
        if (layer.isBaseLayer) { layer.width = GAME_INTERNAL_WIDTH; layer.height = GAME_INTERNAL_HEIGHT; }
        else { layer.width = img.width * (GAME_INTERNAL_HEIGHT / img.height); layer.height = GAME_INTERNAL_HEIGHT; }
        layer.isLoaded = true;
      };
    });
  }, [gameTheme, currentBackgroundSet]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; 
    ctxRef.current = canvas.getContext('2d');
    if (ctxRef.current) ctxRef.current.imageSmoothingEnabled = false;
    
    document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden';
    
    handleResizeCanvas(); 

    let resizeTimeout: NodeJS.Timeout;
    const delayedResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResizeCanvas, 150);
    };

    window.addEventListener('resize', delayedResize);
    window.addEventListener('orientationchange', delayedResize);
    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('click', handleCanvasClick);

    if (!animationFrameRef.current) {
        lastFrameTimeRef.current = performance.now();
        animationFrameRef.current = requestAnimationFrame(gameLoop);
    }

    return () => { 
      window.removeEventListener('resize', delayedResize);
      window.removeEventListener('orientationchange', delayedResize);
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(resizeTimeout);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('touchstart', handleTouchStart);
        canvasRef.current.removeEventListener('click', handleCanvasClick);
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null; 
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
      isExitingRef.current = false; 
      soundtrackAudioRef.current?.pause();
      document.body.style.overflow = ''; document.documentElement.style.overflow = '';
    };
  }, [onExit, handleKeyDown, handleTouchStart, handleCanvasClick, handleResizeCanvas, gameLoop]);

  useEffect(() => {
    const audio = soundtrackAudioRef.current;
    if (audio) {
        if (gameStartedRef.current && !gameOver && audioUnlocked) { 
            audio.play().catch(e => console.warn("Soundtrack play failed:", e));
        } else {
            audio.pause();
        }
    }
  }, [gameOver, audioUnlocked, gameStarted]); 

  // --------------- JSX RENDER ---------------
  return (
    <div className="w-full h-full flex items-center justify-center bg-black relative overflow-hidden">
      
      {/* --- CANVAS WRAPPER (Handles Game Rotation Only) --- */}
      <div 
        className="absolute flex items-center justify-center origin-center transition-transform duration-300"
        style={{
          width: isPortrait ? `${viewportDims.h}px` : '100%',
          height: isPortrait ? `${viewportDims.w}px` : '100%',
          transform: isPortrait ? 'rotate(90deg)' : 'none',
        }}
      >
        <canvas 
            ref={canvasRef} 
            className="z-10" 
            width={GAME_INTERNAL_WIDTH} 
            height={GAME_INTERNAL_HEIGHT}
        />
      </div>
      
      {/* Floating Leaderboard Button */}
      {(!gameStarted || gameOver) && !newHighScoreObj && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowLeaderboard(true); }}
          className="absolute bottom-6 right-6 bg-yellow-400 text-yellow-900 px-6 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform z-40"
        >
          🏆 Leaderboard
        </button>
      )}

      {/* CELEBRATION OVERLAY */}
      {newHighScoreObj && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(25)].map((_, i) => {
              const randomDuration = Math.random() * 3 + 2; 
              const randomDelay = Math.random() * -5;
              return (
                <div key={i} className="absolute animate-float" style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  fontSize: `${Math.random() * 25 + 20}px`,
                  animationDuration: `${randomDuration}s`,
                  animationDelay: `${randomDelay}s`,
                  animationDirection: Math.random() > 0.5 ? 'alternate' : 'alternate-reverse'
                }}>
                  {['🎉', '✨', '🏆', '⭐', '🔥'][Math.floor(Math.random() * 5)]}
                </div>
              );
            })}
          </div>

          <div className="bg-card-light dark:bg-card-dark p-6 sm:p-8 rounded-2xl shadow-2xl text-center z-10 w-[90%] max-w-sm border-4 border-yellow-400">
            <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-yellow-400 to-orange-500 mb-2 animate-pulse">
              NEW HIGH SCORE!
            </h2>
            <p className="text-5xl font-bold text-text-main-light dark:text-text-main-dark mb-6">
              {newHighScoreObj.score}
            </p>

            <input
              type="text"
              autoFocus
              maxLength={15}
              placeholder="Enter your name..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveScore(); }}
              className="w-full text-center text-xl p-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white mb-4 focus:outline-none focus:border-yellow-400"
            />

            <button
              onClick={handleSaveScore}
              disabled={isSubmitting || !playerName.trim()}
              className="w-full bg-linear-to-r from-yellow-400 to-orange-500 text-white font-bold text-xl py-3 rounded-lg shadow-lg hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Claim Score!'}
            </button>
          </div>
        </div>
      )}

      {/* LEADERBOARD OVERLAY */}
      {showLeaderboard && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md max-h-[85%] flex flex-col overflow-hidden">
            <div className="p-4 bg-linear-to-r from-yellow-400 to-orange-500 flex justify-between items-center text-white">
              <h2 className="text-2xl font-bold">🏆 Top Players</h2>
              <button onClick={() => setShowLeaderboard(false)} className="text-white hover:text-gray-200 text-3xl leading-none cursor-pointer">&times;</button>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1">
              {leaderboardData.length === 0 ? (
                <p className="text-center text-text-muted-light dark:text-text-muted-dark py-8 font-bold animate-pulse">Loading scores...</p>
              ) : (
                <ul className="space-y-2">
                  {leaderboardData.map((entry, i) => (
                    <li key={entry.id} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <span className="font-bold flex items-center gap-2 text-text-main-light dark:text-text-main-dark">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="w-5 text-center text-gray-500">{i + 1}</span>}
                        {entry.player_name}
                      </span>
                      <span className="font-mono font-bold text-yellow-500 text-lg">{entry.score}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <audio ref={deathAudioRef} src="/game-assets/death_sound.mp3" preload="auto" />
      <audio ref={jumpAudioRef} src="/game-assets/jump.wav" preload="auto" />
      <audio ref={soundtrackAudioRef} src="/game-assets/soundtrack.mp3" loop preload="auto" />
    </div>
  );
};

export default JumpGame;
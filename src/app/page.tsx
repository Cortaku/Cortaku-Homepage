// src/app/page.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { useTheme } from 'next-themes';
import {
  Sun, Moon, Tv, Utensils, Film, Youtube, MessageSquare,
  Bot,
  Dumbbell
} from 'lucide-react';
import JumpGame from '@/components/JumpGame';
import CherryBlossomAnimation from '@/components/CherryBlossomAnimation';

// For TypeScript: Declare custom properties on the Window object
declare global {
  interface Window {
    disableBlossoms?: boolean; // Used to control CherryBlossomAnimation from other components like JumpGame
  }
}

// --------------- INTERFACES ---------------
// Structure for individual particles in the mouse/touch effect
interface Particle {
  id: number; x: number; y: number; vx: number; vy: number;
  opacity: number; size: number; color: string; life: number;
}
// Structure for managing the state of the idle bot animation
interface IdleBotState {
  status: 'hidden' | 'visible' | 'hiding';
  top: number;
  left: number;
}

// --------------- CONSTANTS ---------------
// Particle system configuration
const MAX_PARTICLES = 1000;
const PARTICLES_PER_FRAME = 10; // Number of particles emitted per interval when interaction is active

// Idle bot animation configuration
const IDLE_TIMEOUT = 5000; // ms: Time of inactivity before the idle bot appears
const HIDE_ANIMATION_DURATION = 1000; // ms: Duration of the bot's hiding animation

// --------------- THEME SWITCHER COMPONENT ---------------
// A button component to toggle between light and dark themes using next-themes.
const ThemeSwitcher = ({ onThemeToggle }: { onThemeToggle: () => void }) => {
  const [mounted, setMounted] = useState(false); // Ensures component is mounted on client before using theme
  const { theme, setTheme } = useTheme();

  // Set mounted to true after initial client render to avoid hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // Avoid rendering on server or during hydration mismatch

  // Toggles the theme and calls an external callback
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    onThemeToggle(); // Propagates theme toggle for other actions (e.g., rainbow effect)
  };

  return (
    <button
      onClick={toggleTheme}
      className="emoji-button p-2 rounded-full hover:bg-card-light/50 dark:hover:bg-card-dark/50 transition-colors duration-200 text-2xl"
      aria-label="Toggle Theme"
      style={{ fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}
    >
      {theme === 'dark' ? '☀️' : '🌙'} {/* Sun for dark theme (to switch to light), Moon for light */}
    </button>
  );
};

// --------------- APP CARD COMPONENT ---------------
// A reusable card component for displaying app links with a 3D hover effect.
const AppCard = forwardRef<HTMLAnchorElement, {
  title: string;
  linkUrl: string;
  icon: React.ElementType; // Icon component (e.g., from lucide-react)
  bgColorClass: string;    // Tailwind CSS class for background color
  iconColorClass: string;  // Tailwind CSS class for icon color
}>(({ title, linkUrl, icon: Icon, bgColorClass, iconColorClass }, ref) => {
  const [rotate, setRotate] = useState({ x: 0, y: 0 }); // State for 3D rotation values
  const [isHovered, setIsHovered] = useState(false);   // State to track hover for visual effects

  // Calculates rotation based on mouse position within the card for a perspective effect
  const handleMouseMove = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - rect.width / 2;
    const mouseY = event.clientY - rect.top - rect.height / 2;
    setRotate({ y: (mouseX / (rect.width / 2)) * 30, x: (mouseY / (rect.height / 2)) * -30 }); // Max 30deg rotation
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => { setIsHovered(false); setRotate({ x: 0, y: 0 }); }; // Reset on mouse leave

  // CSS transform string for 3D effects (translate, scale, rotate)
  const transformStyle = `translateZ(${isHovered ? 30 : 0}px) scale(${isHovered ? 1.05 : 1}) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`;

  return (
    <a
      ref={ref} // Forwarded ref for accessing the DOM element
      href={linkUrl} target="_blank" rel="noopener noreferrer"
      className="app-card-link bg-card-light dark:bg-card-dark rounded-xl shadow-lg flex flex-col p-6 text-center items-center aspect-square justify-center group"
      onMouseMove={handleMouseMove} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
      style={{ perspective: '1000px', transform: transformStyle, transition: 'transform 0.3s ease-out', zIndex: 20 }}
    >
      <div className="app-card-inner pointer-events-none"> {/* Inner div to prevent mouse events on children from interfering */}
        <div className={`icon-wrapper p-5 rounded-full transition-colors duration-300 ${bgColorClass} bg-opacity-30 dark:bg-opacity-20 group-hover:bg-opacity-50 dark:group-hover:bg-opacity-30`}>
          <Icon className={`w-10 h-10 sm:w-12 sm:h-12 transition-colors duration-300 ${iconColorClass}`} />
        </div>
        <div className="title-wrapper">
          <h3 className="text-lg font-semibold text-text-main-light dark:text-text-main-dark transition-colors duration-300">{title}</h3>
        </div>
      </div>
    </a>
  );
});
AppCard.displayName = 'AppCard'; // For better debugging in React DevTools

// --------------- HOME PAGE COMPONENT ---------------
export default function HomePage() {
  // Page-specific constants and data
  const emailAddress = "jabroniwan@gmail.com";
  const youtubeLink = "https://www.youtube.com/@cortaku";
  const letterboxd = "https://letterboxd.com/ScreenPeeper/";
  
  // App data for AppCards, memoized to prevent re-creation on every render of HomePage
  const apps = React.useMemo(() => [
    { title: "Fitness", linkUrl: "https://sparky.cortaku.com", icon: Dumbbell, bgColorClass: "bg-pastel-pink", iconColorClass: "text-rose-500 dark:text-pastel-pink" },
    { title: "Mealie", linkUrl: "https://mealie.cortaku.com", icon: Utensils, bgColorClass: "bg-pastel-green", iconColorClass: "text-emerald-600 dark:text-pastel-green" },
    { title: "Plex", linkUrl: "https://plex.cortaku.com/web/index.html", icon: Tv, bgColorClass: "bg-pastel-blue", iconColorClass: "text-sky-600 dark:text-pastel-blue" },
  ], []);

  // State hooks for managing various page features
  const [showGame, setShowGame] = useState(false);             // Toggles visibility of the JumpGame
  const [particles, setParticles] = useState<Particle[]>([]);  // Array of active mouse/touch particles
  const [toggleCount, setToggleCount] = useState(0);           // Tracks theme toggle clicks for rainbow Easter egg
  const [showRainbow, setShowRainbow] = useState(false);       // Controls visibility of the rainbow effect
  const [idleBotState, setIdleBotState] = useState<IdleBotState>({ status: 'hidden', top: 0, left: 0 }); // Manages idle bot's state and position

  // Refs for DOM elements and mutable values that don't trigger re-renders
  const containerRef = useRef<HTMLDivElement>(null);    // Ref for the main page container (for particle bounds)
  const mouseDownRef = useRef(false);                  // Tracks if the mouse button is currently pressed
  const mousePos = useRef({ x: 0, y: 0 });             // Stores current mouse position relative to the container
  const audioRef = useRef<HTMLAudioElement>(null);     // Ref for the rainbow effect's audio element
  const showGameRef = useRef(showGame);                // Ref to access the current `showGame` state in callbacks
  const idleBotStatusRef = useRef<IdleBotState['status']>('hidden'); // Ref for the current status of the idle bot
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);        // Timer for triggering idle bot appearance
  const botVisibilityTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer for how long bot stays visible
  const botHidingTimerRef = useRef<NodeJS.Timeout | null>(null);   // Timer for the bot's hiding animation
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);       // Array of refs for AppCard elements (for idle bot positioning)
  const particleIntervalRef = useRef<NodeJS.Timeout | null>(null); // Interval ID for emitting particles while mouse is down
  const touchIntervalRef = useRef<NodeJS.Timeout | null>(null);    // Interval ID for emitting particles during touch

  const { theme } = useTheme(); // `theme` from next-themes will be 'light', 'dark', or resolved 'system' theme

  // Effect to sync idleBotState.status to its ref for access in potentially stale closures
  useEffect(() => {
    idleBotStatusRef.current = idleBotState.status;
  }, [idleBotState.status]);

  // Effect to manage side-effects when `showGame` state changes (e.g., clearing idle bot)
  useEffect(() => {
    showGameRef.current = showGame; // Keep ref updated with current state
    if (showGame) { // If game is being shown
      // Clear all timers related to the idle bot and reset its state
      clearTimeout(idleTimerRef.current!);
      clearTimeout(botVisibilityTimerRef.current!);
      clearTimeout(botHidingTimerRef.current!);
      idleTimerRef.current = botVisibilityTimerRef.current = botHidingTimerRef.current = null;
      if (idleBotStatusRef.current !== 'hidden') {
        setIdleBotState({ status: 'hidden', top: 0, left: 0 });
      }
    }
  }, [showGame]);

  // Effect for animating particles (runs continuously via requestAnimationFrame)
  useEffect(() => {
    const animate = () => {
      if (!showGameRef.current) { // Only animate particles if the game is NOT being shown
        setParticles(prev => prev.map(p => {
          let newX = p.x + p.vx; let newY = p.y + p.vy;
          let newVx = p.vx; let newVy = p.vy;
          const container = containerRef.current;
          if (container) { // Bounce particles off the edges of the container
            const width = container.clientWidth; const height = container.clientHeight;
            if (newX <= 0 || newX >= width) newVx *= -1;
            if (newY <= 0 || newY >= height) newVy *= -1;
            // Clamp position to stay within bounds
            newX = Math.max(0, Math.min(width, newX)); 
            newY = Math.max(0, Math.min(height, newY));
          }
          // Update particle properties (movement, life, opacity)
          return { ...p, x: newX, y: newY, vx: newVx, vy: newVy, life: p.life - 1, opacity: Math.max(0, (p.life - 1) / 120) };
        }).filter(p => p.life > 0)); // Remove particles whose lifespan has ended
      }
      requestAnimationFrame(animate); // Continue the animation loop
    };
    const animationFrameId = requestAnimationFrame(animate); // Start the animation
    return () => cancelAnimationFrame(animationFrameId); // Cleanup on unmount
  }, []); // Empty dependency array: run once on mount

  // Callback for theme toggle actions, including the rainbow Easter egg
  const handleThemeToggle = useCallback(() => {
    setToggleCount(prev => {
      const next = prev + 1;
      if (next >= 5) { // Trigger rainbow effect after 5 rapid toggles
        setShowRainbow(true);
        audioRef.current?.play().catch(console.warn); // Play rainbow sound
        setTimeout(() => setShowRainbow(false), 3000); // Rainbow effect lasts 3 seconds
        return 0; // Reset count
      }
      return next;
    });
  }, []);

  // Functions to control JumpGame visibility and related side-effects
  const startGame = () => {
    if (typeof window !== 'undefined') window.disableBlossoms = true; // Optionally disable other page animations
    setShowGame(true);
  };
  const handleGameExit = () => {
    if (typeof window !== 'undefined') window.disableBlossoms = false; // Re-enable other page animations
    setShowGame(false);
  };

  // Callback to emit a burst of particles at specified coordinates
  const emitParticles = useCallback((x: number, y: number) => {
    if (showGameRef.current) return; // Do not emit if the game is currently shown
    const newParticlesArr = Array.from({ length: PARTICLES_PER_FRAME }).map(() => ({
      id: Math.random(), x, y, 
      vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, // Random velocity
      opacity: 1, size: Math.random() * 6 + 3, // Random size
      color: ['#fecdd3', '#bfdbfe', '#bbf7d0', '#fef08a', '#fbcfe8'][Math.floor(Math.random() * 5)], // Random pastel color
      life: 120 // Particle lifespan in animation frames
    }));
    setParticles(p => [...p, ...newParticlesArr].slice(-MAX_PARTICLES)); // Add new, cap at max
  }, []); // No component-scope dependencies

  // --- Idle Bot Logic (memoized functions for stability) ---
  // Shows the idle bot near a random AppCard
  const showIdleBot = useCallback(() => {
    if (showGameRef.current || idleBotStatusRef.current !== 'hidden') return; // Conditions to show bot
    const availableCards = cardRefs.current.filter(ref => ref); // Get available card elements
    if (availableCards.length === 0) { 
        // If no cards, reschedule (scheduleNextIdleCheck defined below, so it's available in this scope)
        scheduleNextIdleCheck(); 
        return; 
    } 
    
    const targetCard = availableCards[Math.floor(Math.random() * availableCards.length)]; // Pick a random card
    if (!targetCard || !containerRef.current) { scheduleNextIdleCheck(); return; } // If no target, reschedule
    
    const cardRect = targetCard.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    // Calculate position relative to the container
    const top = cardRect.top - containerRect.top - 15; 
    const left = cardRect.left - containerRect.left + cardRect.width / 2;
    setIdleBotState({ status: 'visible', top, left });
  }, []); // Will add scheduleNextIdleCheck to dependencies once it's defined and memoized

  // Schedules the next check for showing the idle bot
  const scheduleNextIdleCheck = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current); // Clear existing timer
    idleTimerRef.current = null;
    // Schedule if game is not showing and bot is currently hidden
    if (!showGameRef.current && idleBotStatusRef.current === 'hidden') {
      idleTimerRef.current = setTimeout(showIdleBot, IDLE_TIMEOUT);
    }
  // `showIdleBot` is a dependency here. Ensure `showIdleBot` is memoized if this callback is a dependency elsewhere.
  }, [showIdleBot]); 

  // Starts the hiding animation sequence for the idle bot
  const startHidingSequence = useCallback(() => {
    if (idleBotStatusRef.current !== 'visible' || showGameRef.current) return; // Conditions to start hiding
    if (botVisibilityTimerRef.current) clearTimeout(botVisibilityTimerRef.current); 
    botVisibilityTimerRef.current = null;
    if (botHidingTimerRef.current) clearTimeout(botHidingTimerRef.current); // Clear existing hide timer
    
    setIdleBotState(prev => ({ ...prev, status: 'hiding' })); // Set status to trigger CSS animation
    botHidingTimerRef.current = setTimeout(() => {
      setIdleBotState({ status: 'hidden', top: 0, left: 0 }); // Fully hide after animation
    }, HIDE_ANIMATION_DURATION);
  }, []);

  // Effect to manage user activity detection for idle bot logic
  useEffect(() => {
    const handleActivity = () => { // Called on any user activity
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current); // Reset idle timer
      idleTimerRef.current = null;
      if (idleBotStatusRef.current === 'visible') {
        startHidingSequence(); // If bot is visible, make it hide
      } else if (idleBotStatusRef.current === 'hidden') {
        scheduleNextIdleCheck(); // If bot is hidden, schedule next appearance check
      }
    };

    if (!showGame) { // Only run idle bot logic if the game is not active
      scheduleNextIdleCheck(); // Initial schedule
      // Add global event listeners for user activity
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('click', handleActivity);
      window.addEventListener('scroll', handleActivity);
      return () => { // Cleanup: remove listeners and clear all related timers
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('click', handleActivity);
        window.removeEventListener('scroll', handleActivity);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (botVisibilityTimerRef.current) clearTimeout(botVisibilityTimerRef.current);
        if (botHidingTimerRef.current) clearTimeout(botHidingTimerRef.current);
        if (particleIntervalRef.current) { clearInterval(particleIntervalRef.current); particleIntervalRef.current = null; }
        if (touchIntervalRef.current) { clearInterval(touchIntervalRef.current); touchIntervalRef.current = null; }
      };
    } else { // If game is shown, ensure idle timer is cleared
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, [showGame, scheduleNextIdleCheck, startHidingSequence]); // Dependencies for this effect

  // Effect to re-schedule idle check if bot becomes hidden (e.g., after finishing its hiding animation)
  useEffect(() => {
    if (idleBotState.status === 'hidden' && !showGame) {
      scheduleNextIdleCheck();
    }
  }, [idleBotState.status, showGame, scheduleNextIdleCheck]);

  // --- Mouse Particle Handlers ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showGameRef.current) return; // No particles if game is shown
    mouseDownRef.current = true;
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return;
    mousePos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    emitParticles(mousePos.current.x, mousePos.current.y); // Emit once on mousedown
    if (!particleIntervalRef.current) { // Start interval for continuous emission
      particleIntervalRef.current = setInterval(() => {
        emitParticles(mousePos.current.x, mousePos.current.y);
      }, 40); // Emit every 40ms
    }
  };
  const handleMouseUp = () => {
    mouseDownRef.current = false;
    if (particleIntervalRef.current) { clearInterval(particleIntervalRef.current); particleIntervalRef.current = null; }
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showGameRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) mousePos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // Particles are emitted by the interval started on mousedown
  };
  
  // --- Touch Particle Handlers ---
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (showGameRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return;
    const touch = e.touches[0];
    if (touch) {
      mousePos.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      emitParticles(mousePos.current.x, mousePos.current.y); // Emit on initial touch
      if (touchIntervalRef.current) clearInterval(touchIntervalRef.current); // Clear previous interval
      touchIntervalRef.current = setInterval(() => { // Start new interval
        emitParticles(mousePos.current.x, mousePos.current.y);
      }, 40);
    }
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (showGameRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return;
    const touch = e.touches[0];
    if (touch) mousePos.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    // Particles are emitted by the interval started in handleTouchStart
  };
  const handleTouchEnd = () => {
    if (touchIntervalRef.current) { clearInterval(touchIntervalRef.current); touchIntervalRef.current = null; }
  };

  // --------------- JSX RENDER ---------------
  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`relative min-h-screen w-full max-w-screen overflow-x-hidden flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden ${showRainbow ? 'bg-rainbow' : 'bg-bg-light dark:bg-bg-dark'} text-text-main-light dark:text-text-main-dark`}
      style={{ touchAction: 'none' }}
    >
      {/* Particles are only rendered when the game is not being shown */}
      {!showGame && particles.map(p => (
        <div key={p.id} className="absolute rounded-full" style={{
          width: `${p.size}px`, height: `${p.size}px`, backgroundColor: p.color,
          opacity: p.opacity, left: `${p.x}px`, top: `${p.y}px`, transform: 'translate(-50%, -50%)',
          pointerEvents: 'none', zIndex: 5 
        }} />
      ))}

      {/* Rainbow Easter Egg elements, shown conditionally */}
      {showRainbow && (
        <>
          <div className="absolute inset-0 bg-white animate-flashRainbow z-40 pointer-events-none" />
          <div className="absolute top-10 w-full text-4xl sm:text-6xl z-50 pointer-events-none whitespace-nowrap overflow-hidden animate-marquee-fast">
            🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈
          </div>
          <div className="absolute inset-0 z-40 pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute', left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                fontSize: `${Math.random() * 30 + 20}px`, animation: 'float 7s linear infinite'
              }}>🌈</div>
            ))}
          </div>
        </>
      )}

      {/* Audio element for the Rainbow Easter Egg sound effect */}
      <audio ref={audioRef} src="/sounds/grunt_party.mp3" preload="auto" />

      {/* Cherry Blossom Animation, shown conditionally when game is not active */}
      {!showGame && <CherryBlossomAnimation />}

      {/* Idle Bot character, shown conditionally when game is not active */}
      {idleBotState.status !== 'hidden' && !showGame && (
        <div
          className={`idle-character ${idleBotState.status === 'visible' ? 'visible' : ''} ${idleBotState.status === 'hiding' ? 'hiding' : ''}`}
          style={{ top: `${idleBotState.top}px`, left: `${idleBotState.left}px`, zIndex: 15 }}
          aria-hidden="true"
        >
          <Bot className="w-10 h-10 text-text-main-light dark:text-text-main-dark" />
        </div>
      )}

      {/* Main Content: Either the JumpGame or the homepage links & footer */}
      {showGame ? (
        // Game View
        <div className="w-full h-full flex items-center justify-center" style={{ cursor: 'default' }}>
          {/* Wrapper for potential CSS to enforce landscape on mobile for the game */}
          <div className="rotate-landscape-wrapper"> 
            <JumpGame 
              onExit={handleGameExit} 
              gameTheme={theme === 'dark' ? 'night' : 'day'} // Pass current theme to JumpGame
            />
          </div>
        </div>
      ) : (
        // Homepage View (when game is not shown)
        <>
          <h1
            onClick={startGame} // Clickable title to launch the game
            className="select-none text-4xl sm:text-6xl font-bold mb-6 sm:mb-12 text-center text-transparent bg-clip-text bg-gradient-to-r from-pastel-pink via-pastel-purple to-pastel-blue dark:from-pastel-pink dark:via-pastel-purple dark:to-pastel-blue text-shadow z-20 cursor-pointer"
            style={{ cursor: 'url(/cursors/keyblade-slash.png) 45 5, auto' }} // Custom cursor
          >
            Cortaku
          </h1>

          {/* Grid of AppCards linking to other applications */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-xl w-full z-20 relative mobile-card-stack">
            {apps.map((app, index) => (
              <div className="scale-90 sm:scale-100 transition-transform" key={app.title}>
                <AppCard
                  {...app}
                  ref={el => { cardRefs.current[index] = el; }} // Collect refs to AppCards for idle bot positioning
                />
              </div>
            ))}
          </div>

          {/* Footer with social links and theme switcher */}
          <footer className="absolute bottom-0 left-0 right-0 p-4 flex flex-col sm:flex-row justify-between items-center w-full z-20 gap-2">
            <div className="flex space-x-4">
              <a href={`mailto:${emailAddress}`} aria-label="Email" className="text-text-muted-light dark:text-text-muted-dark hover:text-pastel-purple transition duration-300"><MessageSquare className="w-5 h-5" /></a>
              <a href={youtubeLink} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-text-muted-light dark:text-text-muted-dark hover:text-red-400 transition duration-300"><Youtube className="w-5 h-5" /></a>
              <a href={letterboxd} target="_blank" rel="noopener noreferrer" aria-label="Letterboxd" className="text-text-muted-light dark:text-text-muted-dark hover:text-red-400 transition duration-300"><Film className="w-5 h-5" /></a>
            </div>
            <ThemeSwitcher onThemeToggle={handleThemeToggle} />
          </footer>
        </>
      )}
    </div>
  );
}
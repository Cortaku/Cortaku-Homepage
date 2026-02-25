'use client';

import React, { useState, useEffect, useRef, useCallback, forwardRef, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Tv, Utensils, Film, Youtube, MessageSquare, Bot, Dumbbell } from 'lucide-react';
import JumpGame from '@/components/JumpGame';
import CherryBlossomAnimation from '@/components/CherryBlossomAnimation';

declare global {
  interface Window { disableBlossoms?: boolean; }
}

interface Particle {
  id: number; x: number; y: number; vx: number; vy: number;
  opacity: number; size: number; color: string; life: number;
}

interface IdleBotState {
  status: 'hidden' | 'visible' | 'hiding';
  top: number;
  left: number;
}

const MAX_PARTICLES = 1000;
const PARTICLES_PER_FRAME = 10;
const IDLE_TIMEOUT = 5000;
const HIDE_ANIMATION_DURATION = 1000;

// --- Components ---

const ThemeSwitcher = ({ onThemeToggle }: { onThemeToggle: () => void }) => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-10 h-10 p-2" />; 

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    onThemeToggle();
  };

  return (
    <button
      onClick={toggleTheme}
      className="emoji-button p-2 rounded-full hover:bg-card-light/50 dark:hover:bg-card-dark/50 transition-colors duration-200 text-2xl w-10 h-10 flex items-center justify-center"
      aria-label="Toggle Theme"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
};

const AppCard = forwardRef<HTMLAnchorElement, {
  title: string; linkUrl: string; icon: React.ElementType; bgWrapperClass: string; iconColorClass: string;
}>(({ title, linkUrl, icon: Icon, bgWrapperClass, iconColorClass }, ref) => {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2) * 30;
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2) * -30;
    setRotate({ x: y, y: x });
  };

  return (
    <a
      ref={ref} href={linkUrl} target="_blank" rel="noopener noreferrer"
      className="app-card-link bg-card-light dark:bg-card-dark rounded-xl shadow-lg flex flex-col p-6 text-center items-center aspect-square justify-center group"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setRotate({ x: 0, y: 0 }); }}
      style={{
        perspective: '1000px',
        transform: `translateZ(${isHovered ? 30 : 0}px) scale(${isHovered ? 1.05 : 1}) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        transition: 'transform 0.3s ease-out',
        zIndex: 20
      }}
    >
      <div className="app-card-inner pointer-events-none">
        <div className={`icon-wrapper p-5 rounded-full transition-colors duration-300 ${bgWrapperClass}`}>
          <Icon className={`w-10 h-10 sm:w-12 sm:h-12 transition-colors duration-300 ${iconColorClass}`} />
        </div>
        <div className="title-wrapper mt-4">
          <h3 className="text-lg font-semibold text-text-main-light dark:text-text-main-dark transition-colors duration-300">{title}</h3>
        </div>
      </div>
    </a>
  );
});
AppCard.displayName = 'AppCard';

// --- Main Page ---

export default function HomePage() {
  const { theme } = useTheme();
  const emailAddress = "jabroniwan@gmail.com";
  const youtubeLink = "https://www.youtube.com/@cortaku";
  const letterboxd = "https://letterboxd.com/ScreenPeeper/";

const apps = useMemo(() => [
    { 
      title: "Fitness", 
      linkUrl: "https://sparky.cortaku.com", 
      icon: Dumbbell, 
      bgWrapperClass: "bg-pastel-pink/30 dark:bg-pastel-pink/20 group-hover:bg-pastel-pink/50 dark:group-hover:bg-pastel-pink/30", 
      iconColorClass: "text-rose-500 dark:text-pastel-pink" 
    },
    { 
      title: "Mealie", 
      linkUrl: "https://mealie.cortaku.com", 
      icon: Utensils, 
      bgWrapperClass: "bg-pastel-green/30 dark:bg-pastel-green/20 group-hover:bg-pastel-green/50 dark:group-hover:bg-pastel-green/30", 
      iconColorClass: "text-emerald-600 dark:text-pastel-green" 
    },
    { 
      title: "Plex", 
      linkUrl: "https://plex.cortaku.com/web/index.html", 
      icon: Tv, 
      bgWrapperClass: "bg-pastel-blue/30 dark:bg-pastel-blue/20 group-hover:bg-pastel-blue/50 dark:group-hover:bg-pastel-blue/30", 
      iconColorClass: "text-sky-600 dark:text-pastel-blue" 
    },
  ], []);

  const [showGame, setShowGame] = useState(false);
  const [, setToggleCount] = useState(0);
  const [showRainbow, setShowRainbow] = useState(false);
  const [idleBotState, setIdleBotState] = useState<IdleBotState>({ status: 'hidden', top: 0, left: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  
  // High-performance particle storage
  const particlesRef = useRef<Particle[]>([]);
  const mousePos = useRef({ x: 0, y: 0 });
  
  // Timer Refs
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const botHidingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const interactionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync ref for the idle bot to prevent dependency loops
  const idleBotStatusRef = useRef<IdleBotState['status']>('hidden');
  useEffect(() => {
    idleBotStatusRef.current = idleBotState.status;
  }, [idleBotState.status]);

  // Sync canvas size to window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize(); // Set initial size
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stop background animations when the game is active
  useEffect(() => {
    if (typeof window !== 'undefined') window.disableBlossoms = showGame;
    if (showGame) setIdleBotState({ status: 'hidden', top: 0, left: 0 });
  }, [showGame]);

  // Canvas Drawing Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    let animationFrameId: number;

    const animate = () => {
      if (!ctx || !canvas || showGame) return;

      // Clear the canvas for the next frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw each particle
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x <= 0 || p.x >= canvas.width) p.vx *= -1;
        if (p.y <= 0 || p.y >= canvas.height) p.vy *= -1;

        p.life -= 1;
        p.opacity = Math.max(0, p.life / 120);

        if (p.life > 0) {
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
          return true; // Keep particle
        }
        return false; // Remove dead particle
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    if (!showGame) {
      animationFrameId = requestAnimationFrame(animate);
    }
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [showGame]);

  // Idle Bot Logic
  useEffect(() => {
    if (showGame) return;

    const hideBot = () => {
      setIdleBotState(prev => ({ ...prev, status: 'hiding' }));
      if (botHidingTimerRef.current) clearTimeout(botHidingTimerRef.current);
      botHidingTimerRef.current = setTimeout(() => {
        setIdleBotState({ status: 'hidden', top: 0, left: 0 });
      }, HIDE_ANIMATION_DURATION);
    };

    const showBot = () => {
      const cards = cardRefs.current.filter(Boolean);
      const target = cards[Math.floor(Math.random() * cards.length)];
      if (!target || !containerRef.current) return;

      const cardRect = target.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setIdleBotState({
        status: 'visible',
        top: cardRect.top - containerRect.top - 15,
        left: cardRect.left - containerRect.left + cardRect.width / 2
      });
    };

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      // We check the ref here instead of the state to prevent infinite loops!
      if (idleBotStatusRef.current === 'visible') hideBot();
      idleTimerRef.current = setTimeout(showBot, IDLE_TIMEOUT);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (botHidingTimerRef.current) clearTimeout(botHidingTimerRef.current);
    };
  }, [showGame]);

  // Rainbow Easter Egg
  const handleThemeToggle = useCallback(() => {
    setToggleCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowRainbow(true);
        audioRef.current?.play().catch(() => {});
        setTimeout(() => setShowRainbow(false), 3000);
        return 0;
      }
      return next;
    });
  }, []);

  // Particle Emitter
  const emitParticles = useCallback((x: number, y: number) => {
    if (showGame) return;
    const colors = ['#fecdd3', '#bfdbfe', '#bbf7d0', '#fef08a', '#fbcfe8'];
    const newParticles = Array.from({ length: PARTICLES_PER_FRAME }).map(() => ({
      id: Math.random(), x, y,
      vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
      opacity: 1, size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 120
    }));
    
    particlesRef.current.push(...newParticles);
    
    // Prevent memory leaks
    if (particlesRef.current.length > MAX_PARTICLES) {
      particlesRef.current.splice(0, particlesRef.current.length - MAX_PARTICLES);
    }
  }, [showGame]);

  // Interaction Handlers (Mouse & Touch merged logic)
  const startInteraction = (clientX: number, clientY: number) => {
    if (showGame) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    mousePos.current = { x: clientX - rect.left, y: clientY - rect.top };
    emitParticles(mousePos.current.x, mousePos.current.y);
    
    if (interactionIntervalRef.current) clearInterval(interactionIntervalRef.current);
    interactionIntervalRef.current = setInterval(() => {
      emitParticles(mousePos.current.x, mousePos.current.y);
    }, 40);
  };

  const updateInteraction = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) mousePos.current = { x: clientX - rect.left, y: clientY - rect.top };
  };

  const stopInteraction = () => {
    if (interactionIntervalRef.current) {
      clearInterval(interactionIntervalRef.current);
      interactionIntervalRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => startInteraction(e.clientX, e.clientY)}
      onMouseMove={(e) => updateInteraction(e.clientX, e.clientY)}
      onMouseUp={stopInteraction}
      onTouchStart={(e) => startInteraction(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => updateInteraction(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={stopInteraction}
      onTouchCancel={stopInteraction}
      className={`relative min-h-screen w-full max-w-screen overflow-x-hidden flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden ${showRainbow ? 'bg-rainbow' : 'bg-bg-light dark:bg-bg-dark'} text-text-main-light dark:text-text-main-dark`}
      style={{ touchAction: 'none' }}
    >
      {/* High-Performance Canvas for Particles */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 pointer-events-none z-5"
      />

      {/* Rainbow Easter Egg */}
      {showRainbow ? (
        <>
          <div className="absolute inset-0 bg-white animate-flashRainbow z-40 pointer-events-none" />
          <div className="absolute top-10 w-full text-4xl sm:text-6xl z-50 pointer-events-none whitespace-nowrap overflow-hidden animate-marquee-fast">
            🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈🌈
          </div>
          <div className="absolute inset-0 z-40 pointer-events-none">
                      {Array.from({ length: 20 }).map((_, i) => {
                        // Generate random values for maximum chaos
                        const randomDuration = Math.random() * 3 + 2; // Speed between 2s and 5s
                        const randomDelay = Math.random() * -5; // Negative delay so they start instantly out-of-sync
                        const randomDirection = Math.random() > 0.5 ? 'alternate' : 'alternate-reverse';

                        return (
                          <div 
                            key={i} 
                            className="absolute animate-float"
                            style={{ 
                              left: `${Math.random() * 100}%`, 
                              top: `${Math.random() * 100}%`, 
                              fontSize: `${Math.random() * 30 + 20}px`,
                              animationDuration: `${randomDuration}s`,
                              animationDelay: `${randomDelay}s`,
                              animationDirection: randomDirection
                            }}
                          >
                            🌈
                          </div>
                        );
                      })}
                    </div>
        </>
      ) : null}

      <audio ref={audioRef} src="/sounds/grunt_party.mp3" preload="auto" />
      
      {/* Cherry Blossom Animation - Rendered permanently, hidden via CSS to bypass compiler bugs */}
        <div className={showGame ? 'hidden' : 'pointer-events-none absolute inset-0 z-10'}>
          <CherryBlossomAnimation />
        </div>

      {/* Idle Bot - Rendered permanently, hidden via CSS */}
      <div className={showGame || idleBotState.status === 'hidden' ? 'hidden' : ''}>
        <div
          className={`idle-character ${idleBotState.status === 'visible' ? 'visible' : ''} ${idleBotState.status === 'hiding' ? 'hiding' : ''}`}
          style={{ top: `${idleBotState.top}px`, left: `${idleBotState.left}px`, zIndex: 15 }}
          aria-hidden="true"
        >
          <Bot className="w-10 h-10 text-text-main-light dark:text-text-main-dark" />
        </div>
      </div>

      {/* Main Content */}
      {showGame ? (
        <div className="w-full h-full flex items-center justify-center cursor-default z-20">
          <div className="rotate-landscape-wrapper"> 
            <JumpGame onExit={() => setShowGame(false)} gameTheme={theme === 'dark' ? 'night' : 'day'} />
          </div>
        </div>
      ) : (
        <>
          <h1
            onClick={() => setShowGame(true)}
            className="select-none text-4xl sm:text-6xl font-bold mb-6 sm:mb-12 text-center text-transparent bg-clip-text bg-linear-to-r from-pastel-pink via-pastel-purple to-pastel-blue text-shadow z-20 cursor-pointer"
            style={{ cursor: 'url(/cursors/keyblade-slash.png) 45 5, auto' }}
          >
            Cortaku
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-xl w-full z-20 relative mobile-card-stack">
            {apps.map((app, index) => (
              <div className="scale-90 sm:scale-100 transition-transform" key={app.title}>
                <AppCard {...app} ref={el => { cardRefs.current[index] = el; }} />
              </div>
            ))}
          </div>

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
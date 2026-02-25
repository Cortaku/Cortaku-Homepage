// src/components/CherryBlossomAnimation.tsx
'use client';

import React, { useEffect, useState } from 'react';

interface BlossomData {
  id: number;
  left: string;
  delay: string;
  duration: string;
}

const CherryBlossomAnimation = () => {
  const [blossoms, setBlossoms] = useState<BlossomData[]>([]);
  const numBlossoms = 20;

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).disableBlossoms) return;

    const generatedData: BlossomData[] = Array.from({ length: numBlossoms }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}vw`,
      delay: `${Math.random() * 10}s`,
      duration: `${6 + Math.random() * 6}s`,
    }));

    setBlossoms(generatedData);
  }, []);

  return (
    <div className="blossom-container" aria-hidden="true">
      {blossoms.map((b) => (
        <div 
          key={b.id} 
          className="blossom" 
          style={{
            '--left': b.left,
            '--delay': b.delay,
            '--duration': b.duration,
          } as React.CSSProperties} 
        />
      ))}
    </div>
  );
};

export default CherryBlossomAnimation;
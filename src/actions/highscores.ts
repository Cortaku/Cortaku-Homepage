// src/actions/highscores.ts
'use server';

import { Pool } from 'pg';
import { headers } from 'next/headers'; 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- IN-MEMORY RATE LIMITER ---
// This map stores the IP address, how many times they've submitted, and when they started.
const rateLimitMap = new Map<string, { count: number; firstRequestTime: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute in milliseconds
const MAX_SCORES_PER_WINDOW = 5; // Maximum 5 scores allowed per minute

export async function getTopScores() {
  try {
    const result = await pool.query(
      'SELECT id, player_name, score FROM high_scores ORDER BY score DESC LIMIT 10'
    );
    return result.rows;
  } catch (error) {
    console.error('Failed to fetch high scores:', error);
    return [];
  }
}

export async function saveHighScore(playerName: string, score: number) {
  try {
    const headersList = await headers();
    
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    
    let ipAddress = 'Unknown';
    if (forwardedFor) {
      ipAddress = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ipAddress = realIp.trim();
    }

    // --- RATE LIMIT CHECK ---
    if (ipAddress !== 'Unknown') {
      const now = Date.now();
      const userRateData = rateLimitMap.get(ipAddress) || { count: 0, firstRequestTime: now };

      // Check if the 1-minute window has passed
      if (now - userRateData.firstRequestTime > WINDOW_MS) {
        // Time expired! Reset their counter to 1
        userRateData.count = 1;
        userRateData.firstRequestTime = now;
      } else {
        // They are still inside the 1-minute window
        userRateData.count++;
        
        if (userRateData.count > MAX_SCORES_PER_WINDOW) {
          console.warn(`🛑 Rate limit hit! Blocked spam from IP: ${ipAddress}`);
          // Return an error object immediately. The database insert is skipped!
          return { success: false, error: 'Too many submissions. Please wait a minute.' };
        }
      }
      // Save their updated record back into the Map
      rateLimitMap.set(ipAddress, userRateData);
    }

    // If they passed the rate limit check, save to Postgres!
    await pool.query(
      'INSERT INTO high_scores (player_name, score, ip_address) VALUES ($1, $2, $3)',
      [playerName, score, ipAddress]
    );
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save high score:', error);
    return { success: false };
  }
}
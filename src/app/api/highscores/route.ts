// src/app/api/highscores/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { headers } from 'next/headers';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// In-Memory Rate Limiter
const rateLimitMap = new Map<string, { count: number; firstRequestTime: number }>();
const WINDOW_MS = 60 * 1000; 
const MAX_SCORES_PER_WINDOW = 5;

// --- CORS HEADERS ---
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.cortaku.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle Pre-flight CORS requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Handle GET: Fetch Top Scores
export async function GET() {
  try {
    const result = await pool.query('SELECT id, player_name, score FROM high_scores ORDER BY score DESC LIMIT 10');
    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (error) {
    console.error('API GET Error:', error);
    return NextResponse.json([], { status: 500, headers: corsHeaders });
  }
}

// Handle POST: Save New Score
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerName, score } = body;
    
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    
    let ipAddress = 'Unknown';
    if (forwardedFor) ipAddress = forwardedFor.split(',')[0].trim();
    else if (realIp) ipAddress = realIp.trim();

    // Rate Limit Check
    if (ipAddress !== 'Unknown') {
      const now = Date.now();
      const userRateData = rateLimitMap.get(ipAddress) || { count: 0, firstRequestTime: now };

      if (now - userRateData.firstRequestTime > WINDOW_MS) {
        userRateData.count = 1;
        userRateData.firstRequestTime = now;
      } else {
        userRateData.count++;
        if (userRateData.count > MAX_SCORES_PER_WINDOW) {
          return NextResponse.json({ success: false, error: 'Rate limit exceeded.' }, { status: 429, headers: corsHeaders });
        }
      }
      rateLimitMap.set(ipAddress, userRateData);
    }

    await pool.query(
      'INSERT INTO high_scores (player_name, score, ip_address) VALUES ($1, $2, $3)',
      [playerName, score, ipAddress]
    );
    
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('API POST Error:', error);
    return NextResponse.json({ success: false }, { status: 500, headers: corsHeaders });
  }
}
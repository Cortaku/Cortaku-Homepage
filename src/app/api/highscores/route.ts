// src/app/api/highscores/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { headers } from 'next/headers';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const rateLimitMap = new Map<string, { count: number; firstRequestTime: number }>();
const WINDOW_MS = 60 * 1000; 
const MAX_SCORES_PER_WINDOW = 5;

// --- 1. NEW DYNAMIC CORS WHITELIST ---
const ALLOWED_ORIGINS = [
  'https://www.cortaku.com',
  'https://cortaku.com',
  'http://localhost:3000'
];

function getCorsHeaders(requestOrigin: string | null) {
  // Check if the request is coming from an approved URL
  const originToAllow = ALLOWED_ORIGINS.includes(requestOrigin || '') 
    ? requestOrigin 
    : 'https://www.cortaku.com'; // Default fallback

  return {
    'Access-Control-Allow-Origin': originToAllow as string,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// --- 2. UPDATE PRE-FLIGHT OPTIONS ---
export async function OPTIONS(request: Request) {
  const requestOrigin = request.headers.get('origin');
  return NextResponse.json({}, { headers: getCorsHeaders(requestOrigin) });
}

// --- 3. UPDATE GET ---
export async function GET(request: Request) {
  const requestOrigin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(requestOrigin);

  try {
    const result = await pool.query('SELECT id, player_name, score FROM high_scores ORDER BY score DESC LIMIT 10');
    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (error) {
    console.error('API GET Error:', error);
    return NextResponse.json([], { status: 500, headers: corsHeaders });
  }
}

// --- 4. UPDATE POST ---
export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(requestOrigin);

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
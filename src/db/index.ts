import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Function to create a new connection pool.
export const createPool = () => {
  // Jika dideploy ke Vercel/Cloud menggunakan string koneksi DATABASE_URL (seperti Neon/Supabase)
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Mengizinkan koneksi SSL self-signed/cloud database
      },
      connectionTimeoutMillis: 15000,
    });
  }

  // Fallback ke variabel individual (biasanya digunakan di Google Cloud / AI Studio lokal)
  const isLocalOrSocket = !process.env.SQL_HOST || 
                          process.env.SQL_HOST.includes('localhost') || 
                          process.env.SQL_HOST.includes('127.0.0.1') ||
                          process.env.SQL_HOST.startsWith('/');

  return new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
    ssl: isLocalOrSocket ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
};

// Create a pool instance.
const pool = createPool();

// Prevent unhandled pool-level errors from crashing the application
pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });

// Helper to ensure PostGIS is installed
export async function ensurePostGIS() {
  try {
    const client = await pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('PostGIS extension checked/created successfully.');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to verify/install PostGIS extension:', error);
  }
}

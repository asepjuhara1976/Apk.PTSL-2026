import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { sql, eq, and, or, isNull } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { db, ensurePostGIS } from './src/db/index.ts';
import { users, assets } from './src/db/schema.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';

// Helper to convert GeoJSON coordinates to Well-Known Text (WKT)
function getWKT(type: string, coordinates: any): string | null {
  try {
    if (type === 'Point') {
      const lat = parseFloat(coordinates.lat);
      const lng = parseFloat(coordinates.lng);
      if (isNaN(lat) || isNaN(lng)) return null;
      return `POINT(${lng} ${lat})`;
    }
    if (type === 'LineString') {
      if (!Array.isArray(coordinates)) return null;
      const pts = coordinates
        .map((c: any) => {
          const lat = parseFloat(c.lat);
          const lng = parseFloat(c.lng);
          return isNaN(lat) || isNaN(lng) ? null : `${lng} ${lat}`;
        })
        .filter(Boolean);
      if (pts.length < 2) return null;
      return `LINESTRING(${pts.join(', ')})`;
    }
    if (type === 'Polygon') {
      if (!Array.isArray(coordinates) || coordinates.length === 0) return null;
      const pts = coordinates
        .map((c: any) => {
          const lat = parseFloat(c.lat);
          const lng = parseFloat(c.lng);
          return isNaN(lat) || isNaN(lng) ? null : `${lng} ${lat}`;
        })
        .filter(Boolean);
      
      if (pts.length < 3) return null;
      
      // Ensure the polygon is closed
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (first !== last) {
        pts.push(first);
      }
      return `POLYGON((${pts.join(', ')}))`;
    }
  } catch (e) {
    console.error('Error generating WKT:', e);
  }
  return null;
}

async function startServer() {
  // Ensure PostGIS extension is installed on database startup
  await ensurePostGIS();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  // Custom Username and Password Login Route
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username dan password wajib diisi' });
      }

      const cleanUsername = username.toLowerCase().trim();
      
      // =================================================================
      // KONFIGURASI AKUN LOGIN (UBAH USER & PASSWORD DI SINI)
      // File: /server.ts
      // =================================================================
      const ACCOUNTS: { [key: string]: string } = {
        'admin': 'admin123',      // Username: admin, Password: admin123
        'ptsl': 'ptsl2026',        // Username: ptsl, Password: ptsl2026
        'petugas': 'petugas123'    // Username: petugas, Password: petugas123
      };
      // =================================================================

      // Periksa apakah username terdaftar
      if (!ACCOUNTS[cleanUsername]) {
        return res.status(401).json({ error: 'Username tidak terdaftar' });
      }

      // Periksa kecocokan password
      if (password !== ACCOUNTS[cleanUsername]) {
        return res.status(401).json({ error: 'Password salah' });
      }

      const uid = 'custom_' + cleanUsername;
      const email = `${cleanUsername}@ptsl.id`;
      
      // Sync user to relational database so assets can belong to this user
      let dbUser = null;
      try {
        dbUser = await getOrCreateUser(uid, email);
      } catch (dbError: any) {
        console.error('Warning: Database sync failed during custom login, continuing anyway:', dbError);
      }
      
      return res.json({
        status: 'success',
        token: uid,
        user: {
          uid,
          email,
          emailVerified: true,
          displayName: username,
        }
      });
    } catch (error: any) {
      console.error('Error in custom login:', error);
      return res.status(500).json({ error: error.message || 'Gagal login' });
    }
  });

  // 1. Sync Firebase User to Relational Database
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { email, uid } = req.user!;
      if (!email || !uid) {
        return res.status(400).json({ error: 'Invalid user session' });
      }
      const syncedUser = await getOrCreateUser(uid, email);
      return res.json({ status: 'success', user: syncedUser });
    } catch (error: any) {
      console.error('Error syncing user:', error);
      return res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // 2. Fetch Assets with Optional Spatial Queries (Bounding Box or Radius)
  app.get('/api/assets', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { bbox, lat, lng, radius } = req.query;
      let userDbId: number | null = null;

      // If user is authenticated, find their relational DB id
      if (req.user) {
        const u = await db.select().from(users).where(eq(users.uid, req.user.uid)).limit(1);
        if (u.length > 0) {
          userDbId = u[0].id;
        }
      }

      // Base query: Retrieve all public/guest assets OR assets owned by the logged-in user
      let conditions = userDbId 
        ? or(isNull(assets.userId), eq(assets.userId, userDbId)) 
        : isNull(assets.userId);

      // Apply PostGIS Spatial Filters if requested
      if (bbox) {
        // Bbox filter format: minLng,minLat,maxLng,maxLat
        const parts = (bbox as string).split(',').map(Number);
        if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
          const [minLng, minLat, maxLng, maxLat] = parts;
          conditions = and(
            conditions,
            sql`ST_Intersects(geom, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`
          );
        }
      } else if (lat && lng) {
        // Radius search (default 50km if not specified)
        const centerLat = parseFloat(lat as string);
        const centerLng = parseFloat(lng as string);
        const searchRadius = parseFloat(radius as string) || 50000; // in meters

        if (!isNaN(centerLat) && !isNaN(centerLng)) {
          conditions = and(
            conditions,
            sql`ST_DWithin(geom, ST_SetSRID(ST_Point(${centerLng}, ${centerLat}), 4326)::geography, ${searchRadius})`
          );
        }
      }

      const results = await db
        .select({
          id: assets.id,
          userId: assets.userId,
          name: assets.name,
          description: assets.description,
          type: assets.type,
          coordinates: assets.coordinates,
          properties: assets.properties,
          createdAt: assets.createdAt,
          updatedAt: assets.updatedAt,
          // Calculate distance using PostGIS if coordinate is supplied
          distance: lat && lng 
            ? sql<number>`ST_Distance(geom, ST_SetSRID(ST_Point(${parseFloat(lng as string)}, ${parseFloat(lat as string)}), 4326)::geography)`
            : sql<null>`NULL`,
        })
        .from(assets)
        .where(conditions)
        .orderBy(lat && lng ? sql`ST_Distance(geom, ST_SetSRID(ST_Point(${parseFloat(lng as string)}, ${parseFloat(lat as string)}), 4326)::geography) ASC` : assets.updatedAt);

      return res.json(results);
    } catch (error: any) {
      console.error('Error fetching assets:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch assets' });
    }
  });

  // 3. Create single Geospatial Asset
  app.post('/api/assets', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { name, description, type, coordinates, properties } = req.body;
      if (!name || !type || !coordinates) {
        return res.status(400).json({ error: 'Missing required asset fields' });
      }

      let userDbId: number | null = null;
      if (req.user) {
        const u = await db.select().from(users).where(eq(users.uid, req.user.uid)).limit(1);
        if (u.length > 0) {
          userDbId = u[0].id;
        }
      }

      const wkt = getWKT(type, coordinates);
      if (!wkt) {
        return res.status(400).json({ error: 'Invalid coordinate values for the specified type' });
      }

      const newAsset = await db.insert(assets)
        .values({
          name,
          description: description || '',
          type,
          coordinates,
          properties: properties || {},
          userId: userDbId,
          geom: sql`ST_GeomFromText(${wkt}, 4326)`,
        })
        .returning({
          id: assets.id,
          userId: assets.userId,
          name: assets.name,
          description: assets.description,
          type: assets.type,
          coordinates: assets.coordinates,
          properties: assets.properties,
          createdAt: assets.createdAt,
        });

      return res.status(201).json(newAsset[0]);
    } catch (error: any) {
      console.error('Error creating asset:', error);
      return res.status(500).json({ error: error.message || 'Failed to create asset' });
    }
  });

  // 4. Bulk Create Geospatial Assets (KML Batch import)
  app.post('/api/assets/bulk', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing or empty items list' });
      }

      let userDbId: number | null = null;
      if (req.user) {
        const u = await db.select().from(users).where(eq(users.uid, req.user.uid)).limit(1);
        if (u.length > 0) {
          userDbId = u[0].id;
        }
      }

      // Filter and construct rows
      const rowsToInsert = items
        .map((item: any) => {
          const wkt = getWKT(item.type, item.coordinates);
          if (!wkt) return null;

          return {
            name: item.name || 'Unnamed Asset',
            description: item.description || '',
            type: item.type,
            coordinates: item.coordinates,
            properties: item.properties || {},
            userId: userDbId,
            geom: sql`ST_GeomFromText(${wkt}, 4326)`,
          };
        })
        .filter(Boolean);

      if (rowsToInsert.length === 0) {
        return res.status(400).json({ error: 'No valid geometries found to import' });
      }

      const inserted = await db.insert(assets)
        .values(rowsToInsert as any)
        .returning({
          id: assets.id,
          name: assets.name,
          type: assets.type,
        });

      return res.status(201).json({ count: inserted.length, items: inserted });
    } catch (error: any) {
      console.error('Error in bulk import:', error);
      return res.status(500).json({ error: error.message || 'Failed to complete bulk import' });
    }
  });

  // 5. Update Geospatial Asset (supports geometry modification)
  app.put('/api/assets/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const assetId = parseInt(req.params.id);
      if (isNaN(assetId)) {
        return res.status(400).json({ error: 'Invalid asset ID' });
      }

      const { name, description, type, coordinates, properties } = req.body;

      // Check current asset ownership
      const existing = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      let userDbId: number | null = null;
      if (req.user) {
        const u = await db.select().from(users).where(eq(users.uid, req.user.uid)).limit(1);
        if (u.length > 0) {
          userDbId = u[0].id;
        }
      }

      // Check permissions: if asset is owned, verify owner
      if (existing[0].userId !== null && existing[0].userId !== userDbId) {
        return res.status(403).json({ error: 'Unauthorized: You do not own this asset' });
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (properties !== undefined) updateData.properties = properties;

      if (type !== undefined && coordinates !== undefined) {
        const wkt = getWKT(type, coordinates);
        if (!wkt) {
          return res.status(400).json({ error: 'Invalid coordinates for updated type' });
        }
        updateData.type = type;
        updateData.coordinates = coordinates;
        updateData.geom = sql`ST_GeomFromText(${wkt}, 4326)`;
      }

      const updated = await db.update(assets)
        .set(updateData)
        .where(eq(assets.id, assetId))
        .returning({
          id: assets.id,
          userId: assets.userId,
          name: assets.name,
          description: assets.description,
          type: assets.type,
          coordinates: assets.coordinates,
          properties: assets.properties,
          updatedAt: assets.updatedAt,
        });

      return res.json(updated[0]);
    } catch (error: any) {
      console.error('Error updating asset:', error);
      return res.status(500).json({ error: error.message || 'Failed to update asset' });
    }
  });

  // 6. Delete Geospatial Asset
  app.delete('/api/assets/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const assetId = parseInt(req.params.id);
      if (isNaN(assetId)) {
        return res.status(400).json({ error: 'Invalid asset ID' });
      }

      // Check current asset
      const existing = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      let userDbId: number | null = null;
      if (req.user) {
        const u = await db.select().from(users).where(eq(users.uid, req.user.uid)).limit(1);
        if (u.length > 0) {
          userDbId = u[0].id;
        }
      }

      // Check permissions
      if (existing[0].userId !== null && existing[0].userId !== userDbId) {
        return res.status(403).json({ error: 'Unauthorized: You do not own this asset' });
      }

      await db.delete(assets).where(eq(assets.id, assetId));
      return res.json({ success: true, message: 'Asset deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete asset' });
    }
  });

  // Vite integration for asset rendering or static files routing
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();

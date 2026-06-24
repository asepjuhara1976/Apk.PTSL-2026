import { pgTable, serial, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

// Custom Drizzle type for PostGIS geometry column
export const postgisGeometry = customType<{ data: string }>({
  dataType() {
    return 'geometry(Geometry, 4326)'; // WGS 84 coordinate system
  },
  toDriver(value: string) {
    return value; // Expected to be in WKT (Well-Known Text) format, e.g. "POINT(lng lat)" or similar
  },
  fromDriver(value: unknown) {
    return typeof value === 'string' ? value : '';
  }
});

// Users Table (synchronized from Firebase Auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Assets Table (Geospatial layers/objects)
export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'Point', 'LineString', 'Polygon'
  coordinates: jsonb('coordinates').notNull(), // JSON representation for direct client rendering: [{lat, lng}, ...] or {lat, lng}
  properties: jsonb('properties').default({}), // Visual style props: color, fillColor, strokeWidth, opacity, etc.
  geom: postgisGeometry('geom'), // PostGIS Geometry column
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  user: one(users, {
    fields: [assets.userId],
    references: [users.id],
  }),
}));

import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  address: text('address').notNull().default(''),
  role: text('role').notNull().default('USER'), // 'USER' | 'STORE_OWNER' | 'SYSTEM_ADMIN'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  email: text('email').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  description: text('description').notNull(),
  coverImage: text('cover_image').notNull(),
  ownerId: integer('owner_id').references(() => users.id, { onDelete: 'set null' }),
  isVerified: boolean('is_verified').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id, { onDelete: 'cascade' })
    .notNull(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  materialSpec: text('material_spec').notNull(),
  dimensions: text('dimensions').notNull(),
  priceCents: integer('price_cents').notNull(),
  stock: integer('stock').notNull().default(10),
  imageUrl: text('image_url').notNull(),
  variantLabel: text('variant_label').notNull().default('Standard Edition'),
  featured: boolean('featured').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ratings = pgTable(
  'ratings',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    storeId: integer('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    score: integer('score').notNull(),
    comment: text('comment').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('ratings_user_store_unique').on(table.userId, table.storeId)]
);

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  phone: text('phone').notNull(),
  shippingAddress: text('shipping_address').notNull(),
  postalCode: text('postal_code').notNull(),
  paymentMethod: text('payment_method').notNull().default('COD'), // 'COD' | 'BANK_TRANSFER' | 'CARD_ON_DELIVERY'
  status: text('status').notNull().default('CONFIRMED'), // 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  subtotalCents: integer('subtotal_cents').notNull(),
  shippingCents: integer('shipping_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'restrict' })
    .notNull(),
  storeId: integer('store_id')
    .references(() => stores.id, { onDelete: 'restrict' })
    .notNull(),
  productName: text('product_name').notNull(),
  storeName: text('store_name').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  quantity: integer('quantity').notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  stores: many(stores),
  ratings: many(ratings),
  orders: many(orders),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  owner: one(users, {
    fields: [stores.ownerId],
    references: [users.id],
  }),
  products: many(products),
  ratings: many(ratings),
}));

export const productsRelations = relations(products, ({ one }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  user: one(users, {
    fields: [ratings.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [ratings.storeId],
    references: [stores.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  store: one(stores, {
    fields: [orderItems.storeId],
    references: [stores.id],
  }),
}));

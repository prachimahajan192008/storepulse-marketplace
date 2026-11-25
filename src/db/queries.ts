import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { orderItems, orders, products, ratings, stores, users } from './schema.ts';

export type UserRecord = typeof users.$inferSelect;
export type UserRole = 'USER' | 'STORE_OWNER' | 'SYSTEM_ADMIN';
export type OrderStatus = 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'CARD_ON_DELIVERY';

const BOOTSTRAP_ADMIN_EMAIL = 'prachimahajan192008@gmail.com';
const FREE_SHIPPING_THRESHOLD_CENTS = 15000;
const FLAT_SHIPPING_CENTS = 1400;

export async function getOrCreateUser(input: {
  uid: string;
  email: string;
  name: string;
}): Promise<UserRecord> {
  try {
    const normalizedEmail = input.email.trim().toLowerCase();
    const isBootstrapAdmin = normalizedEmail === BOOTSTRAP_ADMIN_EMAIL;

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, input.uid))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      if (isBootstrapAdmin && current.role !== 'SYSTEM_ADMIN') {
        const updated = await db
          .update(users)
          .set({ role: 'SYSTEM_ADMIN', email: normalizedEmail })
          .where(eq(users.id, current.id))
          .returning();
        return updated[0];
      }
      return current;
    }

    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail.length > 0) {
      const updated = await db
        .update(users)
        .set({
          uid: input.uid,
          name: input.name.trim() || existingByEmail[0].name,
          role: isBootstrapAdmin ? 'SYSTEM_ADMIN' : existingByEmail[0].role,
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(users)
      .values({
        uid: input.uid,
        email: normalizedEmail,
        name: input.name.trim() || 'StorePulse Member',
        address: '',
        role: isBootstrapAdmin ? 'SYSTEM_ADMIN' : 'USER',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          ...(isBootstrapAdmin ? { role: 'SYSTEM_ADMIN' } : {}),
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Unable to synchronize account profile right now.', { cause: error });
  }
}

export async function updateUserProfile(
  userId: number,
  updates: { name?: string; address?: string }
): Promise<UserRecord> {
  try {
    const payload: Partial<typeof users.$inferInsert> = {};
    if (typeof updates.name === 'string' && updates.name.trim().length >= 2) {
      payload.name = updates.name.trim().slice(0, 80);
    }
    if (typeof updates.address === 'string') {
      payload.address = updates.address.trim().slice(0, 400);
    }
    const result = await db
      .update(users)
      .set(payload)
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in updateUserProfile:', error);
    throw new Error('Unable to update profile details right now.', { cause: error });
  }
}

export async function getCatalogData(currentUserId?: number) {
  try {
    const [allStores, allProducts, allRatings, allUsers] = await Promise.all([
      db.select().from(stores).orderBy(stores.id),
      db.select().from(products).where(eq(products.isActive, true)).orderBy(products.id),
      db.select().from(ratings).orderBy(desc(ratings.updatedAt)),
      db.select({ id: users.id, name: users.name }).from(users),
    ]);

    const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

    const ratingsByStore = new Map<
      number,
      Array<{
        id: number;
        userId: number;
        userName: string;
        score: number;
        comment: string;
        updatedAt: Date;
      }>
    >();

    for (const r of allRatings) {
      const list = ratingsByStore.get(r.storeId) || [];
      list.push({
        id: r.id,
        userId: r.userId,
        userName: userMap.get(r.userId) || 'Verified Customer',
        score: r.score,
        comment: r.comment,
        updatedAt: r.updatedAt,
      });
      ratingsByStore.set(r.storeId, list);
    }

    const enrichedStores = allStores.map((store) => {
      const storeRatings = ratingsByStore.get(store.id) || [];
      const ratingCount = storeRatings.length;
      const averageRating =
        ratingCount > 0
          ? Number(
              (
                storeRatings.reduce((sum, item) => sum + item.score, 0) / ratingCount
              ).toFixed(2)
            )
          : 0;
      const userRating = currentUserId
        ? storeRatings.find((r) => r.userId === currentUserId) || null
        : null;

      return {
        ...store,
        ownerName: store.ownerId ? userMap.get(store.ownerId) || 'Independent Atelier' : 'Independent Atelier',
        averageRating,
        ratingCount,
        userRating: userRating
          ? { score: userRating.score, comment: userRating.comment }
          : null,
        recentReviews: storeRatings.slice(0, 6),
      };
    });

    const storeLookup = new Map(enrichedStores.map((s) => [s.id, s]));

    const enrichedProducts = allProducts.map((product) => {
      const parentStore = storeLookup.get(product.storeId);
      return {
        ...product,
        storeName: parentStore?.name || 'Verified Store',
        storeCity: parentStore?.city || '',
        storeRating: parentStore?.averageRating || 0,
        storeRatingCount: parentStore?.ratingCount || 0,
      };
    });

    const totalRatingsCount = allRatings.length;
    const platformAverageRating =
      totalRatingsCount > 0
        ? Number(
            (allRatings.reduce((acc, r) => acc + r.score, 0) / totalRatingsCount).toFixed(2)
          )
        : 0;

    return {
      stores: enrichedStores,
      products: enrichedProducts,
      summary: {
        storeCount: enrichedStores.length,
        productCount: enrichedProducts.length,
        ratingCount: totalRatingsCount,
        platformAverageRating,
      },
    };
  } catch (error) {
    console.error('Database query failed in getCatalogData:', error);
    throw new Error('Unable to load marketplace catalog right now.', { cause: error });
  }
}

export async function upsertStoreRating(input: {
  userId: number;
  storeId: number;
  score: number;
  comment: string;
}) {
  try {
    const storeExists = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.id, input.storeId))
      .limit(1);

    if (storeExists.length === 0) {
      throw new Error('STORE_NOT_FOUND');
    }

    const result = await db
      .insert(ratings)
      .values({
        userId: input.userId,
        storeId: input.storeId,
        score: input.score,
        comment: input.comment.trim().slice(0, 500),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [ratings.userId, ratings.storeId],
        set: {
          score: input.score,
          comment: input.comment.trim().slice(0, 500),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    if (error instanceof Error && error.message === 'STORE_NOT_FOUND') {
      throw error;
    }
    console.error('Database query failed in upsertStoreRating:', error);
    throw new Error('Unable to save store rating right now.', { cause: error });
  }
}

export async function createOrderTransaction(input: {
  userId: number;
  customerName: string;
  customerEmail: string;
  phone: string;
  shippingAddress: string;
  postalCode: string;
  paymentMethod: PaymentMethod;
  items: Array<{ productId: number; quantity: number }>;
}) {
  try {
    return await db.transaction(async (tx) => {
      const productIds = [...new Set(input.items.map((i) => i.productId))];
      const dbProducts = await tx
        .select()
        .from(products)
        .where(and(inArray(products.id, productIds), eq(products.isActive, true)));

      if (dbProducts.length !== productIds.length) {
        throw new Error('PRODUCT_UNAVAILABLE');
      }

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));
      const storeIds = [...new Set(dbProducts.map((p) => p.storeId))];
      const dbStores = await tx
        .select({ id: stores.id, name: stores.name })
        .from(stores)
        .where(inArray(stores.id, storeIds));
      const storeMap = new Map(dbStores.map((s) => [s.id, s.name]));

      let subtotalCents = 0;
      const verifiedLines: Array<{
        productId: number;
        storeId: number;
        productName: string;
        storeName: string;
        unitPriceCents: number;
        quantity: number;
      }> = [];

      for (const reqItem of input.items) {
        const product = productMap.get(reqItem.productId);
        if (!product) {
          throw new Error('PRODUCT_UNAVAILABLE');
        }
        if (product.stock < reqItem.quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        // Atomic stock decrement guarded by stock >= quantity
        const updatedProduct = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${reqItem.quantity}` })
          .where(and(eq(products.id, product.id), sql`${products.stock} >= ${reqItem.quantity}`))
          .returning({ id: products.id });

        if (updatedProduct.length === 0) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        subtotalCents += product.priceCents * reqItem.quantity;
        verifiedLines.push({
          productId: product.id,
          storeId: product.storeId,
          productName: product.name,
          storeName: storeMap.get(product.storeId) || 'Verified Store',
          unitPriceCents: product.priceCents,
          quantity: reqItem.quantity,
        });
      }

      const shippingCents =
        subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
      const totalCents = subtotalCents + shippingCents;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `SP-${Date.now().toString().slice(-4)}${randomSuffix.toString().slice(-2)}`;

      const [createdOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: input.userId,
          customerName: input.customerName.trim().slice(0, 100),
          customerEmail: input.customerEmail.trim().slice(0, 120),
          phone: input.phone.trim().slice(0, 40),
          shippingAddress: input.shippingAddress.trim().slice(0, 400),
          postalCode: input.postalCode.trim().slice(0, 24),
          paymentMethod: input.paymentMethod,
          status: 'CONFIRMED',
          subtotalCents,
          shippingCents,
          totalCents,
        })
        .returning();

      const insertedItems = await tx
        .insert(orderItems)
        .values(
          verifiedLines.map((line) => ({
            orderId: createdOrder.id,
            ...line,
          }))
        )
        .returning();

      return {
        ...createdOrder,
        items: insertedItems,
      };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'PRODUCT_UNAVAILABLE' || error.message.startsWith('INSUFFICIENT_STOCK:'))
    ) {
      throw error;
    }
    console.error('Database query failed in createOrderTransaction:', error);
    throw new Error('Unable to complete order right now. Please try again.', { cause: error });
  }
}

export async function getUserOrders(userId: number) {
  try {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    if (userOrders.length === 0) return [];

    const ids = userOrders.map((o) => o.id);
    const items = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, ids));

    const itemsByOrder = new Map<number, typeof items>();
    for (const item of items) {
      const list = itemsByOrder.get(item.orderId) || [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    return userOrders.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) || [],
    }));
  } catch (error) {
    console.error('Database query failed in getUserOrders:', error);
    throw new Error('Unable to load your order history right now.', { cause: error });
  }
}

export async function getMerchantOverview(dbUser: UserRecord) {
  try {
    const ownedStores =
      dbUser.role === 'SYSTEM_ADMIN'
        ? await db.select().from(stores).orderBy(stores.id)
        : await db.select().from(stores).where(eq(stores.ownerId, dbUser.id)).orderBy(stores.id);

    if (ownedStores.length === 0) {
      return {
        stores: [],
        products: [],
        ratings: [],
        orders: [],
        metrics: {
          averageRating: 0,
          totalReviews: 0,
          totalRevenueCents: 0,
          totalUnitsSold: 0,
          lowStockCount: 0,
        },
      };
    }

    const storeIds = ownedStores.map((s) => s.id);
    const [storeProducts, storeRatings, storeOrderItems, allUsers] = await Promise.all([
      db.select().from(products).where(inArray(products.storeId, storeIds)).orderBy(products.id),
      db
        .select()
        .from(ratings)
        .where(inArray(ratings.storeId, storeIds))
        .orderBy(desc(ratings.updatedAt)),
      db.select().from(orderItems).where(inArray(orderItems.storeId, storeIds)),
      db.select({ id: users.id, name: users.name, email: users.email }).from(users),
    ]);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const storeNameMap = new Map(ownedStores.map((s) => [s.id, s.name]));

    const orderIds = [...new Set(storeOrderItems.map((i) => i.orderId))];
    const relatedOrders =
      orderIds.length > 0
        ? await db
            .select()
            .from(orders)
            .where(inArray(orders.id, orderIds))
            .orderBy(desc(orders.createdAt))
        : [];

    const orderItemsByOrderId = new Map<number, typeof storeOrderItems>();
    for (const item of storeOrderItems) {
      const list = orderItemsByOrderId.get(item.orderId) || [];
      list.push(item);
      orderItemsByOrderId.set(item.orderId, list);
    }

    const totalRevenueCents = storeOrderItems.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0
    );
    const totalUnitsSold = storeOrderItems.reduce((sum, item) => sum + item.quantity, 0);
    const averageRating =
      storeRatings.length > 0
        ? Number(
            (
              storeRatings.reduce((sum, r) => sum + r.score, 0) / storeRatings.length
            ).toFixed(2)
          )
        : 0;
    const lowStockCount = storeProducts.filter((p) => p.isActive && p.stock <= 5).length;

    return {
      stores: ownedStores.map((s) => {
        const sRatings = storeRatings.filter((r) => r.storeId === s.id);
        return {
          ...s,
          ratingCount: sRatings.length,
          averageRating:
            sRatings.length > 0
              ? Number(
                  (sRatings.reduce((acc, r) => acc + r.score, 0) / sRatings.length).toFixed(2)
                )
              : 0,
        };
      }),
      products: storeProducts.map((p) => ({
        ...p,
        storeName: storeNameMap.get(p.storeId) || '',
      })),
      ratings: storeRatings.map((r) => ({
        ...r,
        storeName: storeNameMap.get(r.storeId) || '',
        customerName: userMap.get(r.userId)?.name || 'Verified Customer',
        customerEmail: userMap.get(r.userId)?.email || '',
      })),
      orders: relatedOrders.map((o) => ({
        ...o,
        items: orderItemsByOrderId.get(o.id) || [],
      })),
      metrics: {
        averageRating,
        totalReviews: storeRatings.length,
        totalRevenueCents,
        totalUnitsSold,
        lowStockCount,
      },
    };
  } catch (error) {
    console.error('Database query failed in getMerchantOverview:', error);
    throw new Error('Unable to load merchant portal data right now.', { cause: error });
  }
}

export async function createMerchantProduct(
  dbUser: UserRecord,
  input: {
    storeId: number;
    name: string;
    category: string;
    description: string;
    materialSpec: string;
    dimensions: string;
    priceCents: number;
    stock: number;
    imageUrl: string;
    variantLabel: string;
  }
) {
  try {
    const [targetStore] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, input.storeId))
      .limit(1);

    if (!targetStore) {
      throw new Error('STORE_NOT_FOUND');
    }
    if (dbUser.role !== 'SYSTEM_ADMIN' && targetStore.ownerId !== dbUser.id) {
      throw new Error('FORBIDDEN_STORE');
    }

    const sku = `SP-${targetStore.slug.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const [created] = await db
      .insert(products)
      .values({
        storeId: input.storeId,
        sku,
        name: input.name.trim().slice(0, 100),
        category: input.category.trim().slice(0, 60),
        description: input.description.trim().slice(0, 600),
        materialSpec: input.materialSpec.trim().slice(0, 140),
        dimensions: input.dimensions.trim().slice(0, 100),
        priceCents: input.priceCents,
        stock: input.stock,
        imageUrl: input.imageUrl,
        variantLabel: input.variantLabel.trim().slice(0, 60) || 'Standard Edition',
        featured: false,
        isActive: true,
      })
      .returning();

    return created;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'STORE_NOT_FOUND' || error.message === 'FORBIDDEN_STORE')
    ) {
      throw error;
    }
    console.error('Database query failed in createMerchantProduct:', error);
    throw new Error('Unable to create product right now.', { cause: error });
  }
}

export async function updateMerchantProduct(
  dbUser: UserRecord,
  productId: number,
  updates: {
    priceCents?: number;
    stock?: number;
    isActive?: boolean;
    name?: string;
  }
) {
  try {
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existing) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    const [parentStore] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, existing.storeId))
      .limit(1);

    if (!parentStore || (dbUser.role !== 'SYSTEM_ADMIN' && parentStore.ownerId !== dbUser.id)) {
      throw new Error('FORBIDDEN_STORE');
    }

    const payload: Partial<typeof products.$inferInsert> = {};
    if (typeof updates.priceCents === 'number' && updates.priceCents > 0) {
      payload.priceCents = Math.round(updates.priceCents);
    }
    if (typeof updates.stock === 'number' && updates.stock >= 0) {
      payload.stock = Math.round(updates.stock);
    }
    if (typeof updates.isActive === 'boolean') {
      payload.isActive = updates.isActive;
    }
    if (typeof updates.name === 'string' && updates.name.trim().length >= 2) {
      payload.name = updates.name.trim().slice(0, 100);
    }

    const [updated] = await db
      .update(products)
      .set(payload)
      .where(eq(products.id, productId))
      .returning();

    return updated;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'PRODUCT_NOT_FOUND' || error.message === 'FORBIDDEN_STORE')
    ) {
      throw error;
    }
    console.error('Database query failed in updateMerchantProduct:', error);
    throw new Error('Unable to update product inventory right now.', { cause: error });
  }
}

export async function updateOrderStatus(
  dbUser: UserRecord,
  orderId: number,
  status: OrderStatus
) {
  try {
    if (dbUser.role !== 'SYSTEM_ADMIN') {
      const ownedStores = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.ownerId, dbUser.id));
      const ownedIds = ownedStores.map((s) => s.id);
      if (ownedIds.length === 0) {
        throw new Error('FORBIDDEN_ORDER');
      }
      const matchingItems = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(and(eq(orderItems.orderId, orderId), inArray(orderItems.storeId, ownedIds)))
        .limit(1);
      if (matchingItems.length === 0) {
        throw new Error('FORBIDDEN_ORDER');
      }
    }

    const [updated] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updated) {
      throw new Error('ORDER_NOT_FOUND');
    }

    return updated;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'FORBIDDEN_ORDER' || error.message === 'ORDER_NOT_FOUND')
    ) {
      throw error;
    }
    console.error('Database query failed in updateOrderStatus:', error);
    throw new Error('Unable to update order status right now.', { cause: error });
  }
}

export async function getAdminOverview() {
  try {
    const [allUsers, allStores, allRatings, allOrders, allOrderItems, allProducts] =
      await Promise.all([
        db.select().from(users).orderBy(desc(users.createdAt)),
        db.select().from(stores).orderBy(stores.id),
        db.select().from(ratings),
        db.select().from(orders).orderBy(desc(orders.createdAt)),
        db.select().from(orderItems),
        db.select().from(products),
      ]);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const itemsByOrder = new Map<number, typeof allOrderItems>();
    for (const item of allOrderItems) {
      const list = itemsByOrder.get(item.orderId) || [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    const storeRows = allStores.map((store) => {
      const sRatings = allRatings.filter((r) => r.storeId === store.id);
      const sProducts = allProducts.filter((p) => p.storeId === store.id);
      const avg =
        sRatings.length > 0
          ? Number(
              (sRatings.reduce((acc, r) => acc + r.score, 0) / sRatings.length).toFixed(2)
            )
          : 0;
      const owner = store.ownerId ? userMap.get(store.ownerId) : null;
      return {
        ...store,
        ownerName: owner?.name || 'Unassigned',
        ownerEmail: owner?.email || '',
        averageRating: avg,
        ratingCount: sRatings.length,
        productCount: sProducts.length,
      };
    });

    const userRows = allUsers.map((u) => {
      const owned = storeRows.filter((s) => s.ownerId === u.id);
      const ownedRatingAvg =
        owned.length > 0 && owned.some((s) => s.ratingCount > 0)
          ? Number(
              (
                owned.reduce((acc, s) => acc + s.averageRating, 0) /
                owned.filter((s) => s.ratingCount > 0).length
              ).toFixed(2)
            )
          : null;
      return {
        ...u,
        storeCount: owned.length,
        storeAverageRating: ownedRatingAvg,
      };
    });

    const grossRevenueCents = allOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.totalCents, 0);

    return {
      metrics: {
        totalUsers: allUsers.length,
        totalStores: allStores.length,
        totalRatings: allRatings.length,
        totalOrders: allOrders.length,
        grossRevenueCents,
      },
      users: userRows,
      stores: storeRows,
      orders: allOrders.map((o) => ({
        ...o,
        items: itemsByOrder.get(o.id) || [],
      })),
    };
  } catch (error) {
    console.error('Database query failed in getAdminOverview:', error);
    throw new Error('Unable to load administrator overview right now.', { cause: error });
  }
}

export async function createAdminStore(input: {
  name: string;
  category: string;
  email: string;
  address: string;
  city: string;
  description: string;
  coverImage: string;
  ownerId: number | null;
}) {
  try {
    const baseSlug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const slug = `${baseSlug || 'store'}-${Date.now().toString().slice(-4)}`;

    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(stores)
        .values({
          slug,
          name: input.name.trim().slice(0, 80),
          category: input.category.trim().slice(0, 60),
          email: input.email.trim().toLowerCase().slice(0, 120),
          address: input.address.trim().slice(0, 300),
          city: input.city.trim().slice(0, 80),
          description: input.description.trim().slice(0, 500),
          coverImage: input.coverImage,
          ownerId: input.ownerId,
          isVerified: true,
        })
        .returning();

      if (input.ownerId) {
        const [owner] = await tx
          .select()
          .from(users)
          .where(eq(users.id, input.ownerId))
          .limit(1);
        if (owner && owner.role === 'USER') {
          await tx
            .update(users)
            .set({ role: 'STORE_OWNER' })
            .where(eq(users.id, input.ownerId));
        }
      }

      return created;
    });
  } catch (error) {
    console.error('Database query failed in createAdminStore:', error);
    throw new Error('Unable to register new store right now.', { cause: error });
  }
}

export async function updateAdminUserRole(
  actingAdminId: number,
  targetUserId: number,
  newRole: UserRole
) {
  try {
    if (actingAdminId === targetUserId && newRole !== 'SYSTEM_ADMIN') {
      throw new Error('CANNOT_DEMOTE_SELF');
    }

    const [updated] = await db
      .update(users)
      .set({ role: newRole })
      .where(eq(users.id, targetUserId))
      .returning();

    if (!updated) {
      throw new Error('USER_NOT_FOUND');
    }

    return updated;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'CANNOT_DEMOTE_SELF' || error.message === 'USER_NOT_FOUND')
    ) {
      throw error;
    }
    console.error('Database query failed in updateAdminUserRole:', error);
    throw new Error('Unable to update user role right now.', { cause: error });
  }
}

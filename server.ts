import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createAdminStore,
  createMerchantProduct,
  createOrderTransaction,
  getAdminOverview,
  getCatalogData,
  getMerchantOverview,
  getUserOrders,
  type OrderStatus,
  type PaymentMethod,
  updateAdminUserRole,
  updateMerchantProduct,
  updateOrderStatus,
  updateUserProfile,
  upsertStoreRating,
  type UserRole,
} from './src/db/queries.ts';
import {
  type AuthRequest,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireMerchantOrAdmin,
} from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_ROLES: ReadonlySet<string> = new Set(['USER', 'STORE_OWNER', 'SYSTEM_ADMIN']);
const ALLOWED_STATUSES: ReadonlySet<string> = new Set([
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);
const ALLOWED_PAYMENTS: ReadonlySet<string> = new Set([
  'UPI',
  'COD',
  'BANK_TRANSFER',
  'CARD_ON_DELIVERY',
]);

function isSafeImagePath(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith('/src/assets/images/') ||
    trimmed.startsWith('https://')
  );
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  // Public catalog (enriched with current user's ratings if signed in)
  app.get('/api/catalog', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getCatalogData(req.dbUser?.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to load storefront catalog.',
      });
    }
  });

  // Current authenticated user profile
  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    res.json({ user: req.dbUser });
  });

  app.patch('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, address } = req.body ?? {};
      if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
        return res.status(400).json({ error: 'Name must be at least 2 characters.' });
      }
      if (address !== undefined && typeof address !== 'string') {
        return res.status(400).json({ error: 'Address must be text.' });
      }
      const updated = await updateUserProfile(req.dbUser!.id, { name, address });
      res.json({ user: updated });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to update profile.',
      });
    }
  });

  // Submit or update a verified store rating (1-5)
  app.post('/api/ratings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const storeId = Number(req.body?.storeId);
      const score = Number(req.body?.score);
      const comment = typeof req.body?.comment === 'string' ? req.body.comment : '';

      if (!Number.isInteger(storeId) || storeId <= 0) {
        return res.status(400).json({ error: 'A valid store must be selected.' });
      }
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        return res.status(400).json({ error: 'Rating score must be an integer between 1 and 5.' });
      }

      const saved = await upsertStoreRating({
        userId: req.dbUser!.id,
        storeId,
        score,
        comment,
      });

      res.status(201).json({ rating: saved });
    } catch (error) {
      if (error instanceof Error && error.message === 'STORE_NOT_FOUND') {
        return res.status(404).json({ error: 'Store not found.' });
      }
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to save rating.',
      });
    }
  });

  // Checkout & order creation (server-authoritative pricing and stock validation)
  app.post('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        customerName,
        phone,
        shippingAddress,
        postalCode,
        paymentMethod,
        items,
      } = req.body ?? {};

      if (typeof customerName !== 'string' || customerName.trim().length < 2) {
        return res.status(400).json({ error: 'Please enter a recipient full name.' });
      }
      if (typeof phone !== 'string' || phone.trim().length < 6) {
        return res.status(400).json({ error: 'Please enter a valid contact phone number.' });
      }
      if (typeof shippingAddress !== 'string' || shippingAddress.trim().length < 6) {
        return res.status(400).json({ error: 'Please enter a complete delivery address.' });
      }
      if (typeof postalCode !== 'string' || postalCode.trim().length < 5) {
        return res.status(400).json({ error: 'Please enter a valid 6-digit PIN code.' });
      }
      if (typeof paymentMethod !== 'string' || !ALLOWED_PAYMENTS.has(paymentMethod)) {
        return res.status(400).json({ error: 'Please choose a supported payment option.' });
      }
      if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        return res.status(400).json({ error: 'Your bag is empty.' });
      }

      const normalizedItems: Array<{ productId: number; quantity: number }> = [];
      for (const line of items) {
        const productId = Number(line?.productId);
        const quantity = Number(line?.quantity);
        if (
          !Number.isInteger(productId) ||
          productId <= 0 ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 25
        ) {
          return res.status(400).json({ error: 'Invalid item quantity in bag.' });
        }
        normalizedItems.push({ productId, quantity });
      }

      const order = await createOrderTransaction({
        userId: req.dbUser!.id,
        customerName,
        customerEmail: req.dbUser!.email,
        phone,
        shippingAddress,
        postalCode,
        paymentMethod: paymentMethod as PaymentMethod,
        items: normalizedItems,
      });

      res.status(201).json({ order });
    } catch (error) {
      if (error instanceof Error && error.message === 'PRODUCT_UNAVAILABLE') {
        return res.status(409).json({ error: 'One or more products are no longer available.' });
      }
      if (error instanceof Error && error.message.startsWith('INSUFFICIENT_STOCK:')) {
        const productName = error.message.slice('INSUFFICIENT_STOCK:'.length);
        return res.status(409).json({
          error: `Insufficient stock available for ${productName}. Please adjust quantity.`,
        });
      }
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to place order.',
      });
    }
  });

  app.get('/api/orders/mine', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await getUserOrders(req.dbUser!.id);
      res.json({ orders: list });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to load orders.',
      });
    }
  });

  // Merchant Portal routes
  app.get(
    '/api/merchant/overview',
    requireAuth,
    requireMerchantOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const data = await getMerchantOverview(req.dbUser!);
        res.json(data);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unable to load merchant data.',
        });
      }
    }
  );

  app.post(
    '/api/merchant/products',
    requireAuth,
    requireMerchantOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const {
          storeId,
          name,
          category,
          description,
          materialSpec,
          dimensions,
          priceDollars,
          stock,
          imageUrl,
          variantLabel,
        } = req.body ?? {};

        const numericStoreId = Number(storeId);
        const priceCents = Math.round(Number(priceDollars) * 100);
        const numericStock = Number(stock);

        if (!Number.isInteger(numericStoreId) || numericStoreId <= 0) {
          return res.status(400).json({ error: 'Select a valid store.' });
        }
        if (typeof name !== 'string' || name.trim().length < 2) {
          return res.status(400).json({ error: 'Product name must be at least 2 characters.' });
        }
        if (!Number.isFinite(priceCents) || priceCents < 10000 || priceCents > 500000000) {
          return res.status(400).json({ error: 'Price must be between ₹100 and ₹50,00,000.' });
        }
        if (!Number.isInteger(numericStock) || numericStock < 0 || numericStock > 10000) {
          return res.status(400).json({ error: 'Stock must be a whole number from 0 to 10,000.' });
        }

        const safeImage =
          typeof imageUrl === 'string' && isSafeImagePath(imageUrl)
            ? imageUrl.trim()
            : '/src/assets/images/product_ceramic_pour_over_1795634500617.jpg';

        const created = await createMerchantProduct(req.dbUser!, {
          storeId: numericStoreId,
          name,
          category: typeof category === 'string' && category.trim() ? category : 'Design Objects',
          description:
            typeof description === 'string' && description.trim()
              ? description
              : 'Small-batch studio object crafted by our verified partner workshop.',
          materialSpec:
            typeof materialSpec === 'string' && materialSpec.trim()
              ? materialSpec
              : 'Natural studio-grade materials',
          dimensions:
            typeof dimensions === 'string' && dimensions.trim() ? dimensions : 'Standard studio size',
          priceCents,
          stock: numericStock,
          imageUrl: safeImage,
          variantLabel: typeof variantLabel === 'string' ? variantLabel : 'Standard Edition',
        });

        res.status(201).json({ product: created });
      } catch (error) {
        if (error instanceof Error && error.message === 'FORBIDDEN_STORE') {
          return res.status(403).json({ error: 'You do not manage that store.' });
        }
        if (error instanceof Error && error.message === 'STORE_NOT_FOUND') {
          return res.status(404).json({ error: 'Store not found.' });
        }
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unable to add product.',
        });
      }
    }
  );

  app.patch(
    '/api/merchant/products/:id',
    requireAuth,
    requireMerchantOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const productId = Number(req.params.id);
        if (!Number.isInteger(productId) || productId <= 0) {
          return res.status(400).json({ error: 'Invalid product ID.' });
        }

        const updates: {
          priceCents?: number;
          stock?: number;
          isActive?: boolean;
          name?: string;
        } = {};

        if (req.body?.priceDollars !== undefined) {
          const cents = Math.round(Number(req.body.priceDollars) * 100);
          if (!Number.isFinite(cents) || cents < 10000 || cents > 500000000) {
            return res.status(400).json({ error: 'Price must be between ₹100 and ₹50,00,000.' });
          }
          updates.priceCents = cents;
        }
        if (req.body?.stock !== undefined) {
          const st = Number(req.body.stock);
          if (!Number.isInteger(st) || st < 0 || st > 10000) {
            return res.status(400).json({ error: 'Stock must be a valid non-negative integer.' });
          }
          updates.stock = st;
        }
        if (typeof req.body?.isActive === 'boolean') {
          updates.isActive = req.body.isActive;
        }
        if (typeof req.body?.name === 'string') {
          updates.name = req.body.name;
        }

        const updated = await updateMerchantProduct(req.dbUser!, productId, updates);
        res.json({ product: updated });
      } catch (error) {
        if (error instanceof Error && error.message === 'FORBIDDEN_STORE') {
          return res.status(403).json({ error: 'You do not manage that product.' });
        }
        if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') {
          return res.status(404).json({ error: 'Product not found.' });
        }
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unable to update product.',
        });
      }
    }
  );

  app.patch(
    '/api/merchant/orders/:id/status',
    requireAuth,
    requireMerchantOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const orderId = Number(req.params.id);
        const status = req.body?.status;
        if (!Number.isInteger(orderId) || orderId <= 0) {
          return res.status(400).json({ error: 'Invalid order ID.' });
        }
        if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
          return res.status(400).json({ error: 'Invalid fulfillment status.' });
        }

        const updated = await updateOrderStatus(req.dbUser!, orderId, status as OrderStatus);
        res.json({ order: updated });
      } catch (error) {
        if (error instanceof Error && error.message === 'FORBIDDEN_ORDER') {
          return res.status(403).json({ error: 'You do not have access to this order.' });
        }
        if (error instanceof Error && error.message === 'ORDER_NOT_FOUND') {
          return res.status(404).json({ error: 'Order not found.' });
        }
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unable to update order status.',
        });
      }
    }
  );

  // System Administrator routes
  app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const data = await getAdminOverview();
      res.json(data);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to load admin overview.',
      });
    }
  });

  app.post('/api/admin/stores', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, category, email, address, city, description, coverImage, ownerId } =
        req.body ?? {};
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Store name must be at least 2 characters.' });
      }
      if (typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Please provide a valid store email.' });
      }
      if (typeof address !== 'string' || address.trim().length < 5) {
        return res.status(400).json({ error: 'Please provide a valid store street address.' });
      }

      const parsedOwnerId =
        ownerId !== null && ownerId !== undefined && ownerId !== ''
          ? Number(ownerId)
          : null;
      if (parsedOwnerId !== null && (!Number.isInteger(parsedOwnerId) || parsedOwnerId <= 0)) {
        return res.status(400).json({ error: 'Invalid owner user selected.' });
      }

      const safeCover =
        typeof coverImage === 'string' && isSafeImagePath(coverImage)
          ? coverImage.trim()
          : '/src/assets/images/hero_curated_showroom_1795634510695.jpg';

      const created = await createAdminStore({
        name,
        category: typeof category === 'string' && category.trim() ? category : 'Curated Goods',
        email,
        address,
        city: typeof city === 'string' && city.trim() ? city : 'Jaipur, RJ',
        description:
          typeof description === 'string' && description.trim()
            ? description
            : 'Independent design atelier verified on StorePulse.',
        coverImage: safeCover,
        ownerId: parsedOwnerId,
      });

      res.status(201).json({ store: created });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to register store.',
      });
    }
  });

  app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = Number(req.params.id);
      const role = req.body?.role;

      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Invalid user ID.' });
      }
      if (typeof role !== 'string' || !ALLOWED_ROLES.has(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
      }

      const updated = await updateAdminUserRole(req.dbUser!.id, userId, role as UserRole);
      res.json({ user: updated });
    } catch (error) {
      if (error instanceof Error && error.message === 'CANNOT_DEMOTE_SELF') {
        return res.status(400).json({ error: 'You cannot remove your own Administrator role.' });
      }
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'User not found.' });
      }
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to update user role.',
      });
    }
  });

  // Frontend serving (Vite dev middleware in development, static dist/ in production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StorePulse server running on http://localhost:${PORT}`);
  });
}

startServer();

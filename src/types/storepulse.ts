export type UserRole = 'USER' | 'STORE_OWNER' | 'SYSTEM_ADMIN';
export type OrderStatus = 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'CARD_ON_DELIVERY';

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  address: string;
  role: UserRole;
  createdAt: string;
}

export interface StoreReview {
  id: number;
  userId: number;
  userName: string;
  score: number;
  comment: string;
  updatedAt: string;
}

export interface StoreSummary {
  id: number;
  slug: string;
  name: string;
  category: string;
  email: string;
  address: string;
  city: string;
  description: string;
  coverImage: string;
  ownerId: number | null;
  ownerName: string;
  isVerified: boolean;
  averageRating: number;
  ratingCount: number;
  userRating: { score: number; comment: string } | null;
  recentReviews: StoreReview[];
}

export interface ProductItem {
  id: number;
  storeId: number;
  sku: string;
  name: string;
  category: string;
  description: string;
  materialSpec: string;
  dimensions: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
  variantLabel: string;
  featured: boolean;
  isActive: boolean;
  storeName: string;
  storeCity: string;
  storeRating: number;
  storeRatingCount: number;
}

export interface CatalogResponse {
  stores: StoreSummary[];
  products: ProductItem[];
  summary: {
    storeCount: number;
    productCount: number;
    ratingCount: number;
    platformAverageRating: number;
  };
}

export interface CartLine {
  product: ProductItem;
  quantity: number;
}

export interface OrderLineItem {
  id: number;
  orderId: number;
  productId: number;
  storeId: number;
  productName: string;
  storeName: string;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  userId: number;
  customerName: string;
  customerEmail: string;
  phone: string;
  shippingAddress: string;
  postalCode: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
  items: OrderLineItem[];
}

export interface MerchantOverviewResponse {
  stores: Array<
    StoreSummary & {
      ratingCount: number;
      averageRating: number;
    }
  >;
  products: Array<ProductItem & { storeName: string }>;
  ratings: Array<{
    id: number;
    storeId: number;
    storeName: string;
    customerName: string;
    customerEmail: string;
    score: number;
    comment: string;
    updatedAt: string;
  }>;
  orders: OrderRecord[];
  metrics: {
    averageRating: number;
    totalReviews: number;
    totalRevenueCents: number;
    totalUnitsSold: number;
    lowStockCount: number;
  };
}

export interface AdminOverviewResponse {
  metrics: {
    totalUsers: number;
    totalStores: number;
    totalRatings: number;
    totalOrders: number;
    grossRevenueCents: number;
  };
  users: Array<
    UserProfile & {
      storeCount: number;
      storeAverageRating: number | null;
    }
  >;
  stores: Array<
    StoreSummary & {
      ownerEmail: string;
      productCount: number;
    }
  >;
  orders: OrderRecord[];
}

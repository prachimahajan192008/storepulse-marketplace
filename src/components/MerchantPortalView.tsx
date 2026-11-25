import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { MerchantOverviewResponse, OrderStatus } from '../types/storepulse';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatDate, formatMoney, formatStatusLabel } from '../lib/format';

const STOCK_PRESET_IMAGES = [
  { label: 'Stoneware Carafe', url: '/src/assets/images/product_ceramic_pour_over_1795634500617.jpg' },
  { label: 'Brass Desk Lamp', url: '/src/assets/images/product_brass_desk_lamp_1795634510093.jpg' },
  { label: 'Botanical Oil', url: '/src/assets/images/product_botanical_serum_1795634510398.jpg' },
  { label: 'Merino Throw', url: '/src/assets/images/product_merino_throw_1795634505773.jpg' },
  { label: 'Walnut Speaker', url: '/src/assets/images/product_walnut_audio_speaker_1795634510987.jpg' },
  { label: 'Showroom Vessels', url: '/src/assets/images/hero_curated_showroom_1795634510695.jpg' },
];

const ORDER_STATUSES: OrderStatus[] = [
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

interface MerchantPortalViewProps {
  onCatalogMutated: () => Promise<void>;
}

export function MerchantPortalView({ onCatalogMutated }: MerchantPortalViewProps) {
  const { profile, getToken, signInWithGoogle } = useAuth();
  const [data, setData] = useState<MerchantOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'ratings'>('inventory');
  const [showAddProduct, setShowAddProduct] = useState(false);

  const [storeId, setStoreId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Ceramics & Tableware');
  const [priceDollars, setPriceDollars] = useState('4800');
  const [stock, setStock] = useState('12');
  const [materialSpec, setMaterialSpec] = useState('Kiln-fired stoneware, satin matte glaze');
  const [dimensions, setDimensions] = useState('20 cm H x 12 cm D');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(STOCK_PRESET_IMAGES[0].url);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadMerchant = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await apiFetch<MerchantOverviewResponse>('/api/merchant/overview', { token });
      setData(res);
      if (res.stores.length > 0 && !storeId) {
        setStoreId(String(res.stores[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load merchant portal.');
    } finally {
      setLoading(false);
    }
  }, [profile, getToken, storeId]);

  useEffect(() => {
    if (profile && (profile.role === 'STORE_OWNER' || profile.role === 'SYSTEM_ADMIN')) {
      void loadMerchant();
    } else {
      setLoading(false);
    }
  }, [profile, loadMerchant]);

  const handleAdjustStock = async (productId: number, nextStock: number) => {
    if (nextStock < 0) return;
    try {
      const token = await getToken();
      await apiFetch(`/api/merchant/products/${productId}`, {
        method: 'PATCH',
        token,
        body: { stock: nextStock },
      });
      await Promise.all([loadMerchant(), onCatalogMutated()]);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to update stock.');
    }
  };

  const handleToggleActive = async (productId: number, nextActive: boolean) => {
    try {
      const token = await getToken();
      await apiFetch(`/api/merchant/products/${productId}`, {
        method: 'PATCH',
        token,
        body: { isActive: nextActive },
      });
      await Promise.all([loadMerchant(), onCatalogMutated()]);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to update listing status.');
    }
  };

  const handleStatusChange = async (orderId: number, status: OrderStatus) => {
    try {
      const token = await getToken();
      await apiFetch(`/api/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      });
      await loadMerchant();
      setFeedback('Order fulfillment status updated.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to update order status.');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const token = await getToken();
      await apiFetch('/api/merchant/products', {
        method: 'POST',
        token,
        body: {
          storeId: Number(storeId),
          name,
          category,
          priceDollars: Number(priceDollars),
          stock: Number(stock),
          materialSpec,
          dimensions,
          description,
          imageUrl,
        },
      });
      setName('');
      setDescription('');
      setShowAddProduct(false);
      setFeedback('New studio edition published to live catalog.');
      await Promise.all([loadMerchant(), onCatalogMutated()]);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to publish product.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center space-y-5">
        <h1 className="font-editorial text-3xl font-medium text-[#121417]">Merchant Portal</h1>
        <p className="text-sm text-[#555E59]">
          Sign in with an assigned Store Owner or Administrator account to manage inventory,
          fulfill orders, and inspect verified customer ratings.
        </p>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="h-11 px-6 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] transition-colors"
        >
          Sign In with Google
        </button>
      </section>
    );
  }

  if (profile.role !== 'STORE_OWNER' && profile.role !== 'SYSTEM_ADMIN') {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center space-y-3">
        <h1 className="font-editorial text-3xl font-medium text-[#121417]">
          Merchant Access Required
        </h1>
        <p className="text-sm text-[#555E59]">
          Your account is currently registered as a Member. Ask a System Administrator to assign
          your account as a Store Owner to manage studio listings and fulfillment.
        </p>
      </section>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#121417]/10">
        <div>
          <p className="text-xs text-[#0F5132] font-medium">
            {profile.role === 'SYSTEM_ADMIN' ? 'All Partner Studios Overview' : 'Store Owner Portal'}
          </p>
          <h1 className="font-editorial text-3xl font-medium text-[#121417] mt-1">
            Merchant Operations
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowAddProduct((prev) => !prev)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {showAddProduct ? 'Close Form' : 'Add Studio Product'}
        </button>
      </div>

      {feedback && (
        <div className="bg-white border border-[#0F5132]/25 rounded-lg px-4 py-3 text-sm text-[#0F5132]">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-[#121417]/10 rounded-xl p-8 text-sm text-[#555E59]">
          Loading merchant metrics...
        </div>
      ) : error || !data ? (
        <div className="bg-white border border-[#9B2C2C]/20 rounded-xl p-6 text-sm text-[#9B2C2C]">
          {error || 'Unable to load merchant dashboard.'}
        </div>
      ) : (
        <>
          {/* 4-Column KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-[#121417]/10 divide-y lg:divide-y-0 lg:divide-x divide-[#121417]/10">
            <div className="py-5 lg:pr-6">
              <p className="font-mono text-2xl font-medium tabular-nums text-[#0F5132]">
                {data.metrics.averageRating > 0
                  ? `${data.metrics.averageRating.toFixed(2)} / 5`
                  : '—'}
              </p>
              <p className="text-xs text-[#555E59] mt-1">
                Verified Store Score ({data.metrics.totalReviews} reviews)
              </p>
            </div>
            <div className="py-5 pl-4 lg:px-6">
              <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
                {formatMoney(data.metrics.totalRevenueCents)}
              </p>
              <p className="text-xs text-[#555E59] mt-1">Gross Merchandise Sales</p>
            </div>
            <div className="py-5 lg:px-6">
              <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
                {data.metrics.totalUnitsSold}
              </p>
              <p className="text-xs text-[#555E59] mt-1">Total Units Ordered</p>
            </div>
            <div className="py-5 pl-4 lg:pl-6">
              <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
                {data.metrics.lowStockCount}
              </p>
              <p className="text-xs text-[#555E59] mt-1">Low Stock Listings (&le; 5 units)</p>
            </div>
          </div>

          {/* Add Product Form */}
          {showAddProduct && data.stores.length > 0 && (
            <form
              onSubmit={handleCreateProduct}
              className="bg-white border border-[#121417]/10 rounded-xl p-6 space-y-5"
            >
              <h2 className="text-lg font-semibold text-[#121417]">Publish New Studio Listing</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">Store</label>
                  <select
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  >
                    {data.stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Product Title
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Hand-Turned Stoneware Carafe"
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">Category</label>
                  <input
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Price (INR ₹)
                  </label>
                  <input
                    required
                    type="number"
                    min="100"
                    step="1"
                    value={priceDollars}
                    onChange={(e) => setPriceDollars(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Opening Stock
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Studio Photography
                  </label>
                  <select
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  >
                    {STOCK_PRESET_IMAGES.map((img) => (
                      <option key={img.url} value={img.url}>
                        {img.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Materials Specification
                  </label>
                  <input
                    value={materialSpec}
                    onChange={(e) => setMaterialSpec(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Dimensions
                  </label>
                  <input
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#555E59] mb-1">
                  Editorial Description
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe fabrication process, finish, and care..."
                  className="w-full rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="h-10 px-4 text-sm font-medium text-[#555E59]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-5 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] disabled:opacity-50"
                >
                  {saving ? 'Publishing...' : 'Publish Listing'}
                </button>
              </div>
            </form>
          )}

          {/* Segmented Section Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white border border-[#121417]/10 rounded-lg w-fit">
            {(
              [
                { id: 'inventory', label: `Live Inventory (${data.products.length})` },
                { id: 'orders', label: `Orders (${data.orders.length})` },
                { id: 'ratings', label: `Customer Ratings (${data.ratings.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#121417] text-white'
                    : 'text-[#555E59] hover:text-[#121417]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'inventory' && (
            <div className="bg-white border border-[#121417]/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#121417]/10 bg-[#F6F7F5] text-xs font-medium text-[#555E59]">
                      <th className="py-3.5 px-5">Product &amp; SKU</th>
                      <th className="py-3.5 px-5">Store</th>
                      <th className="py-3.5 px-5 text-right">Price</th>
                      <th className="py-3.5 px-5 text-right">Live Stock</th>
                      <th className="py-3.5 px-5 text-right">Visibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#121417]/10 text-sm">
                    {data.products.map((product) => (
                      <tr key={product.id} className="hover:bg-[#F6F7F5]/60">
                        <td className="py-3.5 px-5">
                          <p className="font-medium text-[#121417]">{product.name}</p>
                          <p className="font-mono text-xs text-[#555E59]">{product.sku}</p>
                        </td>
                        <td className="py-3.5 px-5 text-[#424A45]">{product.storeName}</td>
                        <td className="py-3.5 px-5 text-right font-mono tabular-nums text-[#121417]">
                          {formatMoney(product.priceCents)}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleAdjustStock(product.id, product.stock - 1)}
                              className="w-7 h-7 rounded border border-[#121417]/15 text-xs hover:bg-[#F6F7F5]"
                            >
                              -
                            </button>
                            <span className="font-mono tabular-nums w-8 text-center">
                              {product.stock}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleAdjustStock(product.id, product.stock + 1)}
                              className="w-7 h-7 rounded border border-[#121417]/15 text-xs hover:bg-[#F6F7F5]"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(product.id, !product.isActive)}
                            className="text-xs font-medium text-[#0F5132] hover:underline"
                          >
                            {product.isActive ? 'Live · Pause' : 'Paused · Publish'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white border border-[#121417]/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#121417]/10 bg-[#F6F7F5] text-xs font-medium text-[#555E59]">
                      <th className="py-3.5 px-5">Order</th>
                      <th className="py-3.5 px-5">Customer &amp; Destination</th>
                      <th className="py-3.5 px-5">Items</th>
                      <th className="py-3.5 px-5 text-right">Total</th>
                      <th className="py-3.5 px-5 text-right">Fulfillment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#121417]/10 text-sm">
                    {data.orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-[#555E59]">
                          No studio orders recorded yet.
                        </td>
                      </tr>
                    ) : (
                      data.orders.map((order) => (
                        <tr key={order.id} className="align-top hover:bg-[#F6F7F5]/60">
                          <td className="py-4 px-5 whitespace-nowrap">
                            <p className="font-mono font-medium tabular-nums text-[#121417]">
                              #{order.orderNumber}
                            </p>
                            <p className="text-xs text-[#555E59]">{formatDate(order.createdAt)}</p>
                          </td>
                          <td className="py-4 px-5">
                            <p className="font-medium text-[#121417]">{order.customerName}</p>
                            <p className="text-xs text-[#555E59]">
                              {order.shippingAddress}, {order.postalCode}
                            </p>
                            <p className="text-xs text-[#555E59] font-mono">{order.phone}</p>
                          </td>
                          <td className="py-4 px-5 text-xs text-[#424A45] space-y-1">
                            {order.items.map((item) => (
                              <p key={item.id}>
                                {item.quantity}x {item.productName}
                              </p>
                            ))}
                          </td>
                          <td className="py-4 px-5 text-right font-mono tabular-nums text-[#121417]">
                            {formatMoney(order.totalCents)}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <select
                              aria-label={`Order ${order.orderNumber} status`}
                              value={order.status}
                              onChange={(e) =>
                                void handleStatusChange(order.id, e.target.value as OrderStatus)
                              }
                              className="h-9 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-2.5 text-xs font-medium text-[#121417]"
                            >
                              {ORDER_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {formatStatusLabel(st)}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ratings' && (
            <div className="bg-white border border-[#121417]/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#121417]/10 bg-[#F6F7F5] text-xs font-medium text-[#555E59]">
                      <th className="py-3.5 px-5">Customer</th>
                      <th className="py-3.5 px-5">Store</th>
                      <th className="py-3.5 px-5">Review Note</th>
                      <th className="py-3.5 px-5 text-right">Score</th>
                      <th className="py-3.5 px-5 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#121417]/10 text-sm">
                    {data.ratings.map((rating) => (
                      <tr key={rating.id} className="hover:bg-[#F6F7F5]/60">
                        <td className="py-3.5 px-5">
                          <p className="font-medium text-[#121417]">{rating.customerName}</p>
                          <p className="text-xs text-[#555E59]">{rating.customerEmail}</p>
                        </td>
                        <td className="py-3.5 px-5 text-[#424A45]">{rating.storeName}</td>
                        <td className="py-3.5 px-5 text-[#424A45] max-w-md">
                          {rating.comment || 'No written comment'}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono font-medium tabular-nums text-[#0F5132]">
                            <Star className="w-3.5 h-3.5 fill-[#0F5132]" />
                            {rating.score}.0
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right text-xs text-[#555E59] whitespace-nowrap">
                          {formatDate(rating.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

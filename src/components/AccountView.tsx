import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, Package, Star } from 'lucide-react';
import { OrderRecord, StoreSummary } from '../types/storepulse';
import { useAuth } from '../context/AuthContext';
import {
  apiFetch,
  formatDate,
  formatMoney,
  formatPaymentLabel,
  formatRoleLabel,
  formatStatusLabel,
} from '../lib/format';

interface AccountViewProps {
  stores: StoreSummary[];
  onOpenRating: (store: StoreSummary) => void;
}

export function AccountView({ stores, onOpenRating }: AccountViewProps) {
  const { profile, signInWithGoogle, logout, getToken, refreshProfile } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setNameInput(profile.name);
      setAddressInput(profile.address);
    }
  }, [profile]);

  const loadOrders = useCallback(async () => {
    if (!profile) return;
    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const token = await getToken();
      const data = await apiFetch<{ orders: OrderRecord[] }>('/api/orders/mine', { token });
      setOrders(data.orders);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setLoadingOrders(false);
    }
  }, [profile, getToken]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const token = await getToken();
      await apiFetch('/api/me', {
        method: 'PATCH',
        token,
        body: { name: nameInput, address: addressInput },
      });
      await refreshProfile();
      setProfileNotice('Profile saved.');
    } catch (err) {
      setProfileNotice(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!profile) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center space-y-5">
        <h1 className="font-editorial text-3xl font-medium text-[#121417]">
          Sign in to access your StorePulse account
        </h1>
        <p className="text-sm text-[#555E59] max-w-md mx-auto leading-relaxed">
          Track studio shipments, manage your default delivery address, and update your verified
          1–5 store ratings in one place.
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

  const ratedStores = stores.filter((s) => s.userRating !== null);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-12 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#121417]/10">
        <div>
          <p className="text-xs text-[#555E59]">
            {formatRoleLabel(profile.role)} · {profile.email}
          </p>
          <h1 className="font-editorial text-3xl font-medium text-[#121417] mt-1">
            {profile.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-[#121417]/15 text-sm font-medium text-[#121417] hover:bg-white transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Profile & Saved Ratings */}
        <div className="lg:col-span-4 space-y-8">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-[#121417]/10 rounded-xl p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-[#121417]">Member Details</h2>
            <div>
              <label htmlFor="acct-name" className="block text-xs font-medium text-[#555E59] mb-1">
                Display Name
              </label>
              <input
                id="acct-name"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            <div>
              <label htmlFor="acct-addr" className="block text-xs font-medium text-[#555E59] mb-1">
                Default Delivery Address
              </label>
              <textarea
                id="acct-addr"
                rows={3}
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="Street, apartment, city, state"
                className="w-full rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 py-2 text-sm focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            {profileNotice && <p className="text-xs text-[#0F5132]">{profileNotice}</p>}
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full h-10 rounded-lg bg-[#121417] text-white text-sm font-medium hover:bg-[#23282D] disabled:opacity-50 transition-colors"
            >
              {savingProfile ? 'Saving...' : 'Save Details'}
            </button>
          </form>

          <div className="bg-white border border-[#121417]/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#121417]">Your Store Ratings</h2>
              <span className="font-mono text-xs tabular-nums text-[#555E59]">
                {ratedStores.length} submitted
              </span>
            </div>

            {ratedStores.length === 0 ? (
              <p className="text-sm text-[#555E59]">
                You haven&apos;t rated any stores yet. Visit the Verified Stores directory to share
                feedback.
              </p>
            ) : (
              <ul className="divide-y divide-[#121417]/10">
                {ratedStores.map((store) => (
                  <li key={store.id} className="py-3 first:pt-0 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#121417]">{store.name}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-[#0F5132] font-mono tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-[#0F5132]" />
                        <span>{store.userRating?.score}.0 / 5</span>
                      </div>
                      {store.userRating?.comment && (
                        <p className="text-xs text-[#555E59] mt-1 line-clamp-2">
                          {store.userRating.comment}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenRating(store)}
                      className="text-xs font-medium text-[#0F5132] hover:underline whitespace-nowrap shrink-0"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Order History */}
        <div className="lg:col-span-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-2xl font-medium text-[#121417]">Order History</h2>
            <span className="font-mono text-xs tabular-nums text-[#555E59]">
              {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            </span>
          </div>

          {loadingOrders ? (
            <div className="bg-white border border-[#121417]/10 rounded-xl p-8 text-sm text-[#555E59]">
              Loading your orders...
            </div>
          ) : ordersError ? (
            <div className="bg-white border border-[#9B2C2C]/20 rounded-xl p-6 text-sm text-[#9B2C2C]">
              {ordersError}
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-[#121417]/10 rounded-xl p-12 text-center space-y-2">
              <Package className="w-7 h-7 mx-auto text-[#121417]/25" strokeWidth={1.5} />
              <p className="text-sm font-medium text-[#121417]">No orders placed yet</p>
              <p className="text-xs text-[#555E59]">
                Orders confirmed through your shopping bag will appear here with live shipment
                updates.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="bg-white border border-[#121417]/10 rounded-xl p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#121417]/10">
                    <div>
                      <p className="font-mono text-sm font-semibold tabular-nums text-[#121417]">
                        Order #{order.orderNumber}
                      </p>
                      <p className="text-xs text-[#555E59] mt-0.5">
                        {formatDate(order.createdAt)} · {formatPaymentLabel(order.paymentMethod)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-[#0F5132]">
                        {formatStatusLabel(order.status)}
                      </p>
                      <p className="font-mono text-base font-semibold tabular-nums text-[#121417] mt-0.5">
                        {formatMoney(order.totalCents)}
                      </p>
                    </div>
                  </div>

                  <ul className="divide-y divide-[#121417]/8 text-sm">
                    {order.items.map((item) => (
                      <li key={item.id} className="py-2.5 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-[#121417]">{item.productName}</p>
                          <p className="text-xs text-[#555E59]">
                            {item.storeName} · Qty {item.quantity}
                          </p>
                        </div>
                        <span className="font-mono tabular-nums text-[#121417]">
                          {formatMoney(item.unitPriceCents * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-xs text-[#555E59] pt-1">
                    Shipping to {order.customerName} — {order.shippingAddress}, {order.postalCode}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

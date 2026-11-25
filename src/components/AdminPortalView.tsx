import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Star } from 'lucide-react';
import { AdminOverviewResponse, UserRole } from '../types/storepulse';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatDate, formatMoney, formatRoleLabel, formatStatusLabel } from '../lib/format';

const COVER_PRESETS = [
  { label: 'Showroom Interior', url: '/src/assets/images/hero_curated_showroom_1795634510695.jpg' },
  { label: 'Stoneware Ceramics', url: '/src/assets/images/product_ceramic_pour_over_1795634500617.jpg' },
  { label: 'Architectural Lighting', url: '/src/assets/images/product_brass_desk_lamp_1795634510093.jpg' },
  { label: 'Botanical Apothecary', url: '/src/assets/images/product_botanical_serum_1795634510398.jpg' },
  { label: 'Merino Textiles', url: '/src/assets/images/product_merino_throw_1795634505773.jpg' },
  { label: 'Acoustic Hardware', url: '/src/assets/images/product_walnut_audio_speaker_1795634510987.jpg' },
];

interface AdminPortalViewProps {
  onCatalogMutated: () => Promise<void>;
}

export function AdminPortalView({ onCatalogMutated }: AdminPortalViewProps) {
  const { profile, getToken, signInWithGoogle } = useAuth();
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'stores' | 'users' | 'orders'>('stores');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [notice, setNotice] = useState<string | null>(null);

  const [showAddStore, setShowAddStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeCategory, setStoreCategory] = useState('Ceramics & Tableware');
  const [storeEmail, setStoreEmail] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeCity, setStoreCity] = useState('Portland, OR');
  const [storeDesc, setStoreDesc] = useState('');
  const [storeOwnerId, setStoreOwnerId] = useState('');
  const [storeCover, setStoreCover] = useState(COVER_PRESETS[0].url);
  const [savingStore, setSavingStore] = useState(false);

  const loadAdmin = useCallback(async () => {
    if (!profile || profile.role !== 'SYSTEM_ADMIN') return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await apiFetch<AdminOverviewResponse>('/api/admin/overview', { token });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin overview.');
    } finally {
      setLoading(false);
    }
  }, [profile, getToken]);

  useEffect(() => {
    if (profile?.role === 'SYSTEM_ADMIN') {
      void loadAdmin();
    } else {
      setLoading(false);
    }
  }, [profile, loadAdmin]);

  const handleRoleUpdate = async (userId: number, role: UserRole) => {
    setNotice(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        token,
        body: { role },
      });
      setNotice('User role updated.');
      await loadAdmin();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to update user role.');
    }
  };

  const handleRegisterStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStore(true);
    setNotice(null);
    try {
      const token = await getToken();
      await apiFetch('/api/admin/stores', {
        method: 'POST',
        token,
        body: {
          name: storeName,
          category: storeCategory,
          email: storeEmail,
          address: storeAddress,
          city: storeCity,
          description: storeDesc,
          coverImage: storeCover,
          ownerId: storeOwnerId ? Number(storeOwnerId) : null,
        },
      });
      setStoreName('');
      setStoreEmail('');
      setStoreAddress('');
      setStoreDesc('');
      setStoreOwnerId('');
      setShowAddStore(false);
      setNotice('Verified store added to directory.');
      await Promise.all([loadAdmin(), onCatalogMutated()]);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to register store.');
    } finally {
      setSavingStore(false);
    }
  };

  const filteredStores = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.stores.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
    );
  }, [data, search]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.address.toLowerCase().includes(q)
      );
    });
  }, [data, search, roleFilter]);

  if (!profile) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center space-y-5">
        <h1 className="font-editorial text-3xl font-medium text-[#121417]">
          System Administrator Portal
        </h1>
        <p className="text-sm text-[#555E59]">
          Sign in with your Administrator Google account to manage verified stores, member roles,
          and platform orders.
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

  if (profile.role !== 'SYSTEM_ADMIN') {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center space-y-3">
        <h1 className="font-editorial text-3xl font-medium text-[#121417]">
          Administrator Access Required
        </h1>
        <p className="text-sm text-[#555E59]">
          Your signed-in account ({profile.email}) does not have System Administrator privileges.
        </p>
      </section>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#121417]/10">
        <div>
          <p className="text-xs text-[#0F5132] font-medium">System Administrator Console</p>
          <h1 className="font-editorial text-3xl font-medium text-[#121417] mt-1">
            Platform Governance
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowAddStore((prev) => !prev)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {showAddStore ? 'Close Form' : 'Register New Store'}
        </button>
      </div>

      {notice && (
        <div className="bg-white border border-[#0F5132]/25 rounded-lg px-4 py-3 text-sm text-[#0F5132]">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-[#121417]/10 rounded-xl p-8 text-sm text-[#555E59]">
          Loading platform metrics...
        </div>
      ) : error || !data ? (
        <div className="bg-white border border-[#9B2C2C]/20 rounded-xl p-6 text-sm text-[#9B2C2C]">
          {error || 'Unable to load admin dashboard.'}
        </div>
      ) : (
        <>
          {/* Platform KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 border-y border-[#121417]/10 divide-y lg:divide-y-0 lg:divide-x divide-[#121417]/10">
            <div className="py-5 lg:pr-5">
              <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
                {data.metrics.totalUsers}
              </p>
              <p className="text-xs text-[#555E59] mt-1">Registered Users</p>
            </div>
            <div className="py-5 pl-4 lg:px-5">
              <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
                {data.metrics.totalStores}
              </p>
              <p className="text-xs text-[#555E59] mt-1">Verified Stores</p>
            </div>
            <div className="py-5 lg:px-5">
              <p className="font-mono text-2xl font-medium tabular-nums text-[#0F5132]">
                {data.metrics.totalRatings}
              </p>
              <p className="text-xs text-[#555E59] mt-1">Submitted Ratings</p>
            </div>
            <div className="py-5 pl-4 lg:px-5">
              <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
                {data.metrics.totalOrders}
              </p>
              <p className="text-xs text-[#555E59] mt-1">Total Orders</p>
            </div>
            <div className="py-5 lg:pl-5 col-span-2 lg:col-span-1">
              <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
                {formatMoney(data.metrics.grossRevenueCents)}
              </p>
              <p className="text-xs text-[#555E59] mt-1">Gross Volume</p>
            </div>
          </div>

          {showAddStore && (
            <form
              onSubmit={handleRegisterStore}
              className="bg-white border border-[#121417]/10 rounded-xl p-6 space-y-5"
            >
              <h2 className="text-lg font-semibold text-[#121417]">Register Verified Studio</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Store Name
                  </label>
                  <input
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Atelier Nord"
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">Category</label>
                  <input
                    required
                    value={storeCategory}
                    onChange={(e) => setStoreCategory(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Contact Email
                  </label>
                  <input
                    required
                    type="email"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    placeholder="studio@ateliernord.com"
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Street Address
                  </label>
                  <input
                    required
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder="215 NW Flanders St, Portland, OR"
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">City</label>
                  <input
                    required
                    value={storeCity}
                    onChange={(e) => setStoreCity(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Assign Store Owner
                  </label>
                  <select
                    value={storeOwnerId}
                    onChange={(e) => setStoreOwnerId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {data.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Studio Description
                  </label>
                  <input
                    required
                    value={storeDesc}
                    onChange={(e) => setStoreDesc(e.target.value)}
                    placeholder="Short craft statement shown in the verified directory"
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555E59] mb-1">
                    Cover Photography
                  </label>
                  <select
                    value={storeCover}
                    onChange={(e) => setStoreCover(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-3 text-sm"
                  >
                    {COVER_PRESETS.map((preset) => (
                      <option key={preset.url} value={preset.url}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddStore(false)}
                  className="h-10 px-4 text-sm font-medium text-[#555E59]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStore}
                  className="h-10 px-5 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] disabled:opacity-50"
                >
                  {savingStore ? 'Registering...' : 'Register Store'}
                </button>
              </div>
            </form>
          )}

          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 bg-white border border-[#121417]/10 rounded-lg w-fit">
              {(
                [
                  { id: 'stores', label: `Stores (${data.stores.length})` },
                  { id: 'users', label: `Users (${data.users.length})` },
                  { id: 'orders', label: `Orders (${data.orders.length})` },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    tab === item.id
                      ? 'bg-[#121417] text-white'
                      : 'text-[#555E59] hover:text-[#121417]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab !== 'orders' && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#76807A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by name, email, or address..."
                    className="h-10 w-64 pl-9 pr-3 rounded-lg border border-[#121417]/12 bg-white text-sm focus:outline-none focus:border-[#0F5132]"
                  />
                </div>
                {tab === 'users' && (
                  <select
                    aria-label="Filter users by role"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as 'ALL' | UserRole)}
                    className="h-10 rounded-lg border border-[#121417]/12 bg-white px-3 text-sm"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="USER">Members</option>
                    <option value="STORE_OWNER">Store Owners</option>
                    <option value="SYSTEM_ADMIN">System Admins</option>
                  </select>
                )}
              </div>
            )}
          </div>

          {tab === 'stores' && (
            <div className="bg-white border border-[#121417]/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#121417]/10 bg-[#F6F7F5] text-xs font-medium text-[#555E59]">
                      <th className="py-3.5 px-5">Store</th>
                      <th className="py-3.5 px-5">Email &amp; Address</th>
                      <th className="py-3.5 px-5">Owner</th>
                      <th className="py-3.5 px-5 text-right">Listings</th>
                      <th className="py-3.5 px-5 text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#121417]/10 text-sm">
                    {filteredStores.map((store) => (
                      <tr key={store.id} className="hover:bg-[#F6F7F5]/60">
                        <td className="py-3.5 px-5">
                          <p className="font-medium text-[#121417]">{store.name}</p>
                          <p className="text-xs text-[#555E59]">{store.category}</p>
                        </td>
                        <td className="py-3.5 px-5">
                          <p className="text-[#121417]">{store.email}</p>
                          <p className="text-xs text-[#555E59]">{store.address}</p>
                        </td>
                        <td className="py-3.5 px-5 text-[#424A45]">{store.ownerName}</td>
                        <td className="py-3.5 px-5 text-right font-mono tabular-nums">
                          {store.productCount}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono font-medium tabular-nums text-[#0F5132]">
                            <Star className="w-3.5 h-3.5 fill-[#0F5132]" />
                            {store.averageRating > 0 ? store.averageRating.toFixed(2) : '—'}
                          </span>
                          <span className="text-xs text-[#555E59] ml-1 font-mono tabular-nums">
                            ({store.ratingCount})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="bg-white border border-[#121417]/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#121417]/10 bg-[#F6F7F5] text-xs font-medium text-[#555E59]">
                      <th className="py-3.5 px-5">Member</th>
                      <th className="py-3.5 px-5">Address</th>
                      <th className="py-3.5 px-5 text-right">Owner Rating</th>
                      <th className="py-3.5 px-5 text-right">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#121417]/10 text-sm">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-[#F6F7F5]/60">
                        <td className="py-3.5 px-5">
                          <p className="font-medium text-[#121417]">{user.name}</p>
                          <p className="text-xs text-[#555E59]">{user.email}</p>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-[#555E59]">
                          {user.address || '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono tabular-nums text-[#0F5132]">
                          {user.storeAverageRating !== null
                            ? `${user.storeAverageRating.toFixed(2)} / 5`
                            : '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <select
                            aria-label={`Role for ${user.email}`}
                            disabled={user.id === profile.id}
                            value={user.role}
                            onChange={(e) =>
                              void handleRoleUpdate(user.id, e.target.value as UserRole)
                            }
                            className="h-9 rounded-lg border border-[#121417]/15 bg-[#F6F7F5] px-2.5 text-xs font-medium text-[#121417] disabled:opacity-60"
                          >
                            <option value="USER">{formatRoleLabel('USER')}</option>
                            <option value="STORE_OWNER">{formatRoleLabel('STORE_OWNER')}</option>
                            <option value="SYSTEM_ADMIN">{formatRoleLabel('SYSTEM_ADMIN')}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="bg-white border border-[#121417]/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#121417]/10 bg-[#F6F7F5] text-xs font-medium text-[#555E59]">
                      <th className="py-3.5 px-5">Order</th>
                      <th className="py-3.5 px-5">Buyer</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#121417]/10 text-sm">
                    {data.orders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-[#555E59]">
                          No orders placed yet.
                        </td>
                      </tr>
                    ) : (
                      data.orders.map((order) => (
                        <tr key={order.id} className="hover:bg-[#F6F7F5]/60">
                          <td className="py-3.5 px-5">
                            <p className="font-mono font-medium tabular-nums text-[#121417]">
                              #{order.orderNumber}
                            </p>
                            <p className="text-xs text-[#555E59]">{formatDate(order.createdAt)}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="font-medium text-[#121417]">{order.customerName}</p>
                            <p className="text-xs text-[#555E59]">{order.customerEmail}</p>
                          </td>
                          <td className="py-3.5 px-5 text-xs font-medium text-[#0F5132]">
                            {formatStatusLabel(order.status)}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono tabular-nums text-[#121417]">
                            {formatMoney(order.totalCents)}
                          </td>
                        </tr>
                      ))
                    )}
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

import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiFetch } from './lib/format';
import {
  CartLine,
  CatalogResponse,
  ProductItem,
  StoreSummary,
} from './types/storepulse';
import { StorefrontView } from './components/StorefrontView';
import { AccountView } from './components/AccountView';
import { MerchantPortalView } from './components/MerchantPortalView';
import { AdminPortalView } from './components/AdminPortalView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { RatingModal } from './components/RatingModal';
import { BagDrawer } from './components/BagDrawer';
import { StorePulseLogo } from './components/StorePulseLogo';

type ActiveRoute = 'storefront' | 'account' | 'merchant' | 'admin';

function StorePulseShell() {
  const { profile, loading: authLoading, authError, signInWithGoogle, getToken } = useAuth();
  const [route, setRoute] = useState<ActiveRoute>('storefront');
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [bag, setBag] = useState<CartLine[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [ratingStore, setRatingStore] = useState<StoreSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 3200);
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      const token = await getToken();
      const data = await apiFetch<CatalogResponse>('/api/catalog', { token });
      setCatalog(data);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : 'Unable to load curated catalog right now.'
      );
    } finally {
      setCatalogLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!authLoading) {
      void loadCatalog();
    }
  }, [authLoading, profile?.id, loadCatalog]);

  const handleAddToBag = useCallback(
    (product: ProductItem, quantity = 1) => {
      setBag((prev) => {
        const existing = prev.find((line) => line.product.id === product.id);
        if (existing) {
          const capped = Math.min(product.stock, existing.quantity + quantity);
          return prev.map((line) =>
            line.product.id === product.id ? { ...line, quantity: capped } : line
          );
        }
        return [...prev, { product, quantity: Math.min(product.stock, quantity) }];
      });
      showToast(`Added ${product.name} to bag`);
    },
    [showToast]
  );

  const handleUpdateBagQty = useCallback((productId: number, delta: number) => {
    setBag((prev) =>
      prev
        .map((line) => {
          if (line.product.id !== productId) return line;
          const next = line.quantity + delta;
          if (next <= 0) return null;
          return { ...line, quantity: Math.min(line.product.stock, next) };
        })
        .filter((line): line is CartLine => line !== null)
    );
  }, []);

  const handleRemoveBagItem = useCallback((productId: number) => {
    setBag((prev) => prev.filter((line) => line.product.id !== productId));
  }, []);

  const totalBagCount = bag.reduce((sum, line) => sum + line.quantity, 0);

  const selectedProductStore =
    selectedProduct && catalog
      ? catalog.stores.find((s) => s.id === selectedProduct.storeId) || null
      : null;

  const isMerchant = profile?.role === 'STORE_OWNER' || profile?.role === 'SYSTEM_ADMIN';
  const isAdmin = profile?.role === 'SYSTEM_ADMIN';

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F5] text-[#121417]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#F6F7F5]/95 backdrop-blur-sm border-b border-[#121417]/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Emblem & Wordmark */}
          <button
            type="button"
            onClick={() => setRoute('storefront')}
            className="inline-flex items-center gap-2.5 font-editorial text-xl font-semibold tracking-tight text-[#121417] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#0F5132]"
          >
            <StorePulseLogo className="w-7 h-7" />
            <span>StorePulse</span>
          </button>

          {/* Zone 2: Clean Single-Line Text Navigation */}
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-6 overflow-x-auto text-sm font-medium text-[#424A45]"
          >
            <button
              type="button"
              onClick={() => setRoute('storefront')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#121417] ${
                route === 'storefront'
                  ? 'text-[#121417] underline underline-offset-8 decoration-[#0F5132] decoration-2'
                  : ''
              }`}
            >
              Storefront
            </button>
            <button
              type="button"
              onClick={() => {
                setRoute('storefront');
                window.setTimeout(() => {
                  document
                    .getElementById('verified-stores')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }, 60);
              }}
              className="hidden sm:inline whitespace-nowrap shrink-0 transition-colors hover:text-[#121417]"
            >
              Verified Stores
            </button>
            {isMerchant && (
              <button
                type="button"
                onClick={() => setRoute('merchant')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#121417] ${
                  route === 'merchant'
                    ? 'text-[#121417] underline underline-offset-8 decoration-[#0F5132] decoration-2'
                    : ''
                }`}
              >
                Merchant
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setRoute('admin')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#121417] ${
                  route === 'admin'
                    ? 'text-[#121417] underline underline-offset-8 decoration-[#0F5132] decoration-2'
                    : ''
                }`}
              >
                Admin
              </button>
            )}
            {profile ? (
              <button
                type="button"
                onClick={() => setRoute('account')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#121417] ${
                  route === 'account'
                    ? 'text-[#121417] underline underline-offset-8 decoration-[#0F5132] decoration-2'
                    : ''
                }`}
              >
                Account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="whitespace-nowrap shrink-0 transition-colors hover:text-[#0F5132]"
              >
                Sign In
              </button>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setBagOpen(true)}
              className="h-10 px-4 rounded-lg bg-[#0F5132] text-white text-xs font-medium hover:bg-[#0B3D26] transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums"
            >
              Bag ({totalBagCount})
            </button>
          </div>
        </div>
      </header>

      {/* Non-intrusive Feedback Banner */}
      {(toast || authError) && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div
            role="status"
            className="bg-white border border-[#0F5132]/20 rounded-lg px-4 py-2.5 text-sm text-[#121417] flex items-center justify-between"
          >
            <span>{toast || authError}</span>
            {toast && (
              <button
                type="button"
                onClick={() => setBagOpen(true)}
                className="text-xs font-medium text-[#0F5132] hover:underline whitespace-nowrap shrink-0 ml-4"
              >
                View Bag
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {route === 'storefront' && (
          <>
            {catalogLoading ? (
              <div className="max-w-7xl mx-auto px-6 py-24 text-center text-sm text-[#555E59]">
                Loading curated studio catalog...
              </div>
            ) : catalogError || !catalog ? (
              <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-4">
                <p className="text-base font-medium text-[#121417]">
                  {catalogError || 'Unable to load storefront.'}
                </p>
                <button
                  type="button"
                  onClick={() => void loadCatalog()}
                  className="h-10 px-5 rounded-lg bg-[#0F5132] text-white text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            ) : (
              <StorefrontView
                catalog={catalog}
                onSelectProduct={setSelectedProduct}
                onAddToBag={handleAddToBag}
                onOpenRating={setRatingStore}
              />
            )}
          </>
        )}

        {route === 'account' && (
          <AccountView stores={catalog?.stores || []} onOpenRating={setRatingStore} />
        )}

        {route === 'merchant' && <MerchantPortalView onCatalogMutated={loadCatalog} />}

        {route === 'admin' && <AdminPortalView onCatalogMutated={loadCatalog} />}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#121417]/10 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs text-[#555E59]">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2">
              <StorePulseLogo className="w-5 h-5" />
              <p className="font-editorial text-base font-medium text-[#121417]">StorePulse</p>
            </div>
            <p>
              Curated Indian studio storefront and verified store rating directory.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => setRoute('storefront')}
              className="hover:text-[#121417] transition-colors"
            >
              Collection
            </button>
            <button
              type="button"
              onClick={() => setRoute('account')}
              className="hover:text-[#121417] transition-colors"
            >
              Orders &amp; Account
            </button>
            {isMerchant && (
              <button
                type="button"
                onClick={() => setRoute('merchant')}
                className="hover:text-[#121417] transition-colors"
              >
                Merchant Portal
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setRoute('admin')}
                className="hover:text-[#121417] transition-colors"
              >
                Admin Console
              </button>
            )}
            <span>© {new Date().getFullYear()} StorePulse</span>
          </div>
        </div>
      </footer>

      {/* Interactive Modals & Drawers */}
      <ProductDetailModal
        product={selectedProduct}
        store={selectedProductStore}
        onClose={() => setSelectedProduct(null)}
        onAddToBag={handleAddToBag}
        onOpenRating={setRatingStore}
      />

      <RatingModal
        store={ratingStore}
        onClose={() => setRatingStore(null)}
        onSaved={async () => {
          await loadCatalog();
          showToast('Store rating saved.');
        }}
      />

      <BagDrawer
        open={bagOpen}
        items={bag}
        onClose={() => setBagOpen(false)}
        onUpdateQty={handleUpdateBagQty}
        onRemove={handleRemoveBagItem}
        onClearBag={() => setBag([])}
        onOrderComplete={async () => {
          await loadCatalog();
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StorePulseShell />
    </AuthProvider>
  );
}

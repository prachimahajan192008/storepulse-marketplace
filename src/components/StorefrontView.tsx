import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpDown, Search, Star } from 'lucide-react';
import { CatalogResponse, ProductItem, StoreSummary } from '../types/storepulse';
import { formatMoney } from '../lib/format';
import { SafeImage } from './SafeImage';

const HERO_IMAGE = '/src/assets/images/hero_curated_showroom_1795634510695.jpg';

interface StorefrontViewProps {
  catalog: CatalogResponse;
  initialFocus?: 'collection' | 'stores';
  onSelectProduct: (product: ProductItem) => void;
  onAddToBag: (product: ProductItem, quantity?: number) => void;
  onOpenRating: (store: StoreSummary) => void;
}

export function StorefrontView({
  catalog,
  onSelectProduct,
  onAddToBag,
  onOpenRating,
}: StorefrontViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [productSearch, setProductSearch] = useState('');
  const [productSort, setProductSort] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');

  const [storeSearch, setStoreSearch] = useState('');
  const [storeSort, setStoreSort] = useState<'rating-desc' | 'name-asc' | 'reviews-desc'>('rating-desc');
  const [expandedStoreId, setExpandedStoreId] = useState<number | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(catalog.products.map((p) => p.category)));
    return ['All', ...unique];
  }, [catalog.products]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const list = catalog.products.filter((product) => {
      if (selectedCategory !== 'All' && product.category !== selectedCategory) return false;
      if (!query) return true;
      return (
        product.name.toLowerCase().includes(query) ||
        product.storeName.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.materialSpec.toLowerCase().includes(query)
      );
    });

    return [...list].sort((a, b) => {
      if (productSort === 'price-asc') return a.priceCents - b.priceCents;
      if (productSort === 'price-desc') return b.priceCents - a.priceCents;
      if (productSort === 'rating') return b.storeRating - a.storeRating;
      return Number(b.featured) - Number(a.featured) || a.id - b.id;
    });
  }, [catalog.products, selectedCategory, productSearch, productSort]);

  const filteredStores = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();
    const list = catalog.stores.filter((store) => {
      if (!query) return true;
      return (
        store.name.toLowerCase().includes(query) ||
        store.address.toLowerCase().includes(query) ||
        store.city.toLowerCase().includes(query) ||
        store.category.toLowerCase().includes(query)
      );
    });

    return [...list].sort((a, b) => {
      if (storeSort === 'name-asc') return a.name.localeCompare(b.name);
      if (storeSort === 'reviews-desc') return b.ratingCount - a.ratingCount;
      return b.averageRating - a.averageRating || b.ratingCount - a.ratingCount;
    });
  }, [catalog.stores, storeSearch, storeSort]);

  return (
    <div className="space-y-20 pb-20">
      {/* Section 1: Editorial Split Hero + 4-Column Proof Strip */}
      <section className="max-w-7xl mx-auto px-6 pt-8 sm:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between py-2 sm:py-6">
            <div className="space-y-6">
              <p className="text-xs font-medium tracking-wide text-[#0F5132]">
                Direct-to-Consumer Curated Marketplace
              </p>
              <h1
                className="font-editorial text-[#121417] font-medium tracking-[-0.025em] leading-[1.06]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)' }}
              >
                Objects crafted by independent studios, rated by verified buyers.
              </h1>
              <p className="text-base text-[#424A45] leading-relaxed max-w-md">
                Every storefront on StorePulse ships live studio inventory directly from the maker
                and carries transparent 1–5 community ratings audited across our partner directory.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-8">
              <a
                href="#collection"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] transition-colors whitespace-nowrap shrink-0"
              >
                Explore Collection
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#verified-stores"
                className="text-sm font-medium text-[#121417] underline underline-offset-4 decoration-[#121417]/30 hover:decoration-[#0F5132] hover:text-[#0F5132] transition-colors whitespace-nowrap shrink-0"
              >
                Rate Verified Stores
              </a>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="h-full min-h-[300px] sm:min-h-[420px] rounded-xl overflow-hidden bg-[#ECEEE9]">
              <SafeImage
                src={HERO_IMAGE}
                alt="Sunlit StorePulse showroom featuring stoneware vessels, brushed brass lamp, and woven linen"
                fallbackTitle="StorePulse Showroom"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Full-width 4-Column Quantitative Proof Strip */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 border-y border-[#121417]/10 divide-y lg:divide-y-0 lg:divide-x divide-[#121417]/10">
          <div className="py-5 lg:pr-6">
            <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
              {catalog.summary.storeCount}
            </p>
            <p className="text-xs text-[#555E59] mt-1">Verified Partner Studios</p>
          </div>
          <div className="py-5 pl-4 lg:px-6">
            <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
              {catalog.summary.productCount}
            </p>
            <p className="text-xs text-[#555E59] mt-1">Live In-Stock Studio Editions</p>
          </div>
          <div className="py-5 lg:px-6">
            <p className="font-mono text-2xl font-medium tabular-nums text-[#0F5132]">
              {catalog.summary.platformAverageRating > 0
                ? `${catalog.summary.platformAverageRating.toFixed(1)} / 5.0`
                : '—'}
            </p>
            <p className="text-xs text-[#555E59] mt-1">
              Across {catalog.summary.ratingCount} Verified Ratings
            </p>
          </div>
          <div className="py-5 pl-4 lg:pl-6">
            <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">$150+</p>
            <p className="text-xs text-[#555E59] mt-1">Complimentary Tracked Courier</p>
          </div>
        </div>
      </section>

      {/* Section 2: Curated Collection Grid */}
      <section id="collection" className="max-w-7xl mx-auto px-6 scroll-mt-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#121417]/10">
          <div>
            <h2 className="font-editorial text-3xl font-medium tracking-tight text-[#121417]">
              Featured Studio Collection
            </h2>
            <p className="text-sm text-[#555E59] mt-1.5">
              Real-time inventory synced directly with each studio workshop.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#76807A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search objects or studios..."
                aria-label="Search products"
                className="w-full sm:w-64 h-10 pl-9 pr-3 rounded-lg border border-[#121417]/12 bg-white text-sm text-[#121417] placeholder:text-[#76807A] focus:outline-none focus:border-[#0F5132]"
              />
            </div>

            <div className="inline-flex items-center gap-2 border border-[#121417]/12 rounded-lg bg-white px-3 h-10">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#555E59] shrink-0" />
              <select
                aria-label="Sort products"
                value={productSort}
                onChange={(e) =>
                  setProductSort(e.target.value as 'featured' | 'price-asc' | 'price-desc' | 'rating')
                }
                className="bg-transparent text-sm text-[#121417] focus:outline-none pr-1"
              >
                <option value="featured">Curator Order</option>
                <option value="rating">Highest Rated Studio</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Segmented Controls */}
        <div className="flex items-center gap-2 overflow-x-auto py-5">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#121417] text-white'
                    : 'bg-white text-[#424A45] border border-[#121417]/10 hover:text-[#121417]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center bg-white border border-[#121417]/10 rounded-xl">
            <p className="text-base font-medium text-[#121417]">No studio objects match your filter</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setProductSearch('');
              }}
              className="mt-3 text-sm font-medium text-[#0F5132] hover:underline"
            >
              Reset catalog filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => {
              const outOfStock = product.stock <= 0;
              return (
                <article
                  key={product.id}
                  className="group flex flex-col bg-white border border-[#121417]/8 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => onSelectProduct(product)}
                    className="aspect-[4/3] w-full overflow-hidden bg-[#ECEEE9] text-left focus-visible:outline-2 focus-visible:outline-[#0F5132]"
                  >
                    <SafeImage
                      src={product.imageUrl}
                      alt={product.name}
                      fallbackTitle={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </button>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#555E59]">
                        <span className="truncate">{product.storeName}</span>
                        <span className="font-mono tabular-nums shrink-0 text-[#0F5132]">
                          {outOfStock ? 'Sold Out' : `${product.stock} left`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectProduct(product)}
                        className="text-left block w-full"
                      >
                        <h3 className="text-base font-semibold text-[#121417] group-hover:text-[#0F5132] transition-colors">
                          {product.name}
                        </h3>
                      </button>
                      <p className="text-xs text-[#555E59] line-clamp-2 leading-relaxed">
                        {product.materialSpec}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#121417]/8">
                      <div>
                        <p className="font-mono text-[15px] font-medium tabular-nums text-[#121417]">
                          {formatMoney(product.priceCents)}
                        </p>
                        <p className="text-xs text-[#555E59] font-mono tabular-nums">
                          {product.storeRating > 0 ? `★ ${product.storeRating.toFixed(1)}` : 'New Studio'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectProduct(product)}
                          className="h-9 px-3 rounded-lg border border-[#121417]/12 text-xs font-medium text-[#121417] hover:bg-[#F6F7F5] transition-colors whitespace-nowrap"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          disabled={outOfStock}
                          onClick={() => onAddToBag(product, 1)}
                          className="h-9 px-3.5 rounded-lg bg-[#0F5132] text-white text-xs font-medium hover:bg-[#0B3D26] disabled:bg-[#121417]/20 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {outOfStock ? 'Out' : 'Add to Bag'}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 3: Verified Stores & Community Ratings Directory */}
      <section id="verified-stores" className="max-w-7xl mx-auto px-6 scroll-mt-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#121417]/10">
          <div>
            <h2 className="font-editorial text-3xl font-medium tracking-tight text-[#121417]">
              Verified Stores &amp; Ratings Directory
            </h2>
            <p className="text-sm text-[#555E59] mt-1.5">
              Search partner studios by name or address and submit or update your 1–5 rating.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#76807A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="Filter by studio name or address..."
                aria-label="Search stores by name or address"
                className="w-full sm:w-64 h-10 pl-9 pr-3 rounded-lg border border-[#121417]/12 bg-white text-sm text-[#121417] placeholder:text-[#76807A] focus:outline-none focus:border-[#0F5132]"
              />
            </div>

            <div className="inline-flex items-center gap-2 border border-[#121417]/12 rounded-lg bg-white px-3 h-10">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#555E59] shrink-0" />
              <select
                aria-label="Sort stores"
                value={storeSort}
                onChange={(e) =>
                  setStoreSort(e.target.value as 'rating-desc' | 'name-asc' | 'reviews-desc')
                }
                className="bg-transparent text-sm text-[#121417] focus:outline-none pr-1"
              >
                <option value="rating-desc">Highest Rated</option>
                <option value="reviews-desc">Most Reviewed</option>
                <option value="name-asc">Store Name (A–Z)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white border border-[#121417]/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#121417]/10 bg-[#F6F7F5] text-xs font-medium text-[#555E59]">
                  <th className="py-3.5 px-5">Store &amp; Craft</th>
                  <th className="py-3.5 px-5">Studio Address</th>
                  <th className="py-3.5 px-5 text-right">Overall Rating</th>
                  <th className="py-3.5 px-5 text-right">Your Rating</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121417]/10 text-sm">
                {filteredStores.map((store) => {
                  const isExpanded = expandedStoreId === store.id;
                  return (
                    <tr
                      key={store.id}
                      className="hover:bg-[#F6F7F5]/60 transition-colors align-top"
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3.5">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#ECEEE9] shrink-0">
                            <SafeImage
                              src={store.coverImage}
                              alt={store.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-[#121417]">{store.name}</p>
                            <p className="text-xs text-[#555E59] mt-0.5">{store.category}</p>
                            <button
                              type="button"
                              onClick={() => setExpandedStoreId(isExpanded ? null : store.id)}
                              className="text-xs text-[#0F5132] hover:underline mt-1.5"
                            >
                              {isExpanded
                                ? 'Hide studio notes'
                                : `Read ${store.ratingCount} verified ${store.ratingCount === 1 ? 'review' : 'reviews'}`}
                            </button>
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-[#121417]/10 space-y-2 max-w-md">
                                <p className="text-xs text-[#424A45] leading-relaxed">
                                  {store.description}
                                </p>
                                {store.recentReviews.slice(0, 3).map((rev) => (
                                  <div key={rev.id} className="text-xs text-[#424A45]">
                                    <span className="font-medium text-[#121417]">
                                      {rev.userName}
                                    </span>{' '}
                                    <span className="font-mono tabular-nums text-[#0F5132]">
                                      ({rev.score}.0/5)
                                    </span>
                                    {rev.comment ? ` — ${rev.comment}` : ''}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[#424A45]">
                        <p>{store.address}</p>
                        <p className="text-xs text-[#555E59] mt-0.5">{store.email}</p>
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Star className="w-4 h-4 fill-[#0F5132] text-[#0F5132]" />
                          <span className="font-mono font-medium tabular-nums text-[#121417]">
                            {store.averageRating > 0 ? store.averageRating.toFixed(2) : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-[#555E59] font-mono tabular-nums mt-0.5">
                          {store.ratingCount} {store.ratingCount === 1 ? 'review' : 'reviews'}
                        </p>
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap font-mono tabular-nums">
                        {store.userRating ? (
                          <span className="font-medium text-[#0F5132]">
                            {store.userRating.score}.0 / 5
                          </span>
                        ) : (
                          <span className="text-[#76807A]">Not rated</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenRating(store)}
                          className="h-9 px-3.5 rounded-lg border border-[#121417]/15 text-xs font-medium text-[#121417] hover:border-[#0F5132] hover:text-[#0F5132] transition-colors whitespace-nowrap"
                        >
                          {store.userRating ? 'Modify Rating' : 'Rate Store'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredStores.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-[#555E59]">
                      No partner stores matched “{storeSearch}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

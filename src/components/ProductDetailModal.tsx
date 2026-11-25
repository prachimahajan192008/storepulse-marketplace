import { useState } from 'react';
import { Minus, Plus, Star, X } from 'lucide-react';
import { ProductItem, StoreSummary } from '../types/storepulse';
import { formatMoney } from '../lib/format';
import { SafeImage } from './SafeImage';

interface ProductDetailModalProps {
  product: ProductItem | null;
  store: StoreSummary | null;
  onClose: () => void;
  onAddToBag: (product: ProductItem, quantity: number) => void;
  onOpenRating: (store: StoreSummary) => void;
}

export function ProductDetailModal({
  product,
  store,
  onClose,
  onAddToBag,
  onOpenRating,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const maxQty = Math.max(1, Math.min(product.stock, 10));
  const outOfStock = product.stock <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#121417]/50 backdrop-blur-[2px] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#F6F7F5] border border-[#121417]/10 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-4 right-4 z-10 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/90 text-[#121417] hover:bg-white transition-colors focus-visible:outline-2 focus-visible:outline-[#0F5132]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-6 bg-[#ECEEE9] flex flex-col">
            <div className="aspect-[4/3] md:aspect-auto md:h-full w-full overflow-hidden">
              <SafeImage
                src={product.imageUrl}
                alt={product.name}
                fallbackTitle={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#555E59]">
                <span className="font-medium text-[#121417]">{product.storeName}</span>
                <span aria-hidden="true">·</span>
                <span>{product.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{product.sku}</span>
              </div>

              <h2
                id="pdp-title"
                className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#121417] leading-tight"
              >
                {product.name}
              </h2>

              <div className="flex items-baseline justify-between gap-4 border-b border-[#121417]/10 pb-4">
                <p className="font-mono text-2xl font-medium tabular-nums text-[#121417]">
                  {formatMoney(product.priceCents)}
                </p>
                <div className="flex items-center gap-1.5 text-sm text-[#424A45]">
                  <Star className="w-4 h-4 fill-[#0F5132] text-[#0F5132]" />
                  <span className="font-mono tabular-nums font-medium text-[#121417]">
                    {product.storeRating > 0 ? product.storeRating.toFixed(1) : 'New'}
                  </span>
                  <span className="text-xs text-[#555E59]">
                    ({product.storeRatingCount} verified{' '}
                    {product.storeRatingCount === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              </div>

              <p className="text-[15px] leading-relaxed text-[#343B37]">
                {product.description}
              </p>

              <dl className="grid grid-cols-1 gap-2.5 pt-2 text-sm border-t border-[#121417]/10">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#555E59]">Edition</dt>
                  <dd className="font-medium text-[#121417] text-right">{product.variantLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#555E59]">Materials</dt>
                  <dd className="font-medium text-[#121417] text-right">{product.materialSpec}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#555E59]">Dimensions</dt>
                  <dd className="font-medium text-[#121417] text-right">{product.dimensions}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#555E59]">Availability</dt>
                  <dd className="font-mono tabular-nums font-medium text-right text-[#0F5132]">
                    {outOfStock ? 'Sold Out' : `${product.stock} in stock`}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#121417]/10">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center border border-[#121417]/15 rounded-lg bg-white h-11">
                  <button
                    type="button"
                    disabled={outOfStock || quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="w-10 h-full inline-flex items-center justify-center text-[#121417] disabled:opacity-35 hover:bg-[#F6F7F5] rounded-l-lg transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center font-mono text-sm tabular-nums font-medium">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={outOfStock || quantity >= maxQty}
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    aria-label="Increase quantity"
                    className="w-10 h-full inline-flex items-center justify-center text-[#121417] disabled:opacity-35 hover:bg-[#F6F7F5] rounded-r-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => {
                    onAddToBag(product, quantity);
                    onClose();
                  }}
                  className="flex-1 h-11 px-6 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] disabled:bg-[#121417]/20 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {outOfStock
                    ? 'Currently Sold Out'
                    : `Add to Bag · ${formatMoney(product.priceCents * quantity)}`}
                </button>
              </div>

              {store && (
                <div className="flex items-center justify-between text-xs text-[#555E59] pt-1">
                  <span>Ships directly from {store.city}. Free over $150.</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRating(store);
                    }}
                    className="font-medium text-[#0F5132] hover:underline whitespace-nowrap shrink-0"
                  >
                    {store.userRating ? 'Update your store rating' : 'Rate this studio'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

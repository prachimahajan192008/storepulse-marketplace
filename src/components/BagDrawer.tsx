import React, { useEffect, useState } from 'react';
import { CheckCircle2, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { CartLine, OrderRecord, PaymentMethod } from '../types/storepulse';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatMoney, formatPaymentLabel } from '../lib/format';
import { SafeImage } from './SafeImage';

const FREE_SHIPPING_THRESHOLD_CENTS = 15000;
const FLAT_SHIPPING_CENTS = 1400;

interface BagDrawerProps {
  open: boolean;
  items: CartLine[];
  onClose: () => void;
  onUpdateQty: (productId: number, delta: number) => void;
  onRemove: (productId: number) => void;
  onClearBag: () => void;
  onOrderComplete: (order: OrderRecord) => Promise<void>;
}

export function BagDrawer({
  open,
  items,
  onClose,
  onUpdateQty,
  onRemove,
  onClearBag,
  onOrderComplete,
}: BagDrawerProps) {
  const { profile, signInWithGoogle, getToken } = useAuth();
  const [step, setStep] = useState<'bag' | 'checkout' | 'confirmed'>('bag');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    if (profile) {
      setCustomerName((prev) => prev || profile.name);
      setShippingAddress((prev) => prev || profile.address);
    }
  }, [profile]);

  useEffect(() => {
    if (!open) {
      setError(null);
      if (step === 'confirmed') {
        setStep('bag');
        setConfirmedOrder(null);
      }
    }
  }, [open, step]);

  if (!open) return null;

  const subtotalCents = items.reduce(
    (sum, line) => sum + line.product.priceCents * line.quantity,
    0
  );
  const shippingCents =
    items.length === 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : FLAT_SHIPPING_CENTS;
  const totalCents = subtotalCents + shippingCents;
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        setError('Please sign in with Google to place your order.');
        return;
      }

      const response = await apiFetch<{ order: OrderRecord }>('/api/orders', {
        method: 'POST',
        token,
        body: {
          customerName,
          phone,
          shippingAddress,
          postalCode,
          paymentMethod,
          items: items.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        },
      });

      setConfirmedOrder(response.order);
      onClearBag();
      setStep('confirmed');
      await onOrderComplete(response.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to place order right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#121417]/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping bag"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-[#F6F7F5] border-l border-[#121417]/10 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#121417]/10">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#0F5132]" strokeWidth={1.75} />
            <h2 className="text-lg font-semibold text-[#121417]">
              {step === 'bag' && 'Shopping Bag'}
              {step === 'checkout' && 'Delivery & Payment'}
              {step === 'confirmed' && 'Order Confirmed'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bag"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[#424A45] hover:bg-[#121417]/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'confirmed' && confirmedOrder ? (
            <div className="space-y-6">
              <div className="bg-white border border-[#0F5132]/20 rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-[#0F5132]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-semibold">
                    Order #{confirmedOrder.orderNumber} Confirmed — Preparing Shipment
                  </span>
                </div>
                <p className="text-sm text-[#424A45] leading-relaxed">
                  We have notified the partner studio and reserved your inventory. You can track
                  fulfillment status anytime under Account Orders.
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <h3 className="font-semibold text-[#121417]">Receipt Summary</h3>
                <ul className="divide-y divide-[#121417]/10 border-y border-[#121417]/10">
                  {confirmedOrder.items.map((item) => (
                    <li key={item.id} className="py-3 flex items-center justify-between gap-4">
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

                <dl className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[#555E59]">
                    <dt>Payment Method</dt>
                    <dd className="text-[#121417] font-medium">
                      {formatPaymentLabel(confirmedOrder.paymentMethod)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-[#555E59]">
                    <dt>Deliver To</dt>
                    <dd className="text-[#121417] text-right max-w-[220px]">
                      {confirmedOrder.shippingAddress}, {confirmedOrder.postalCode}
                    </dd>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#121417]/10 text-base font-semibold text-[#121417]">
                    <dt>Total</dt>
                    <dd className="font-mono tabular-nums">
                      {formatMoney(confirmedOrder.totalCents)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <ShoppingBag className="w-8 h-8 text-[#121417]/25 mb-3" strokeWidth={1.5} />
              <p className="text-base font-medium text-[#121417]">Your bag is empty</p>
              <p className="text-sm text-[#555E59] mt-1 max-w-xs">
                Explore small-batch studio objects from our verified independent makers.
              </p>
            </div>
          ) : step === 'bag' ? (
            <div className="space-y-5">
              <div className="text-xs text-[#424A45] bg-white border border-[#121417]/10 rounded-lg px-3.5 py-2.5">
                {remainingForFreeShipping === 0
                  ? 'Complimentary tracked courier shipping unlocked on this order.'
                  : `Add ${formatMoney(remainingForFreeShipping)} more for complimentary tracked shipping ($150 threshold).`}
              </div>

              <ul className="divide-y divide-[#121417]/10">
                {items.map((line) => (
                  <li key={line.product.id} className="py-4 first:pt-0 flex gap-4">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#ECEEE9] shrink-0">
                      <SafeImage
                        src={line.product.imageUrl}
                        alt={line.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-[#555E59] truncate">{line.product.storeName}</p>
                          <p className="text-sm font-semibold text-[#121417] truncate">
                            {line.product.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemove(line.product.id)}
                          aria-label={`Remove ${line.product.name}`}
                          className="p-1 text-[#76807A] hover:text-[#9B2C2C] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="inline-flex items-center border border-[#121417]/15 rounded-md bg-white h-8">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(line.product.id, -1)}
                            aria-label="Decrease quantity"
                            className="w-7 h-full inline-flex items-center justify-center hover:bg-[#F6F7F5]"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center font-mono text-xs tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={line.quantity >= line.product.stock}
                            onClick={() => onUpdateQty(line.product.id, 1)}
                            aria-label="Increase quantity"
                            className="w-7 h-full inline-flex items-center justify-center hover:bg-[#F6F7F5] disabled:opacity-30"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="font-mono text-sm tabular-nums font-medium text-[#121417]">
                          {formatMoney(line.product.priceCents * line.quantity)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <form id="checkout-form" onSubmit={handleCheckout} className="space-y-4">
              {!profile && (
                <div className="bg-white border border-[#121417]/10 rounded-lg p-4 space-y-2.5">
                  <p className="text-sm font-medium text-[#121417]">
                    Sign in to bind this order to your account
                  </p>
                  <p className="text-xs text-[#555E59]">
                    Orders are saved to your StorePulse profile for shipment tracking and verified
                    store reviews.
                  </p>
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] transition-colors"
                  >
                    Sign In with Google
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="chk-name" className="block text-xs font-medium text-[#424A45] mb-1">
                  Recipient Full Name
                </label>
                <input
                  id="chk-name"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full h-10 rounded-lg border border-[#121417]/15 bg-white px-3 text-sm focus:outline-none focus:border-[#0F5132]"
                />
              </div>

              <div>
                <label htmlFor="chk-phone" className="block text-xs font-medium text-[#424A45] mb-1">
                  Contact Phone
                </label>
                <input
                  id="chk-phone"
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full h-10 rounded-lg border border-[#121417]/15 bg-white px-3 text-sm focus:outline-none focus:border-[#0F5132]"
                />
              </div>

              <div>
                <label htmlFor="chk-addr" className="block text-xs font-medium text-[#424A45] mb-1">
                  Delivery Street Address
                </label>
                <textarea
                  id="chk-addr"
                  required
                  rows={2}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="418 NW 11th Ave, Apt 3B, Portland, OR"
                  className="w-full rounded-lg border border-[#121417]/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#0F5132]"
                />
              </div>

              <div>
                <label htmlFor="chk-zip" className="block text-xs font-medium text-[#424A45] mb-1">
                  Postal Code
                </label>
                <input
                  id="chk-zip"
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="97209"
                  className="w-full h-10 rounded-lg border border-[#121417]/15 bg-white px-3 text-sm font-mono focus:outline-none focus:border-[#0F5132]"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-[#424A45] mb-1.5">
                  Payment Method
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      {
                        id: 'COD',
                        title: 'Cash on Delivery',
                        note: 'Pay courier in cash when your parcel arrives.',
                      },
                      {
                        id: 'CARD_ON_DELIVERY',
                        title: 'Card on Delivery',
                        note: 'Tap contactless card on courier terminal at delivery.',
                      },
                      {
                        id: 'BANK_TRANSFER',
                        title: 'Direct Bank Transfer',
                        note: 'Receive studio invoice and wire reference after confirmation.',
                      },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        paymentMethod === option.id
                          ? 'border-[#0F5132] bg-white'
                          : 'border-[#121417]/10 bg-white/60 hover:bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === option.id}
                        onChange={() => setPaymentMethod(option.id)}
                        className="mt-0.5 accent-[#0F5132]"
                      />
                      <div>
                        <p className="text-sm font-medium text-[#121417]">{option.title}</p>
                        <p className="text-xs text-[#555E59]">{option.note}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-[#9B2C2C]">{error}</p>}
            </form>
          )}
        </div>

        {step !== 'confirmed' && items.length > 0 && (
          <div className="border-t border-[#121417]/10 px-6 py-5 bg-white space-y-4">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#555E59]">
                <dt>Subtotal</dt>
                <dd className="font-mono tabular-nums text-[#121417]">
                  {formatMoney(subtotalCents)}
                </dd>
              </div>
              <div className="flex justify-between text-[#555E59]">
                <dt>Tracked Courier</dt>
                <dd className="font-mono tabular-nums text-[#121417]">
                  {shippingCents === 0 ? 'Complimentary' : formatMoney(shippingCents)}
                </dd>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#121417]/10 font-semibold text-[#121417]">
                <dt>Order Total</dt>
                <dd className="font-mono tabular-nums">{formatMoney(totalCents)}</dd>
              </div>
            </dl>

            {step === 'bag' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full h-11 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] transition-colors"
              >
                Proceed to Checkout
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('bag')}
                  className="h-11 px-4 rounded-lg border border-[#121417]/15 text-sm font-medium text-[#121417] hover:bg-[#F6F7F5] transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={submitting || !profile}
                  className="flex-1 h-11 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] disabled:opacity-45 transition-colors whitespace-nowrap"
                >
                  {submitting ? 'Confirming Order...' : `Confirm Order · ${formatMoney(totalCents)}`}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'confirmed' && (
          <div className="border-t border-[#121417]/10 px-6 py-4 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-lg bg-[#121417] text-white text-sm font-medium hover:bg-[#23282D] transition-colors"
            >
              Continue Exploring
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

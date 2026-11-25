import React, { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { StoreSummary } from '../types/storepulse';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatDate } from '../lib/format';

interface RatingModalProps {
  store: StoreSummary | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function RatingModal({ store, onClose, onSaved }: RatingModalProps) {
  const { profile, signInWithGoogle, getToken } = useAuth();
  const [score, setScore] = useState(5);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (store) {
      setScore(store.userRating?.score ?? 5);
      setComment(store.userRating?.comment ?? '');
      setError(null);
    }
  }, [store]);

  if (!store) return null;

  const activeScore = hoverScore ?? score;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        setError('Please sign in first to submit a rating.');
        return;
      }
      await apiFetch('/api/ratings', {
        method: 'POST',
        token,
        body: {
          storeId: store.id,
          score,
          comment,
        },
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save rating.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#121417]/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#F6F7F5] border border-[#121417]/10 rounded-xl shadow-2xl p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#121417]/10">
          <div>
            <p className="text-xs text-[#555E59] mb-1">
              {store.category} · {store.city}
            </p>
            <h2 id="rating-modal-title" className="text-2xl font-semibold text-[#121417]">
              {store.name}
            </h2>
            <p className="text-xs text-[#555E59] mt-1">{store.address}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rating dialog"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[#424A45] hover:bg-[#121417]/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 border-b border-[#121417]/10">
          {profile ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#121417] mb-2">
                  {store.userRating ? 'Update your verified rating' : 'Rate this store (1 to 5)'}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onMouseEnter={() => setHoverScore(value)}
                      onMouseLeave={() => setHoverScore(null)}
                      onClick={() => setScore(value)}
                      aria-label={`Rate ${value} out of 5`}
                      className="w-11 h-11 inline-flex items-center justify-center rounded-lg border border-[#121417]/10 bg-white hover:border-[#0F5132]/40 transition-colors focus-visible:outline-2 focus-visible:outline-[#0F5132]"
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          value <= activeScore
                            ? 'fill-[#0F5132] text-[#0F5132]'
                            : 'text-[#121417]/25'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 font-mono text-sm tabular-nums text-[#424A45]">
                    {activeScore}.0 / 5.0
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="rating-comment"
                  className="block text-sm font-medium text-[#121417] mb-1.5"
                >
                  Review note (optional)
                </label>
                <textarea
                  id="rating-comment"
                  rows={3}
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share packaging quality, craftsmanship, or shipping speed..."
                  className="w-full rounded-lg border border-[#121417]/15 bg-white px-3.5 py-2.5 text-sm text-[#121417] placeholder:text-[#76807A] focus:outline-none focus:border-[#0F5132]"
                />
              </div>

              {error && <p className="text-sm text-[#9B2C2C]">{error}</p>}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-[#424A45] hover:text-[#121417] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {submitting
                    ? 'Saving...'
                    : store.userRating
                      ? 'Update Rating'
                      : 'Submit Rating'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#121417]/10 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-[#121417]">Sign in to rate {store.name}</p>
                <p className="text-xs text-[#555E59] mt-0.5">
                  Verified ratings are linked to your member account and can be updated anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="px-4 py-2.5 rounded-lg bg-[#0F5132] text-white text-sm font-medium hover:bg-[#0B3D26] transition-colors whitespace-nowrap shrink-0"
              >
                Sign In with Google
              </button>
            </div>
          )}
        </div>

        <div className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#121417]">Recent Verified Reviews</h3>
            <span className="font-mono text-xs tabular-nums text-[#555E59]">
              {store.averageRating > 0
                ? `${store.averageRating.toFixed(1)} avg · ${store.ratingCount} total`
                : 'No ratings yet'}
            </span>
          </div>

          {store.recentReviews.length === 0 ? (
            <p className="text-sm text-[#555E59]">Be the first verified member to review this studio.</p>
          ) : (
            <ul className="divide-y divide-[#121417]/10">
              {store.recentReviews.map((review) => (
                <li key={review.id} className="py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[#121417]">{review.userName}</span>
                    <div className="flex items-center gap-2 text-xs text-[#555E59]">
                      <span className="font-mono tabular-nums font-medium text-[#0F5132]">
                        {review.score}.0 / 5
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(review.updatedAt)}</span>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-[#424A45] mt-1 leading-relaxed">{review.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

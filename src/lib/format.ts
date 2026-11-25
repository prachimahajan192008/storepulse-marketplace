export function formatMoney(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatRoleLabel(role: string): string {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return 'System Admin';
    case 'STORE_OWNER':
      return 'Store Owner';
    default:
      return 'Member';
  }
}

export function formatPaymentLabel(method: string): string {
  switch (method) {
    case 'UPI':
      return 'UPI (GPay / PhonePe / Paytm)';
    case 'COD':
      return 'Cash on Delivery';
    case 'CARD_ON_DELIVERY':
      return 'Card / UPI on Delivery';
    case 'BANK_TRANSFER':
      return 'NEFT / IMPS Bank Transfer';
    default:
      return method;
  }
}

export function formatStatusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmed';
    case 'PREPARING':
      return 'Preparing Shipment';
    case 'SHIPPED':
      return 'Dispatched';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

export async function apiFetch<T>(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return payload as T;
}

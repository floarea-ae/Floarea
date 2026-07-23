export const CART_ATTRIBUTE_KEYS = {
  DELIVERY_DATE: 'Delivery Date',
  DELIVERY_TIME: 'Delivery Time',
  GIFT_NOTE: 'Gift Note',
} as const;

export const DELIVERY_SLOTS = [
  { label: '9 AM to 12 PM', endHour: 12 },
  { label: '12 PM to 3 PM', endHour: 15 },
  { label: '3 PM to 6 PM', endHour: 18 },
  { label: '6 PM to 9 PM', endHour: 21 },
  { label: '9 PM to 12 AM', endHour: 24 },
] as const;

export const FREE_DELIVERY_THRESHOLD = 500;
export const STANDARD_DELIVERY_FEE = 35;

// TODO(Phase 6 - Gift Wrapping): replace with the real gift-wrap product variant GID
// once confirmed with the store. Not read by any Phase 1-5 code path.
export const GIFT_WRAP_VARIANT_ID = '';

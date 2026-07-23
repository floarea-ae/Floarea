export type Money = {
  amount: string;
  currency_code: string;
};

export type CartAttribute = {
  key: string;
  value: string;
};

export type CartLine = {
  line_id: string;
  merchandise_id: string;
  quantity: number;
  title: string;
  variant_title: string | null;
  image: string | null;
  price: Money;
  line_total: Money;
  attributes: CartAttribute[];
};

export type BuyerIdentity = {
  customer_access_token_present: boolean;
  email: string | null;
  phone: string | null;
};

export type CartCost = {
  subtotal_amount: string;
  total_amount: string;
  total_tax: string;
  currency_code: string;
};

export type Cart = {
  cart_id: string;
  checkout_url: string;
  note: string;
  attributes: CartAttribute[];
  buyer_identity: BuyerIdentity;
  lines: CartLine[];
  cost: CartCost;
  total_quantity: number;
};

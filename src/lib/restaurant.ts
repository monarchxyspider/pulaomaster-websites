export type Dish = {
  id: string;
  databaseKey?: string;
  name: string;
  price: number;
  img: string;
  description: string;
  category: string;
  available: boolean;
  sortOrder: number;
};

export const defaultDishes: Array<Omit<Dish, "databaseKey">> = [
  {
    id: "special-chicken-yakhni-pulao",
    name: "Special Chicken Yakhni Pulao",
    price: 480,
    img: "/images/pulao-hero.jpg",
    description: "Our master recipe: long-grain aged basmati rice infused with slow-simmered bone broth (yakhni), golden fried onions, and succulent chicken.",
    category: "Pulao",
    available: true,
    sortOrder: 1,
  },
  {
    id: "special-kabuli-pulao",
    name: "Special Afghani Kabuli Pulao",
    price: 750,
    img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=85",
    description: "Traditional sweet-and-savory Afghani delicacy garnished with caramelized carrots, plump raisins, and tender braised meat.",
    category: "Pulao",
    available: true,
    sortOrder: 2,
  },
  {
    id: "mutton-yakhni-pulao",
    name: "Royal Mutton Yakhni Pulao",
    price: 950,
    img: "/images/pulao-hero.jpg",
    description: "Aromatic basmati rice cooked in rich, concentrated mutton broth with melt-in-your-mouth mutton cuts and whole spices.",
    category: "Pulao",
    available: true,
    sortOrder: 3,
  },
  {
    id: "bannu-beef-pulao",
    name: "Bannu Beef Pulao",
    price: 680,
    img: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85",
    description: "Authentic Khyber-style beef pulao made with marrow-infused stock and tender beef chunks.",
    category: "Pulao",
    available: true,
    sortOrder: 4,
  },
  {
    id: "chicken-shinwari-karahi",
    name: "Chicken Shinwari Karahi",
    price: 1550,
    img: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85",
    description: "Authentic Peshawari Shinwari style cooked in pure tomatoes, green chilies, and black pepper in a sizzling iron wok.",
    category: "Karahi",
    available: true,
    sortOrder: 5,
  },
  {
    id: "chicken-mutton-karahi",
    name: "Special Desi Mutton Karahi",
    price: 2200,
    img: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85",
    description: "Fresh mutton slow-cooked in traditional Lahori masala, fresh ginger juliennes, and rich desi butter.",
    category: "Karahi",
    available: true,
    sortOrder: 6,
  },
  {
    id: "special-bbq-platter",
    name: "Master BBQ Platter",
    price: 1400,
    img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=85",
    description: "A feast of seekh kebabs, chicken malai boti, reshmi kabab, and spicy tikka char-grilled to perfection.",
    category: "BBQ",
    available: true,
    sortOrder: 7,
  },
  {
    id: "chicken-biryani-dum",
    name: "Special Chicken Dum Biryani",
    price: 380,
    img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=85",
    description: "Layered saffron basmati rice with spicy marinated chicken, mint, coriander, and steamed under traditional dum.",
    category: "Biryani",
    available: true,
    sortOrder: 8,
  },
  {
    id: "fresh-mint-raita-salad",
    name: "Mint Raita & Fresh Kachumber Salad",
    price: 120,
    img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85",
    description: "Chilled whipped yogurt infused with fresh mint and roasted zeera, served with diced fresh salad.",
    category: "Sides & Drinks",
    available: true,
    sortOrder: 9,
  },
  {
    id: "special-desi-sweet-lassi",
    name: "Special Malai Lassi / Cold Drinks",
    price: 180,
    img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=85",
    description: "Traditional chilled creamy sweet lassi with fresh malai topping or choice of chilled soft drinks.",
    category: "Sides & Drinks",
    available: true,
    sortOrder: 10,
  },
];

export const defaultAdminEmails = [
  "raffaysweet@gmail.com",
  "pulaomaster.com@gmail.com",
];

export function isApprovedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return defaultAdminEmails.includes(normalized);
}

export type PublicSettings = {
  restaurantName: string;
  tagline: string;
  contactNumber: string;
  whatsappNumber: string;
  address: string;
  openingHours: string;
  deliveryFee: number;
  deliveryFeeEnabled: boolean;
  menuVisible: boolean;
};

export type OrderStatus = "Pending" | "Confirmed" | "Preparing" | "Ready for Delivery" | "Completed" | "Cancelled";

export type OrderLine = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

export type OrderRecord = {
  id: string;
  databaseKey: string;
  customer: { name: string; phone: string; address: string };
  items: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  deliveryFeeConfigured: boolean;
  total: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt?: number;
  deliveryInstructions?: string;
};

export type TrackingAccess = { orderId: string; token: string };

export const defaultSettings: PublicSettings = {
  restaurantName: "Pulao Master",
  tagline: "The House of Pure Tradition and Taste.",
  contactNumber: "03009263111",
  whatsappNumber: "923009263111",
  address: "Lahore, Pakistan",
  openingHours: "",
  deliveryFee: 0,
  deliveryFeeEnabled: false,
  menuVisible: true,
};

export const orderStatuses: OrderStatus[] = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Ready for Delivery",
  "Completed",
  "Cancelled",
];

export function formatPrice(amount: number): string {
  return `Rs. ${Math.max(0, Number.isFinite(amount) ? amount : 0).toLocaleString("en-PK")}`;
}

export function cleanPhone(value: string): string {
  return value.replace(/[\s()-]/g, "");
}

export function isValidPakistaniPhone(value: string): boolean {
  return /^(?:03\d{9}|\+?923\d{9})$/.test(cleanPhone(value));
}

export function normalizeDish(key: string, value: Record<string, unknown>): Dish | null {
  const price = Number(value.price);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const image = typeof value.img === "string" ? value.img : typeof value.imageUrl === "string" ? value.imageUrl : "";
  if (!name || !Number.isFinite(price) || price < 0) return null;

  const category = typeof value.category === "string" && value.category.trim()
    ? value.category.trim()
    : inferCategory(name);

  return {
    id: typeof value.id === "string" ? value.id : key,
    databaseKey: key,
    name,
    price,
    img: image,
    description: typeof value.description === "string" ? value.description : "",
    category,
    available: value.available !== false,
    sortOrder: Number.isFinite(Number(value.sortOrder)) ? Number(value.sortOrder) : 999,
  };
}

function inferCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("pulao") || lower.includes("kabli") || lower.includes("kabuli") || lower.includes("yakhni")) return "Pulao";
  if (lower.includes("karahi") || lower.includes("shinwari") || lower.includes("handi")) return "Karahi";
  if (lower.includes("biryani")) return "Biryani";
  if (lower.includes("bbq") || lower.includes("barbecue") || lower.includes("kabab") || lower.includes("boti") || lower.includes("tikka")) return "BBQ";
  if (lower.includes("drink") || lower.includes("beverage") || lower.includes("lassi") || lower.includes("raita") || lower.includes("salad")) return "Sides & Drinks";
  return "Traditional Dishes";
}

export function makeTrackingToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
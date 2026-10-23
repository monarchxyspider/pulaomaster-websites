const crypto = require("node:crypto");
const { getAuth } = require("firebase-admin/auth");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const REGION = "us-central1";
const DATABASE_URL = process.env.DATABASE_URL || "https://resturant-db-f2cd9-default-rtdb.firebaseio.com";

if (!getApps().length) {
  initializeApp({ databaseURL: DATABASE_URL });
}

const database = getDatabase();
const auth = getAuth();

const defaultDishes = [
  {
    id: "chicken-mutton-karahi",
    name: "Chicken Mutton Karahi",
    price: 1800,
    img: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85",
    description: "",
    category: "Karahi",
    available: true,
    sortOrder: 1,
  },
  {
    id: "special-bbq-platter",
    name: "Special BBQ Platter",
    price: 1400,
    img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=85",
    description: "",
    category: "BBQ",
    available: true,
    sortOrder: 2,
  },
  {
    id: "chicken-biryani",
    name: "Chicken Biryani",
    price: 350,
    img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=85",
    description: "",
    category: "Biryani",
    available: true,
    sortOrder: 3,
  },
];

const initialPublicSettings = {
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

const supportedStatuses = ["Pending", "Confirmed", "Preparing", "Ready for Delivery", "Completed", "Cancelled"];

function fail(code, message) {
  throw new HttpsError(code, message);
}

function allowedEmails() {
  return new Set((process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean));
}

function validAdminIdentity(request) {
  const email = String(request.auth?.token?.email || "").trim().toLowerCase();
  return Boolean(
    request.auth
    && request.auth.token.email_verified === true
    && email
    && allowedEmails().has(email),
  );
}

async function assertAdmin(request) {
  if (!request.auth) fail("unauthenticated", "Sign in with an approved Google account to continue.");
  if (!validAdminIdentity(request)) fail("permission-denied", "This Google account is not approved for administrator access.");

  const claims = request.auth.token || {};
  if (claims.admin !== true || Number(claims.adminUntil) <= Date.now()) {
    fail("permission-denied", "Administrator access expired. Sign in again to continue.");
  }
  return request.auth.uid;
}

function normalizePlainText(value, field, maxLength, required = false) {
  if (typeof value !== "string") fail("invalid-argument", `${field} must be text.`);
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (required && cleaned.length === 0) fail("invalid-argument", `${field} is required.`);
  if (cleaned.length > maxLength) fail("invalid-argument", `${field} must be ${maxLength} characters or fewer.`);
  return cleaned;
}

function safeDishKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    fail("invalid-argument", "A valid menu item identifier is required.");
  }
  return value;
}

function normalizedName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function validateToken(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    fail("invalid-argument", "The private tracking key is invalid.");
  }
  return value.toLowerCase();
}

function validateOrderId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    fail("invalid-argument", "A valid order ID is required.");
  }
  return value;
}

function safeOrderKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    fail("invalid-argument", "A valid order record key is required.");
  }
  return value;
}

async function clearAdminClaims(uid) {
  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims || {}) };
  const hadAdminAccess = claims.admin === true || claims.adminUntil !== undefined;
  delete claims.admin;
  delete claims.adminUntil;
  if (hadAdminAccess) {
    await auth.setCustomUserClaims(uid, claims);
    await auth.revokeRefreshTokens(uid);
  }
}

async function ensureCustomerOrderNodes(orderId, order) {
  const customerStatus = {
    orderId,
    status: order.status,
    itemCount: (order.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0),
    total: Number(order.total) || 0,
    createdAt: Number(order.createdAt) || Date.now(),
    updatedAt: Number(order.updatedAt) || Number(order.createdAt) || Date.now(),
    chatClosed: order.status === "Completed" || order.status === "Cancelled",
  };
  await Promise.all([
    database.ref(`orderStatus/${orderId}`).transaction((current) => current || customerStatus),
    database.ref(`chats/${orderId}/meta`).transaction((current) => current || {
      closed: customerStatus.chatClosed,
      createdAt: customerStatus.createdAt,
    }),
  ]);
}

exports.ensureInitialData = onCall({ region: REGION }, async () => {
  const dishesRef = database.ref("dishes");
  const existingSnapshot = await dishesRef.once("value");
  const existing = existingSnapshot.val() || {};
  const seenNames = new Set(Object.values(existing).map((dish) => normalizedName(dish?.name)).filter(Boolean));
  let seededCount = 0;

  for (const dish of defaultDishes) {
    if (seenNames.has(normalizedName(dish.name))) continue;
    const result = await dishesRef.child(dish.id).transaction((current) => current || dish);
    if (result.committed) seededCount += 1;
    seenNames.add(normalizedName(dish.name));
  }

  const settingsRef = database.ref("settings/public");
  await settingsRef.transaction((current) => ({ ...initialPublicSettings, ...(current || {}) }));
  return { seeded: seededCount > 0, seededCount };
});

exports.claimAdminAccess = onCall({ region: REGION }, async (request) => {
  if (!request.auth) fail("unauthenticated", "Sign in with Google before requesting owner access.");
  const user = await auth.getUser(request.auth.uid);
  const verifiedEmail = String(user.email || request.auth.token.email || "").trim().toLowerCase();
  const approved = user.emailVerified === true && allowedEmails().has(verifiedEmail);

  if (!approved) {
    await clearAdminClaims(request.auth.uid);
    return { approved: false, reason: "Access denied. This verified Google account is not on the administrator allowlist." };
  }

  const existingClaims = { ...(user.customClaims || {}) };
  await auth.setCustomUserClaims(request.auth.uid, {
    ...existingClaims,
    admin: true,
    adminUntil: Date.now() + 15 * 60 * 1000,
  });
  return { approved: true };
});

exports.createOrder = onCall({ region: REGION }, async (request) => {
  const body = request.data || {};
  const requestKey = typeof body.requestKey === "string" ? body.requestKey : "";
  if (!/^[0-9a-f-]{36}$/i.test(requestKey)) fail("invalid-argument", "Order request reference is invalid. Please retry checkout.");

  const trackingToken = validateToken(body.trackingToken);
  const tokenHash = hashToken(trackingToken);
  const customerInput = body.customer && typeof body.customer === "object" ? body.customer : {};
  const name = normalizePlainText(customerInput.name, "Customer name", 80, true);
  const phone = normalizePlainText(customerInput.phone, "Phone number", 24, true).replace(/[\s()-]/g, "");
  if (!/^(?:03\d{9}|\+?923\d{9})$/.test(phone)) fail("invalid-argument", "Enter a valid Pakistani mobile number, such as 03001234567.");
  const address = normalizePlainText(customerInput.address, "Delivery address", 350, true);
  if (address.length < 8) fail("invalid-argument", "Enter a complete delivery address.");
  const deliveryInstructions = normalizePlainText(body.deliveryInstructions || "", "Delivery instructions", 300);

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 30) {
    fail("invalid-argument", "Choose at least one menu item before checkout.");
  }
  const chosen = new Map();
  for (const line of body.items) {
    const id = safeDishKey(line?.id);
    const qty = Number(line?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) fail("invalid-argument", "Menu item quantities must be between 1 and 99.");
    if (chosen.has(id)) fail("invalid-argument", "Remove duplicate menu items and try again.");
    chosen.set(id, qty);
  }

  const menuSnapshot = await database.ref("dishes").once("value");
  const currentMenu = menuSnapshot.val() || {};
  const items = [];
  for (const [id, qty] of chosen.entries()) {
    const dish = currentMenu[id];
    if (!dish) fail("failed-precondition", "A selected dish is no longer on the menu. Refresh and try again.");
    if (dish.available === false) fail("failed-precondition", `${dish.name || "A selected dish"} is currently unavailable.`);
    const price = Number(dish.price);
    if (!Number.isFinite(price) || price < 0) fail("failed-precondition", "A menu price is not valid. Please contact the restaurant.");
    items.push({ id, name: normalizePlainText(dish.name, "Dish name", 80, true), price, qty });
  }

  const settingsSnapshot = await database.ref("settings/public").once("value");
  const publicSettings = settingsSnapshot.val() || initialPublicSettings;
  const deliveryFeeConfigured = publicSettings.deliveryFeeEnabled === true;
  const deliveryFee = deliveryFeeConfigured ? Number(publicSettings.deliveryFee) : 0;
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) fail("failed-precondition", "The configured delivery fee is invalid. Please contact the restaurant.");
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal + deliveryFee;

  const proposedOrderKey = database.ref("orders").push().key;
  const orderId = `PM-${proposedOrderKey}`;
  const idempotencyRef = database.ref(`orderRequests/${requestKey}`);
  const reservation = await idempotencyRef.transaction((current) => current || {
    orderId,
    tokenHash,
  });
  const reservationValue = reservation.snapshot.val();
  if (!reservationValue || reservationValue.tokenHash !== tokenHash) {
    fail("already-exists", "This checkout reference has already been used. Refresh your cart and try again.");
  }
  const resolvedOrderId = validateOrderId(reservationValue.orderId);
  const orderRef = database.ref(`orders/${resolvedOrderId}`);
  const existingOrderSnapshot = await orderRef.once("value");
  const existingOrder = existingOrderSnapshot.val();
  if (existingOrder) {
    if (existingOrder.trackingTokenHash !== tokenHash) fail("permission-denied", "Order tracking credentials do not match.");
    await ensureCustomerOrderNodes(resolvedOrderId, existingOrder);
    return {
      orderId: resolvedOrderId,
      total: Number(existingOrder.total) || 0,
      subtotal: Number(existingOrder.subtotal) || 0,
      deliveryFee: Number(existingOrder.deliveryFee) || 0,
      deliveryFeeConfigured: existingOrder.deliveryFeeConfigured === true,
      items: existingOrder.items || [],
      customer: existingOrder.customer,
    };
  }

  const createdAt = Date.now();
  const orderRecord = {
    id: resolvedOrderId,
    customer: { name, phone, address },
    items,
    subtotal,
    deliveryFee,
    deliveryFeeConfigured,
    total,
    status: "Pending",
    createdAt,
    updatedAt: createdAt,
    deliveryInstructions,
    trackingTokenHash: tokenHash,
  };
  const orderWrite = await orderRef.transaction((current) => current || orderRecord);
  const savedOrder = orderWrite.snapshot.val();
  if (!savedOrder || savedOrder.trackingTokenHash !== tokenHash) fail("internal", "The order could not be saved safely. Please retry.");

  await ensureCustomerOrderNodes(resolvedOrderId, savedOrder);

  return {
    orderId: resolvedOrderId,
    total: Number(savedOrder.total) || total,
    subtotal: Number(savedOrder.subtotal) || subtotal,
    deliveryFee: Number(savedOrder.deliveryFee) || 0,
    deliveryFeeConfigured: savedOrder.deliveryFeeConfigured === true,
    items: savedOrder.items,
    customer: savedOrder.customer,
  };
});

exports.createOrderAccessSession = onCall({ region: REGION }, async (request) => {
  const body = request.data || {};
  const orderId = validateOrderId(body.orderId);
  const token = validateToken(body.trackingToken);
  const orderSnapshot = await database.ref(`orders/${orderId}`).once("value");
  const order = orderSnapshot.val();
  if (!order || typeof order.trackingTokenHash !== "string") fail("not-found", "Order details could not be verified. Check the order ID and tracking key.");
  const suppliedHash = hashToken(token);
  const expected = Buffer.from(order.trackingTokenHash, "hex");
  const supplied = Buffer.from(suppliedHash, "hex");
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    fail("permission-denied", "Order details could not be verified. Check the order ID and tracking key.");
  }

  const customToken = await auth.createCustomToken(`customer-${orderId}`, {
    customerOrderId: orderId,
    customerAccess: true,
  });
  return { customToken };
});

exports.updateOrderStatus = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const body = request.data || {};
  const orderKey = safeOrderKey(body.orderKey);
  const status = body.status;
  if (!supportedStatuses.includes(status)) fail("invalid-argument", "Choose a supported order status.");
  const orderRef = database.ref(`orders/${orderKey}`);
  const snapshot = await orderRef.once("value");
  if (!snapshot.exists()) fail("not-found", "This order no longer exists.");
  const order = snapshot.val();
  const orderId = validateOrderId(typeof order.id === "string" ? order.id : orderKey);
  const updatedAt = Date.now();
  const chatClosed = status === "Completed" || status === "Cancelled";
  const updates = {
    status,
    updatedAt,
  };
  await Promise.all([
    orderRef.update(updates),
    database.ref(`orderStatus/${orderId}`).update({ status, updatedAt, chatClosed }),
    database.ref(`chats/${orderId}/meta`).update({ closed: chatClosed, updatedAt }),
  ]);
  return { success: true, status, updatedAt };
});

exports.deleteOrderRecord = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const orderKey = safeOrderKey(request.data?.orderKey);
  const orderRef = database.ref(`orders/${orderKey}`);
  const orderSnapshot = await orderRef.once("value");
  if (!orderSnapshot.exists()) fail("not-found", "This order no longer exists.");
  const order = orderSnapshot.val();
  const orderId = validateOrderId(typeof order.id === "string" ? order.id : orderKey);
  const requestSnapshot = await database.ref("orderRequests").orderByChild("orderId").equalTo(orderId).once("value");
  const removals = [
    orderRef.remove(),
    database.ref(`orderStatus/${orderId}`).remove(),
    database.ref(`chats/${orderId}`).remove(),
  ];
  requestSnapshot.forEach((child) => { removals.push(child.ref.remove()); });
  await Promise.all(removals);
  return { success: true };
});

exports.saveDish = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const body = request.data || {};
  const dishInput = body.dish && typeof body.dish === "object" ? body.dish : {};
  const name = normalizePlainText(dishInput.name, "Dish name", 80, true);
  const description = normalizePlainText(dishInput.description || "", "Description", 180);
  const category = normalizePlainText(dishInput.category, "Category", 40, true);
  const price = Number(dishInput.price);
  if (!Number.isFinite(price) || price < 0 || price > 10000000) fail("invalid-argument", "Enter a valid non-negative dish price.");
  if (typeof dishInput.available !== "boolean") fail("invalid-argument", "Dish availability must be selected.");
  const img = normalizePlainText(dishInput.img || "", "Image URL", 2048);
  if (img) {
    if (img.startsWith("/")) {
      if (!img.startsWith("/images/")) fail("invalid-argument", "Use a secure image URL or a local image under /images/.");
    } else {
      let parsed;
      try { parsed = new URL(img); } catch { fail("invalid-argument", "Enter a valid HTTPS image URL."); }
      if (parsed.protocol !== "https:") fail("invalid-argument", "Dish image URLs must use HTTPS.");
    }
  }

  const dishesRef = database.ref("dishes");
  const snapshot = await dishesRef.once("value");
  const existingDishes = snapshot.val() || {};
  const dishId = body.dishId ? safeDishKey(body.dishId) : dishesRef.push().key;
  const duplicate = Object.entries(existingDishes).find(([key, value]) => key !== dishId && normalizedName(value?.name) === normalizedName(name));
  if (duplicate) fail("already-exists", "A dish with this name is already on the menu.");
  const previous = existingDishes[dishId] || {};
  const nextDish = {
    id: dishId,
    name,
    price,
    img,
    description,
    category,
    available: dishInput.available,
    sortOrder: Number.isFinite(Number(previous.sortOrder)) ? Number(previous.sortOrder) : Object.keys(existingDishes).length + 1,
    updatedAt: Date.now(),
  };
  await dishesRef.child(dishId).set(nextDish);
  return { success: true, dishId };
});

exports.deleteDish = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const dishId = safeDishKey(request.data?.dishId);
  await database.ref(`dishes/${dishId}`).remove();
  return { success: true };
});

exports.reorderDishes = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const ids = request.data?.dishIds;
  if (!Array.isArray(ids) || ids.length > 200) fail("invalid-argument", "Menu order is not valid.");
  const safeIds = ids.map(safeDishKey);
  if (new Set(safeIds).size !== safeIds.length) fail("invalid-argument", "Menu order contains duplicate items.");
  const snapshot = await database.ref("dishes").once("value");
  const current = snapshot.val() || {};
  const keys = Object.keys(current);
  if (safeIds.length !== keys.length || safeIds.some((id) => !Object.prototype.hasOwnProperty.call(current, id))) {
    fail("failed-precondition", "The menu changed while reordering. Refresh and try again.");
  }
  const updates = {};
  safeIds.forEach((id, index) => { updates[`dishes/${id}/sortOrder`] = index + 1; });
  await database.ref().update(updates);
  return { success: true };
});

exports.savePublicSettings = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const value = request.data || {};
  const restaurantName = normalizePlainText(value.restaurantName, "Restaurant name", 80, true);
  const tagline = normalizePlainText(value.tagline || "", "Tagline", 120);
  const contactNumber = normalizePlainText(value.contactNumber, "Contact number", 24, true);
  let whatsappNumber = String(value.whatsappNumber || "").replace(/\D/g, "");
  if (/^0\d{10}$/.test(whatsappNumber)) whatsappNumber = `92${whatsappNumber.slice(1)}`;
  if (!/^\d{7,15}$/.test(whatsappNumber)) fail("invalid-argument", "Enter a valid WhatsApp number with country code.");
  const address = normalizePlainText(value.address, "Restaurant address", 180, true);
  const openingHours = normalizePlainText(value.openingHours || "", "Opening hours", 120);
  if (typeof value.deliveryFeeEnabled !== "boolean" || typeof value.menuVisible !== "boolean") fail("invalid-argument", "Choose valid menu and delivery settings.");
  const deliveryFee = Number(value.deliveryFee);
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 1000000) fail("invalid-argument", "Enter a valid delivery fee.");

  const settings = {
    restaurantName,
    tagline,
    contactNumber,
    whatsappNumber,
    address,
    openingHours,
    deliveryFee: value.deliveryFeeEnabled ? deliveryFee : 0,
    deliveryFeeEnabled: value.deliveryFeeEnabled,
    menuVisible: value.menuVisible,
    updatedAt: Date.now(),
  };
  await database.ref("settings/public").set(settings);
  return { success: true };
});
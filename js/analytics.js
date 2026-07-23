/* ============================================
   Analytics Tracking
   ============================================ */

async function trackVisit() {
  const key = todayKey();
  try {
    await db.collection("analytics").doc(key).set(
      {
        date: key,
        visits: firebase.firestore.FieldValue.increment(1)
      },
      { merge: true }
    );
  } catch (e) {
    /* silent */
  }
}

async function trackBuyClick(productId, source) {
  const key = todayKey();
  try {
    await db.collection("analytics").doc(key).set(
      { date: key, buyNowClicks: firebase.firestore.FieldValue.increment(1) },
      { merge: true }
    );
    await db.collection("buyClicks").add({
      productId,
      source: source || "unknown",
      date: key,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("products").doc(productId).update({
      clickCount: firebase.firestore.FieldValue.increment(1),
      lastClickedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    /* silent */
  }
}

async function trackSocialClick(productId, platform) {
  const key = todayKey();
  try {
    await db.collection("analytics").doc(key).set(
      { date: key, socialClicks: firebase.firestore.FieldValue.increment(1) },
      { merge: true }
    );
    await db.collection("socialClicks").add({
      productId,
      platform,
      date: key,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    /* silent */
  }
}

// ✅ এই ফাংশনটা আছে কিনা নিশ্চিত করুন
async function trackCODOrder(productId) {
  console.log("trackCODOrder called for:", productId);
  const key = todayKey();
  try {
    await db.collection("analytics").doc(key).set(
      { date: key, codOrders: firebase.firestore.FieldValue.increment(1) },
      { merge: true }
    );
    console.log("COD Order analytics updated");
  } catch (e) {
    console.error("trackCODOrder error:", e);
    /* silent */
  }
}

async function trackTelegramClick(source = "popup") {
  const key = todayKey();
  try {
    await db.collection("analytics").doc(key).set(
      { date: key, telegramClicks: firebase.firestore.FieldValue.increment(1) },
      { merge: true }
    );
    await db.collection("telegramClicks").add({
      source,
      date: key,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    /* silent */
  }
}

async function trackEvent(eventName) {
  try {
    await db.collection("userEvents").add({
      event: eventName,
      userId: currentUser ? currentUser.uid : null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    /* silent */
  }
}

// Debug: Confirm all functions are loaded
console.log("✅ analytics.js loaded successfully");
console.log("   - trackVisit:", typeof trackVisit);
console.log("   - trackCODOrder:", typeof trackCODOrder);
console.log("   - trackBuyClick:", typeof trackBuyClick);
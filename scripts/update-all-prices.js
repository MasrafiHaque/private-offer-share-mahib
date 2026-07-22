/**
 * Daily / Manual Price Auto-Update Script
 * এটা GitHub Actions Cron দিয়ে প্রতিদিন, অথবা Admin Panel-এর "Update Now"
 * বাটন দিয়ে On-demand চলতে পারে।
 *
 * কাজ:
 * 1. Firestore থেকে সব Product আনে যাদের autoTrackPrice = true এবং darazUrl সেট করা আছে
 * 2. একটার পর একটা Daraz Page থেকে Price বের করে (মাঝে Delay দিয়ে)
 * 3. দাম বদলে থাকলে Firestore-এ Update করে, priceHistory-তে পুরনো দাম Log করে
 * 4. প্রতিটা Product-এ lastChecked ও lastCheckStatus বসিয়ে দেয়
 * 5. পুরো Progress লাইভ Firestore-এর automationStatus/latest ডকুমেন্টে লিখে রাখে,
 *    যাতে Admin Panel Real-time-এ Log দেখাতে পারে
 */
const admin = require("firebase-admin");
const { extractPrice } = require("./price-extractor");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const statusRef = db.collection("automationStatus").doc("latest");

const DELAY_BETWEEN_PRODUCTS_MS = 8000; // প্রতিটা Product-এর মাঝে ৮ সেকেন্ড Delay — Daraz-কে সম্মান জানিয়ে

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function appendLog(line) {
  console.log(line);
  await statusRef.set(
    { logs: admin.firestore.FieldValue.arrayUnion(line) },
    { merge: true }
  );
}

async function main() {
  await statusRef.set({
    status: "running",
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    finishedAt: admin.firestore.FieldValue.delete(),
    processedCount: 0,
    totalProducts: 0,
    logs: ["🔍 Auto-track করা Product খোঁজা হচ্ছে..."]
  }, { merge: true });

  const snapshot = await db
    .collection("products")
    .where("autoTrackPrice", "==", true)
    .get();

  const products = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.darazUrl);

  await statusRef.set({ totalProducts: products.length }, { merge: true });
  await appendLog(`📦 মোট ${products.length}টা Product Track করা হবে।`);

  if (products.length === 0) {
    await appendLog("কোনো Product-এ Auto-track On করা বা Daraz Link দেওয়া নেই। কিছু করার নেই।");
    await statusRef.set({ status: "completed", finishedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return;
  }

  const summaryRows = [];
  let updatedCount = 0;
  let failedCount = 0;
  let unchangedCount = 0;
  let processedCount = 0;

  for (const product of products) {
    await appendLog(`➡️  Checking: ${product.name}`);
    const result = await extractPrice(product.darazUrl);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!result.success) {
      failedCount++;
      await appendLog(`   ❌ ব্যর্থ: ${result.error}`);
      await db.collection("products").doc(product.id).update({
        lastChecked: now,
        lastCheckStatus: "failed",
        lastCheckError: result.error || "Unknown error"
      });
      summaryRows.push(`| ❌ | ${product.name} | — | — | ${result.error || "Unknown error"} |`);
    } else {
      const oldPrice = product.currentPrice;
      const newPrice = result.price;

      const updateData = {
        lastChecked: now,
        lastCheckStatus: "success",
        lastCheckError: admin.firestore.FieldValue.delete()
      };

      if (newPrice && newPrice !== oldPrice) {
        updateData.currentPrice = newPrice;
        updateData.priceHistory = admin.firestore.FieldValue.arrayUnion({
          price: oldPrice || null,
          changedAt: new Date().toISOString()
        });
        updatedCount++;
        await appendLog(`   ✅ দাম পরিবর্তন হয়েছে: ৳${oldPrice || "—"} → ৳${newPrice}`);
        summaryRows.push(`| ✅ পরিবর্তিত | ${product.name} | ৳${oldPrice || "—"} | ৳${newPrice} | — |`);
      } else {
        unchangedCount++;
        await appendLog(`   ➖ দাম একই আছে: ৳${newPrice}`);
        summaryRows.push(`| ➖ অপরিবর্তিত | ${product.name} | ৳${newPrice} | ৳${newPrice} | — |`);
      }

      await db.collection("products").doc(product.id).update(updateData);
    }

    processedCount++;
    await statusRef.set({ processedCount }, { merge: true });
    await sleep(DELAY_BETWEEN_PRODUCTS_MS);
  }

  await appendLog(`\n📊 সারসংক্ষেপ: পরিবর্তিত ${updatedCount} | অপরিবর্তিত ${unchangedCount} | ব্যর্থ ${failedCount}`);
  await statusRef.set({
    status: "completed",
    finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    summary: { updatedCount, unchangedCount, failedCount }
  }, { merge: true });

  // GitHub Actions Job Summary-তে সুন্দর Table আকারে দেখানো
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const fs = require("fs");
    let md = `## 💰 Price Update Report\n\n`;
    md += `**মোট Check হয়েছে:** ${products.length} | ✅ পরিবর্তিত: ${updatedCount} | ➖ অপরিবর্তিত: ${unchangedCount} | ❌ ব্যর্থ: ${failedCount}\n\n`;
    md += `| Status | Product | আগের দাম | নতুন দাম | কারণ (যদি ব্যর্থ হয়) |\n|---|---|---|---|---|\n`;
    md += summaryRows.join("\n") + "\n";
    fs.appendFileSync(summaryPath, md);
  }
}

main()
  .then(() => {
    console.log("\n✅ সম্পূর্ণ শেষ হয়েছে।");
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("🔥 Fatal Error:", err);
    try {
      await statusRef.set(
        { status: "failed", finishedAt: admin.firestore.FieldValue.serverTimestamp(), logs: admin.firestore.FieldValue.arrayUnion(`🔥 Fatal Error: ${err.message}`) },
        { merge: true }
      );
    } catch (_) {}
    process.exit(1);
  });

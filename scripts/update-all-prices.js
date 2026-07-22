/**
 * Daily Price Auto-Update Script
 * এটা GitHub Actions Cron দিয়ে প্রতিদিন স্বয়ংক্রিয়ভাবে চলে।
 *
 * কাজ:
 * 1. Firestore থেকে সব Product আনে যাদের autoTrackPrice = true এবং darazUrl সেট করা আছে
 * 2. একটার পর একটা Daraz Page থেকে Price বের করে (মাঝে Delay দিয়ে)
 * 3. দাম বদলে থাকলে Firestore-এ Update করে, priceHistory-তে পুরনো দাম Log করে
 * 4. প্রতিটা Product-এ lastChecked ও lastCheckStatus বসিয়ে দেয়
 */
const admin = require("firebase-admin");
const { extractPrice } = require("./price-extractor");

// GitHub Actions Secret থেকে Service Account JSON আসবে (env var হিসেবে)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const DELAY_BETWEEN_PRODUCTS_MS = 8000; // প্রতিটা Product-এর মাঝে ৮ সেকেন্ড Delay — Daraz-কে সম্মান জানিয়ে

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🔍 Auto-track করা Product খোঁজা হচ্ছে...");
  const snapshot = await db
    .collection("products")
    .where("autoTrackPrice", "==", true)
    .get();

  const products = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.darazUrl);

  console.log(`📦 মোট ${products.length}টা Product Track করা হবে।\n`);

  if (products.length === 0) {
    console.log("কোনো Product-এ Auto-track On করা বা Daraz Link দেওয়া নেই। কিছু করার নেই।");
    return;
  }

  const summaryRows = [];
  let updatedCount = 0;
  let failedCount = 0;
  let unchangedCount = 0;

  for (const product of products) {
    console.log(`➡️  Checking: ${product.name} (${product.darazUrl})`);
    const result = await extractPrice(product.darazUrl);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!result.success) {
      failedCount++;
      console.log(`   ❌ ব্যর্থ: ${result.error}`);
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
        console.log(`   ✅ দাম পরিবর্তন হয়েছে: ৳${oldPrice || "—"} → ৳${newPrice}`);
        summaryRows.push(`| ✅ পরিবর্তিত | ${product.name} | ৳${oldPrice || "—"} | ৳${newPrice} | — |`);
      } else {
        unchangedCount++;
        console.log(`   ➖ দাম একই আছে: ৳${newPrice}`);
        summaryRows.push(`| ➖ অপরিবর্তিত | ${product.name} | ৳${newPrice} | ৳${newPrice} | — |`);
      }

      await db.collection("products").doc(product.id).update(updateData);
    }

    await sleep(DELAY_BETWEEN_PRODUCTS_MS);
  }

  console.log("\n📊 সারসংক্ষেপ:");
  console.log(`   পরিবর্তিত: ${updatedCount}`);
  console.log(`   অপরিবর্তিত: ${unchangedCount}`);
  console.log(`   ব্যর্থ: ${failedCount}`);

  // GitHub Actions Job Summary-তে সুন্দর Table আকারে দেখানো
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const fs = require("fs");
    let md = `## 💰 Daily Price Update Report\n\n`;
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
  .catch((err) => {
    console.error("🔥 Fatal Error:", err);
    process.exit(1);
  });

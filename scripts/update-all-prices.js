/**
 * Daily / Manual Price Auto-Update Script
 * (Updated: Only tracks Daraz source products)
 * 
 * কাজ:
 * 1. Firestore থেকে শুধু সেই সব Product আনে যাদের source = "daraz" এবং autoTrackPrice = true
 * 2. একটার পর একটা Daraz Page থেকে Price বের করে (মাঝে Delay দিয়ে)
 * 3. দাম বদলে থাকলে Firestore-এ Update করে, priceHistory-তে পুরনো দাম Log করে
 * 4. প্রতিটা Product-এ lastChecked ও lastCheckStatus বসিয়ে দেয়
 * 5. পুরো Progress লাইভ Firestore-এর automationStatus/latest ডকুমেন্টে লিখে রাখে
 */
const admin = require("firebase-admin");
const { extractPrice } = require("./price-extractor");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const statusRef = db.collection("automationStatus").doc("latest");

const DELAY_BETWEEN_PRODUCTS_MS = 8000; // প্রতিটা Product-এর মাঝে ৮ সেকেন্ড Delay

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
    logs: ["🔍 Daraz Source-এর Auto-track Product খোঁজা হচ্ছে..."]
  }, { merge: true });

  // শুধু Daraz source + autoTrackPrice=true প্রোডাক্ট
  const snapshot = await db
    .collection("products")
    .where("source", "==", "daraz")
    .where("autoTrackPrice", "==", true)
    .where("status", "==", "active")
    .get();

  const products = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.darazUrl); // Daraz URL থাকতেই হবে

  await statusRef.set({ totalProducts: products.length }, { merge: true });
  await appendLog(`📦 মোট ${products.length}টা Daraz Product Track করা হবে।`);

  if (products.length === 0) {
    await appendLog("কোনো Daraz Product-এ Auto-track On করা বা Daraz Link দেওয়া নেই।");
    await statusRef.set({ 
      status: "completed", 
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      summary: { updatedCount: 0, unchangedCount: 0, failedCount: 0 }
    }, { merge: true });
    return;
  }

  const summaryRows = [];
  let updatedCount = 0;
  let failedCount = 0;
  let unchangedCount = 0;
  let processedCount = 0;

  for (const product of products) {
    await appendLog(`➡️  Checking [Daraz]: ${product.name}`);
    
    let result;
    try {
      result = await extractPrice(product.darazUrl);
    } catch (err) {
      result = { success: false, error: err.message };
    }
    
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!result || !result.success) {
      failedCount++;
      const errorMsg = result?.error || "Unknown error";
      await appendLog(`   ❌ ব্যর্থ: ${errorMsg}`);
      await db.collection("products").doc(product.id).update({
        lastChecked: now,
        lastCheckStatus: "failed",
        lastCheckError: errorMsg
      });
      summaryRows.push(`| ❌ | ${product.name} | — | — | ${errorMsg} |`);
    } else {
      const oldPrice = product.currentPrice;
      const newPrice = result.price;

      const updateData = {
        lastChecked: now,
        lastCheckStatus: "success",
        lastCheckError: admin.firestore.FieldValue.delete()
      };

      if (newPrice && newPrice > 0 && newPrice !== oldPrice) {
        updateData.currentPrice = newPrice;
        updateData.priceHistory = admin.firestore.FieldValue.arrayUnion({
          price: oldPrice || null,
          changedAt: new Date().toISOString()
        });
        updatedCount++;
        await appendLog(`   ✅ দাম পরিবর্তন: ৳${oldPrice || "—"} → ৳${newPrice}`);
        summaryRows.push(`| ✅ পরিবর্তিত | ${product.name} | ৳${oldPrice || "—"} | ৳${newPrice} | — |`);
      } else if (!newPrice || newPrice <= 0) {
        failedCount++;
        await appendLog(`   ⚠️ দাম পাওয়া যায়নি (invalid: ${newPrice})`);
        updateData.lastCheckStatus = "failed";
        updateData.lastCheckError = "Invalid price extracted";
        summaryRows.push(`| ⚠️ | ${product.name} | ৳${oldPrice || "—"} | Invalid | Invalid price |`);
      } else {
        unchangedCount++;
        await appendLog(`   ➖ দাম একই: ৳${newPrice}`);
        summaryRows.push(`| ➖ অপরিবর্তিত | ${product.name} | ৳${newPrice} | ৳${newPrice} | — |`);
      }

      await db.collection("products").doc(product.id).update(updateData);
    }

    processedCount++;
    await statusRef.set({ processedCount }, { merge: true });
    await sleep(DELAY_BETWEEN_PRODUCTS_MS);
  }

  const summary = `\n📊 সারসংক্ষেপ: ✅ পরিবর্তিত: ${updatedCount} | ➖ অপরিবর্তিত: ${unchangedCount} | ❌ ব্যর্থ: ${failedCount} | মোট: ${products.length}`;
  await appendLog(summary);
  
  await statusRef.set({
    status: "completed",
    finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    summary: { updatedCount, unchangedCount, failedCount, total: products.length }
  }, { merge: true });

  // GitHub Actions Job Summary
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const fs = require("fs");
    let md = `## 💰 Daraz Price Update Report\n\n`;
    md += `**মোট Check হয়েছে:** ${products.length} | ✅ পরিবর্তিত: ${updatedCount} | ➖ অপরিবর্তিত: ${unchangedCount} | ❌ ব্যর্থ: ${failedCount}\n\n`;
    md += `| Status | Product | আগের দাম | নতুন দাম | কারণ |\n|---|---|---|---|---|\n`;
    md += summaryRows.join("\n") + "\n";
    fs.appendFileSync(summaryPath, md);
  }
}

main()
  .then(() => {
    console.log("\n✅ Daraz Price Update সম্পূর্ণ শেষ হয়েছে।");
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("🔥 Fatal Error:", err);
    try {
      await statusRef.set(
        { 
          status: "failed", 
          finishedAt: admin.firestore.FieldValue.serverTimestamp(), 
          logs: admin.firestore.FieldValue.arrayUnion(`🔥 Fatal Error: ${err.message}`) 
        },
        { merge: true }
      );
    } catch (_) {}
    process.exit(1);
  });
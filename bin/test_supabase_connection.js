const { createClient } = require("@supabase/supabase-js");
const path = require("path");
require("dotenv").config();

// Test Supabase connection
async function testSupabaseConnection() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "videos";

  console.log("Testing Supabase connection...");
  console.log("URL:", SUPABASE_URL ? "Set" : "Not set");
  console.log(
    "Service Key:",
    SUPABASE_SERVICE_ROLE_KEY
      ? "Set (length: " + SUPABASE_SERVICE_ROLE_KEY.length + ")"
      : "Not set"
  );
  console.log("Bucket:", SUPABASE_BUCKET);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Supabase environment variables not set");
    return;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Test basic connection
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error("❌ Supabase connection failed:", error.message);
      console.error("Error details:", JSON.stringify(error, null, 2));
    } else {
      console.log("✅ Supabase connection successful");
      console.log("Buckets:", data.map((b) => b.name).join(", "));

      // Check if our bucket exists
      const bucketExists = data.some((b) => b.name === SUPABASE_BUCKET);
      if (bucketExists) {
        console.log(`✅ Bucket '${SUPABASE_BUCKET}' exists`);
      } else {
        console.log(`❌ Bucket '${SUPABASE_BUCKET}' does not exist`);
        console.log("Available buckets:", data.map((b) => b.name).join(", "));
      }
    }
  } catch (error) {
    console.error("❌ Supabase test failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data?.substring(0, 500));
    }
  }
}

testSupabaseConnection();

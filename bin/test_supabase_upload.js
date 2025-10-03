const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Test Supabase upload
async function testSupabaseUpload() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "videos";

  console.log("Testing Supabase upload...");
  console.log("URL:", SUPABASE_URL ? "Set" : "Not set");
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

    // Create a small test file
    const testContent = "This is a test file for Supabase upload";
    const testFileName = `test_upload_${Date.now()}.txt`;

    console.log(`📁 Attempting to upload test file: ${testFileName}`);

    // Upload test file
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(testFileName, testContent, {
        contentType: "text/plain",
        upsert: false,
      });

    if (error) {
      console.error("❌ Upload failed:", error.message);
      console.error("Error details:", JSON.stringify(error, null, 2));
      if (error.message && error.message.includes("<html>")) {
        console.error(
          "Received HTML response instead of JSON - this indicates a server error"
        );
      }
    } else {
      console.log("✅ Upload successful:", data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(testFileName);

      console.log("Public URL:", urlData.publicUrl);

      // Clean up test file
      await supabase.storage.from(SUPABASE_BUCKET).remove([testFileName]);
      console.log("🧹 Test file cleaned up");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data?.substring(0, 500));
    }
  }
}

testSupabaseUpload();

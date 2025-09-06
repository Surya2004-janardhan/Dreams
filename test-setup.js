#!/usr/bin/env node

require("dotenv").config();
const axios = require("axios");
const { google } = require("googleapis");

console.log("🔧 Testing Environment Variables & Service Connections");
console.log("====================================================\n");

const tests = [];

// Test 1: Basic ENV variables
const checkEnvVariables = () => {
  console.log("1️⃣ Checking Environment Variables...");

  const required = [
    "GOOGLE_CREDENTIALS",
    "GOOGLE_SHEET_ID",
    "YOUTUBE_REFRESH_TOKEN",
    "HUGGINGFACE_API_KEY",
    "STABILITY_API_KEY",
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "INSTAGRAM_ACCOUNT_ID",
    "INSTAGRAM_ACCESS_TOKEN",
    "EMAIL_USER",
    "EMAIL_APP_PASSWORD",
    "NOTIFICATION_EMAIL",
  ];

  const missing = required.filter(
    (key) => !process.env[key] || process.env[key].includes("your_")
  );

  if (missing.length === 0) {
    console.log("   ✅ All environment variables are set");
    return true;
  } else {
    console.log("   ❌ Missing or incomplete variables:");
    missing.forEach((key) => console.log(`      - ${key}`));
    return false;
  }
};

// Test 2: Google Sheets API
const testGoogleSheets = async () => {
  console.log("\n2️⃣ Testing Google Sheets API...");

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A1:D1",
    });

    console.log("   ✅ Google Sheets connection successful");
    console.log(`   📊 Headers: ${response.data.values[0].join(", ")}`);
    return true;
  } catch (error) {
    console.log("   ❌ Google Sheets connection failed");
    console.log(`   🔍 Error: ${error.message}`);
    return false;
  }
};

// Test 3: Hugging Face API
const testHuggingFace = async () => {
  console.log("\n3️⃣ Testing Hugging Face API...");

  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large",
      { inputs: "Hello, this is a test" },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("   ✅ Hugging Face API connection successful");
    return true;
  } catch (error) {
    console.log("   ❌ Hugging Face API connection failed");
    console.log(`   🔍 Error: ${error.response?.status || error.message}`);
    return false;
  }
};

// Test 4: Stability AI API
const testStabilityAI = async () => {
  console.log("\n4️⃣ Testing Stability AI API...");

  try {
    const response = await axios.get(
      "https://api.stability.ai/v1/user/account",
      {
        headers: {
          Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    console.log("   ✅ Stability AI API connection successful");
    console.log(`   💰 Credits: ${response.data.credits}`);
    return true;
  } catch (error) {
    console.log("   ❌ Stability AI API connection failed");
    console.log(`   🔍 Error: ${error.response?.status || error.message}`);
    return false;
  }
};

// Test 5: Cloudflare R2
const testCloudflareR2 = async () => {
  console.log("\n5️⃣ Testing Cloudflare R2...");

  try {
    const AWS = require("aws-sdk");
    const s3 = new AWS.S3({
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      signatureVersion: "v4",
      region: "auto",
    });

    const response = await s3
      .listObjectsV2({
        Bucket: process.env.R2_BUCKET_NAME,
        MaxKeys: 1,
      })
      .promise();

    console.log("   ✅ Cloudflare R2 connection successful");
    console.log(`   📁 Objects in bucket: ${response.KeyCount}`);
    return true;
  } catch (error) {
    console.log("   ❌ Cloudflare R2 connection failed");
    console.log(`   🔍 Error: ${error.message}`);
    return false;
  }
};

// Test 6: Instagram Graph API
const testInstagramAPI = async () => {
  console.log("\n6️⃣ Testing Instagram Graph API...");

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_ACCOUNT_ID}?fields=id,username&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`,
      { timeout: 10000 }
    );

    console.log("   ✅ Instagram Graph API connection successful");
    console.log(`   📱 Account: @${response.data.username}`);
    return true;
  } catch (error) {
    console.log("   ❌ Instagram Graph API connection failed");
    console.log(
      `   🔍 Error: ${error.response?.data?.error?.message || error.message}`
    );
    return false;
  }
};

// Test 7: Email Configuration
const testEmailConfig = () => {
  console.log("\n7️⃣ Testing Email Configuration...");

  try {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    // Just verify config, don't send actual email
    transporter.verify((error, success) => {
      if (success) {
        console.log("   ✅ Email configuration valid");
      } else {
        console.log("   ❌ Email configuration failed");
        console.log(`   🔍 Error: ${error.message}`);
      }
    });

    return true;
  } catch (error) {
    console.log("   ❌ Email configuration failed");
    console.log(`   🔍 Error: ${error.message}`);
    return false;
  }
};

// Test 8: Coqui TTS Server
const testCoquiTTS = async () => {
  console.log("\n8️⃣ Testing Coqui TTS Server...");

  try {
    const response = await axios.get("http://localhost:5002/api/health", {
      timeout: 5000,
    });

    console.log("   ✅ Coqui TTS server is running");
    return true;
  } catch (error) {
    console.log("   ❌ Coqui TTS server connection failed");
    console.log(
      "   💡 Make sure to start TTS server: tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC --port 5002"
    );
    return false;
  }
};

// Run all tests
const runTests = async () => {
  const results = [];

  results.push(checkEnvVariables());

  if (results[0]) {
    // Only run API tests if env vars are set
    results.push(await testGoogleSheets());
    results.push(await testHuggingFace());
    results.push(await testStabilityAI());
    results.push(await testCloudflareR2());
    results.push(await testInstagramAPI());
    results.push(testEmailConfig());
    results.push(await testCoquiTTS());
  }

  const passed = results.filter((r) => r).length;
  const total = results.length;

  console.log("\n" + "=".repeat(50));
  console.log(`🎯 Test Results: ${passed}/${total} passed`);

  if (passed === total) {
    console.log("🎉 All tests passed! Your setup is ready to go!");
    console.log("\n🚀 You can now run: npm run dev");
  } else {
    console.log("❌ Some tests failed. Please check the errors above.");
    console.log("\n📖 Refer to SETUP-GUIDE.md for detailed instructions.");
  }
};

// Run the tests
runTests().catch(console.error);

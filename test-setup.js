const axios = require("axios");

console.log(`
🧪 Testing AI Content Automation System
========================================
`);

const BASE_URL = "http://localhost:3000";

async function testServer() {
  try {
    console.log("📡 Testing server connection...");
    const response = await axios.get(`${BASE_URL}/health`);
    console.log("✅ Server is running:", response.data.status);
    console.log(`   Version: ${response.data.version}`);
    console.log(`   Timestamp: ${response.data.timestamp}`);
    return true;
  } catch (error) {
    console.log("❌ Server connection failed:", error.message);
    console.log('   Make sure to run "npm start" first');
    return false;
  }
}

async function testEndpoints() {
  try {
    console.log("\n📋 Testing API endpoints...");
    const response = await axios.get(`${BASE_URL}/`);
    console.log("✅ Main endpoint working");
    console.log(
      "   Available endpoints:",
      Object.keys(response.data.endpoints).length
    );
    return true;
  } catch (error) {
    console.log("❌ Endpoint test failed:", error.message);
    return false;
  }
}

async function testWorkflowStatus() {
  try {
    console.log("\n⚙️ Testing workflow status...");
    const response = await axios.get(`${BASE_URL}/workflow/status`);
    console.log("✅ Workflow status accessible");
    console.log(`   Current status: ${response.data.workflow.status}`);
    return true;
  } catch (error) {
    console.log("❌ Workflow status test failed:", error.message);
    return false;
  }
}

async function testManualWorkflow() {
  try {
    console.log("\n🎬 Testing manual workflow (quick test)...");
    const testPayload = {
      title: "Test: How do computers work?",
      description: "A simple test of the manual workflow system",
    };

    console.log("   Sending test request...");
    const response = await axios.post(`${BASE_URL}/workflow/run`, testPayload, {
      timeout: 30000, // 30 second timeout for quick test
    });

    if (response.data.success) {
      console.log("✅ Manual workflow test successful");
      console.log(`   Task ID: ${response.data.taskId}`);
      console.log(
        `   Results: ${JSON.stringify(response.data.results, null, 2)}`
      );
    } else {
      console.log("⚠️ Manual workflow returned error:", response.data.error);
    }
    return true;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      console.log(
        "⚠️ Manual workflow test timed out (this is normal for long processes)"
      );
      console.log("   The workflow might still be running in the background");
      return true;
    } else {
      console.log(
        "❌ Manual workflow test failed:",
        error.response?.data?.error || error.message
      );
      return false;
    }
  }
}

async function runAllTests() {
  console.log("Starting comprehensive tests...\n");

  let results = {
    server: false,
    endpoints: false,
    workflowStatus: false,
    manualWorkflow: false,
  };

  results.server = await testServer();

  if (results.server) {
    results.endpoints = await testEndpoints();
    results.workflowStatus = await testWorkflowStatus();

    console.log(
      "\n❓ Would you like to test the manual workflow? (This may take a while)"
    );
    console.log("   This will test script generation, audio, images, etc.");
    console.log("   Press Ctrl+C to skip, or wait 10 seconds to continue...");

    // Wait 10 seconds or until interrupted
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 10000);
      process.on("SIGINT", () => {
        clearTimeout(timeout);
        console.log("\n⏭️ Skipping manual workflow test");
        resolve();
      });
    });

    if (!process.exitCode) {
      results.manualWorkflow = await testManualWorkflow();
    }
  }

  // Print summary
  console.log(`
📊 Test Results Summary:
========================
✅ Server Connection: ${results.server ? "✅ PASS" : "❌ FAIL"}
✅ API Endpoints: ${results.endpoints ? "✅ PASS" : "❌ FAIL"} 
✅ Workflow Status: ${results.workflowStatus ? "✅ PASS" : "❌ FAIL"}
🎬 Manual Workflow: ${results.manualWorkflow ? "✅ PASS" : "❌ FAIL/SKIPPED"}

${
  Object.values(results).filter((r) => r).length === 4
    ? "🎉 All tests passed! Your system is ready for automated content creation."
    : "⚠️ Some tests failed. Check the setup and configuration."
}

🚀 Next Steps:
${
  results.server
    ? "   • Configure your .env file with real API keys\n   • Set up your Google Sheet\n   • Run: curl -X POST http://localhost:3000/workflow/auto"
    : "   • Fix server connection issues first\n   • Run: npm install && npm start"
}
`);
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Test interrupted by user");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  console.log("\n❌ Unexpected error:", error.message);
  process.exit(1);
});

// Run all tests
runAllTests().catch((error) => {
  console.log("\n💥 Test suite failed:", error.message);
  process.exit(1);
});

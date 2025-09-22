const axios = require("axios");

(async () => {
  try {
    console.log("🧪 Testing posts workflow with empty body...");
    console.log("📡 Calling: POST http://localhost:3000/posts-workflow");

    const response = await axios.post(
      "http://localhost:3000/posts-workflow",
      {}
    );

    console.log("✅ Response received:");
    console.log("Status:", response.status);
    console.log("Data:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Test failed:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  }
})();

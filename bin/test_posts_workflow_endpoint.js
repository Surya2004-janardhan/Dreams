const axios = require("axios");

async function testPostsWorkflow() {
  try {
    console.log("🧪 Testing Posts Workflow endpoint...");

    const response = await axios.post(
      "http://localhost:3000/posts-workflow",
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Response received:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log("❌ Test failed:");
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Data:", error.response.data);
    } else {
      console.log("Error:", error.message);
    }
  }
}

testPostsWorkflow();

const axios = require("axios");

(async () => {
  try {
    console.log("Testing posts workflow with empty body...");
    const response = await axios.post(
      "http://localhost:3000/posts-workflow",
      {}
    );
    console.log("Success:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
})();

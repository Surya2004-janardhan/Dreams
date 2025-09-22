// Test Instagram URL construction
const testInstagramUrl = (mediaId) => {
  const constructedUrl = `https://instagram.com/reel/${mediaId}`;
  console.log("📱 Instagram Media ID:", mediaId);
  console.log("🔗 Constructed URL:", constructedUrl);
  console.log(
    "✅ URL is valid format:",
    constructedUrl.startsWith("https://instagram.com/reel/")
  );
  return constructedUrl;
};

// Test with a sample media ID
const testMediaId = "18101003581536386";
const result = testInstagramUrl(testMediaId);
console.log("🎯 Final result:", result);

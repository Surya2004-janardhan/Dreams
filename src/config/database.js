const { S3Client } = require("@aws-sdk/client-s3");

// Filebase S3 Client Configuration
const s3Client = new S3Client({
  endpoint: "https://s3.filebase.com",
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY,
  },
  region: "us-east-1",
  forcePathStyle: true,
});

module.exports = {
  s3Client,
};

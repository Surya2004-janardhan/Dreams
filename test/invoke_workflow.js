const http = require("http");

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/workflow/auto",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": 2,
  },
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  res.on("data", (chunk) => {
    console.log(`Body: ${chunk}`);
  });

  res.on("end", () => {
    console.log("Request completed");
  });
});

req.on("error", (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write("{}");
req.end();

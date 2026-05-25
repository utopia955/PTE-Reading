const body = JSON.stringify({
  images: ["data:image/png;base64," + "A".repeat(40 * 1024 * 1024)], // 40 MB string
  model: "gemini-3.1-flash-lite",
  provider: "google",
  apiKey: "test"
});

fetch("http://localhost:3000/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body
}).then(res => {
  console.log("STATUS:", res.status);
  return res.text();
}).then(text => {
  console.log("BODY starts with:", text.substring(0, 100));
}).catch(err => {
  console.error("ERROR:", err);
});

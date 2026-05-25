fetch("http://localhost:3000/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    images: ["data:image/png;base64,iVBORw0K"],
    model: "gemini-3.1-flash-lite",
    provider: "google",
    apiKey: "test"
  })
}).then(res => {
  console.log("STATUS:", res.status);
  return res.text();
}).then(text => {
  console.log("BODY:", text);
}).catch(err => {
  console.error("ERROR:", err);
});

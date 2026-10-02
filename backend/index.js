require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connect } = require("./src/db");
const { seedAll } = require("./src/seed");

const app = express();

const corsOrigins = process.env.CORS_ORIGINS || "*";
app.use(cors({ origin: corsOrigins === "*" ? true : corsOrigins.split(","), credentials: true }));
app.use(
  express.json({
    limit: "25mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get("/api/", (req, res) =>
  res.json({ app: "IntownPA", runtime: "nodejs", status: "ok", tagline: "You Can't Go? Send IntownPA." })
);
app.get("/api/health", (req, res) => res.json({ status: "healthy" }));

app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/customer", require("./src/routes/customer"));
app.use("/api/pa", require("./src/routes/pa"));
app.use("/api/admin", require("./src/routes/admin"));
app.use("/api/payments", require("./src/routes/payment"));
app.use("/api", require("./src/routes/common"));

// JSON error fallback
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ detail: "Internal server error" });
});

const PORT = Number(process.env.PORT) || 8001;

function listenWithRetry(attempt = 0) {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`IntownPA Node backend listening on ${PORT}`);
  });
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE" && attempt < 10) {
      console.log(`Port ${PORT} busy, retrying (${attempt + 1})...`);
      setTimeout(() => listenWithRetry(attempt + 1), 700);
    } else {
      console.error("Listen error:", e);
      process.exit(1);
    }
  });
}

(async () => {
  try {
    await connect();
    await seedAll();
    console.log("Connected to MongoDB and ensured seed data.");
  } catch (e) {
    console.error("Startup error:", e);
  }
  listenWithRetry();
})();

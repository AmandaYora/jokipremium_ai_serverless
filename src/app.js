import express from "express";
import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";

const app = express();

const DEFAULT_ALLOWED_HEADERS =
  "Origin, X-Requested-With, Content-Type, Accept, Authorization";

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,PATCH,DELETE");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || DEFAULT_ALLOWED_HEADERS
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Jokipremium Assistant",
    codename: "Minjo",
    role: "System Analyst + Customer Service",
    model: "gemini-2.5-flash",
    sessionStorage: "session/<sessionId>.json",
    note: "POST /chat { sessionId, question }",
  });
});

app.use("/chat", chatRoutes);
app.use("/sessions", sessionRoutes);

export default app;

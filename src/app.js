import express from "express";
import chatRoutes from "./routes/chatRoutes.js";

const app = express();

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

export default app;

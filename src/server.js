import app from "./app.js";
import { PORT } from "./config/env.js";

app.listen(PORT, () => {
  console.log(
    `Jokipremium AI "Minjo" (System Analyst CS + WhatsApp handoff) running on http://localhost:${PORT}`
  );
});

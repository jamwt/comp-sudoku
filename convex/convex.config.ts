import { defineApp } from "convex/server";
import auth from "@convex-dev/auth/convex.config.js";
import authPassword from "@convex-dev/auth/components/password/convex.config.js";
import authUsername from "@convex-dev/auth/components/username/convex.config.js";
import presence from "@convex-dev/presence/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import staticHosting from "@convex-dev/static-hosting/convex.config.js";

const app = defineApp({ httpPrefix: "/api" });
app.use(auth);
app.use(authPassword);
app.use(authUsername);
app.use(presence);
app.use(rateLimiter);
app.use(workpool, { name: "puzzleWorkpool" });
app.use(staticHosting, { httpPrefix: "/" });
export default app;

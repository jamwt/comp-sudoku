import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/convex.config.js";
import authGoogle from "@convex-dev/auth/components/google/convex.config.js";
import authPassword from "@convex-dev/auth/components/password/convex.config.js";
import authUsername from "@convex-dev/auth/components/username/convex.config.js";
import presence from "@convex-dev/presence/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import aggregate from "@convex-dev/aggregate/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import staticHosting from "@convex-dev/static-hosting/convex.config.js";

const app = defineApp({
  httpPrefix: "/api",
  env: {
    AUTH_GOOGLE_CLIENT_ID: v.string(),
    AUTH_GOOGLE_CLIENT_SECRET: v.string(),
  },
});
app.use(auth);
app.use(authPassword);
app.use(authUsername);
app.use(authGoogle, {
  httpPrefix: "/oauth/google",
  env: {
    CLIENT_ID: app.env.AUTH_GOOGLE_CLIENT_ID,
    CLIENT_SECRET: app.env.AUTH_GOOGLE_CLIENT_SECRET,
  },
});
app.use(presence);
app.use(rateLimiter);
app.use(workpool, { name: "puzzleWorkpool" });
app.use(staticHosting, { httpPrefix: "/" });
app.use(aggregate, { name: "ratingAggregate" });
export default app;

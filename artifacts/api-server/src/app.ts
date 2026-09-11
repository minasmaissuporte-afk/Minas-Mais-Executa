import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
    const path = req.originalUrl.split("?")[0];
    const monitored = path === "/api/tasks"
      || path.startsWith("/api/tasks/")
      || path === "/api/dashboard/summary"
      || path === "/api/rankings";
    if (!monitored) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info({
      performance: true,
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    }, "Endpoint performance");
  });
  next();
});
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;

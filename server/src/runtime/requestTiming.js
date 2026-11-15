// Opt-in API latency diagnostics. Never logs query strings, request bodies, credentials or user data.
// Enable with API_TIMING_ENABLED=true on Render. Disable after collecting a baseline.
import { performance } from "node:perf_hooks";

export function requestTiming(req, res, next) {
  if (process.env.API_TIMING_ENABLED !== "true") return next();
  const started = performance.now();
  res.once("finish", () => {
    const ms = Math.round((performance.now() - started) * 10) / 10;
    // Express route patterns rather than raw URLs prevent logging identifiers and query parameters.
    const route = req.route?.path;
    const base = req.baseUrl || "";
    const path = route ? `${base}${route}` : "(unmatched)";
    const level = ms >= 2000 ? "slow" : ms >= 500 ? "elevated" : "normal";
    console.info(JSON.stringify({ type: "api_timing", method: req.method, route: path, status: res.statusCode, duration_ms: ms, level }));
  });
  next();
}

/**
 * Classifies the CURRENT REQUEST into one of the supported deployment
 * environments, purely from the request itself (host header + protocol) —
 * no configuration changes are required when switching environments.
 * Used by the /api/camera/status diagnostics endpoint and general logging.
 *
 * @param {import('express').Request} req
 * @returns {'localhost'|'lan'|'ngrok'|'render'|'production'|'unknown'}
 */
export const detectEnvironment = (req) => {
  const host = (req.headers.host || "").toLowerCase();
  const hostname = host.split(":")[0];

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "localhost";
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return "lan";
  }

  if (/\.ngrok-free\.(app|dev)$/.test(hostname) || /\.ngrok\.(io|app)$/.test(hostname)) {
    return "ngrok";
  }

  if (/\.onrender\.com$/.test(hostname)) {
    return "render";
  }

  return process.env.NODE_ENV === "production" ? "production" : "unknown";
};

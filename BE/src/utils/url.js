function getBaseUrl(req) {
  // ưu tiên ENV, fallback từ request
  const envBase = process.env.APP_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0];
  const host = req.get("host");
  return `${proto}://${host}`;
}

function absApiUrl(req, path) {
  const base = getBaseUrl(req);
  return `${base}/api${path}`;
}

module.exports = { getBaseUrl, absApiUrl };

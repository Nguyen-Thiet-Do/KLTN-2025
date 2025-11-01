// src/utils/net.js
export function isAbortError(e) {
  const msg = String(e?.message || "").toLowerCase();
  return (
    e?.code === "ERR_CANCELED" ||
    e?.name === "CanceledError" ||
    e?.name === "AbortError" ||
    msg === "canceled" ||
    msg.includes("canceled") ||
    msg.includes("aborted")
  );
}

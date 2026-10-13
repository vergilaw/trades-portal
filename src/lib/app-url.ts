/** Absolute links use a configured origin, never untrusted request headers. */
export function getAppOrigin() {
  const configured =
    process.env.APP_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!configured) throw new Error("APP_URL is required.");
  const url = new URL(configured);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  )
    throw new Error("APP_URL must be a canonical origin.");
  return url.origin;
}

export function appUrl(path: string) {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Expected a local path.");
  return new URL(path, getAppOrigin()).toString();
}

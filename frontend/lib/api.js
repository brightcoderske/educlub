const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("educlub_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const message = body?.error?.message || "Request failed";
    const details = body?.error?.details;
    if (response.status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem("educlub_token");
      window.localStorage.removeItem("educlub_user");
      window.location.href = "/login";
    }
    throw new Error(details && details !== message ? `${message}: ${details}` : message);
  }

  return body;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload: async (path, formData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const message = body?.error?.message || "Upload failed";
      const details = body?.error?.details;
      if (response.status === 401 && typeof window !== "undefined") {
        window.localStorage.removeItem("educlub_token");
        window.localStorage.removeItem("educlub_user");
        window.location.href = "/login";
      }
      throw new Error(details && details !== message ? `${message}: ${details}` : message);
    }
    return body;
  }
};

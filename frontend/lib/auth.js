import { api } from "./api";

export async function login(identifier, password) {
  const result = await api.post("/auth/login", { identifier, password });
  window.localStorage.setItem("educlub_token", result.accessToken);
  window.localStorage.setItem("educlub_user", JSON.stringify(result.user));
  return result.user;
}

export function logout() {
  window.localStorage.removeItem("educlub_token");
  window.localStorage.removeItem("educlub_user");
  window.location.href = "/login";
}

export function currentUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("educlub_user");
  return raw ? JSON.parse(raw) : null;
}

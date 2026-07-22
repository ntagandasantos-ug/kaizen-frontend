// api.js — drop this into your React project's src/ folder.
// This replaces every window.storage.get/set call from the artifact version
// with real requests to your deployed backend.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getToken() {
  return localStorage.getItem("kaizen_token");
}
function setToken(token) {
  if (token) localStorage.setItem("kaizen_token", token);
  else localStorage.removeItem("kaizen_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data;
}

/* ---------------------------- Auth ---------------------------- */
export const auth = {
  async login(email, password) {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data.user;
  },
  async me() {
    return request("/api/auth/me");
  },
  async changePassword(currentPassword, newPassword) {
    return request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  logout() {
    setToken(null);
  },
  isLoggedIn() {
    return !!getToken();
  },
};

/* ------------------------ Departments -------------------------- */
export const departments = {
  list: () => request("/api/departments"),
  create: (name) => request("/api/departments", { method: "POST", body: JSON.stringify({ name }) }),
  rename: (id, name) => request(`/api/departments/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  remove: (id) => request(`/api/departments/${id}`, { method: "DELETE" }),
};

/* ------------------------- Committee ----------------------------- */
export const committee = {
  list: () => request("/api/committee"),
  create: (member) => request("/api/committee", { method: "POST", body: JSON.stringify(member) }),
  update: (id, patch) => request(`/api/committee/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id) => request(`/api/committee/${id}`, { method: "DELETE" }),
};

/* --------------------------- Audits ------------------------------ */
export const audits = {
  list: (year, departmentId) => {
    const params = new URLSearchParams({ year: String(year) });
    if (departmentId) params.set("department", departmentId);
    return request(`/api/audits?${params}`);
  },
  rankings: (year) => request(`/api/audits/rankings?year=${year}`),
  monthlyWinners: (year) => request(`/api/audits/monthly-winners?year=${year}`),
  submitScore: (payload) => request("/api/audits", { method: "PUT", body: JSON.stringify(payload) }),
};

/* --------------------------- Events ------------------------------ */
export const events = {
  list: (from, to) => {
    const params = from && to ? `?from=${from}&to=${to}` : "";
    return request(`/api/events${params}`);
  },
  create: (event) => request("/api/events", { method: "POST", body: JSON.stringify(event) }),
  remove: (id) => request(`/api/events/${id}`, { method: "DELETE" }),
};

/* ---------------------------- Media ------------------------------- */
// Generic upload used for audit photos/videos/reports, committee/auditor
// headshots, and the site logo. `category` is 'audit' | 'committee' | 'site'.
// `entityId` is the auditId or committee member id (omit for 'site').
async function uploadMedia({ category, entityId, file }) {
  const { uploadUrl, key, fileUrl, fileType } = await request("/api/media/upload-url", {
    method: "POST",
    body: JSON.stringify({
      category,
      entityId,
      fileName: file.name,
      contentType: file.type,
      fileSizeBytes: file.size,
    }),
  });

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload to storage failed.");

  await request("/api/media/confirm", {
    method: "POST",
    body: JSON.stringify({ category, auditId: entityId, key, fileUrl, fileType, fileSizeBytes: file.size }),
  });

  return fileUrl; // caller saves this URL via committee.update(), settings.update(), etc.
}

export const media = {
  upload: uploadMedia,
  uploadAuditFile: (auditId, file) => uploadMedia({ category: "audit", entityId: auditId, file }),
  uploadCommitteePhoto: (memberId, file) => uploadMedia({ category: "committee", entityId: memberId, file }),
  uploadLogo: (file) => uploadMedia({ category: "site", file }),

  listForAudit: (auditId) => request(`/api/media/audit/${auditId}`),
  currentWinnerMedia: () => request("/api/audits/current-winner-media"),
  viewUrl: (id) => request(`/api/media/${id}/view-url`),
  remove: (id) => request(`/api/media/${id}`, { method: "DELETE" }),
};

/* --------------------------- Site Settings ------------------------- */
export const settings = {
  get: () => request("/api/settings"),
  update: (patch) => request("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),
};

// api.js — drop this into your React project's src/ folder.
// This replaces every window.storage.get/set call from the artifact version
// with real requests to your deployed backend.

const API_BASE = import.meta.env.VITE_API_BASE || "";

if (!API_BASE && typeof window !== "undefined") {
  // Loud, obvious warning instead of every request silently failing with a
  // vague "Failed to fetch" — this is the #1 cause of "uploads don't work."
  console.warn(
    "[kaizen] VITE_API_BASE is not set. Every API call will fail. " +
    "Add VITE_API_BASE=https://your-backend-url to your .env file and restart the dev server."
  );
}

function getToken() {
  return localStorage.getItem("kaizen_token");
}
function setToken(token) {
  if (token) localStorage.setItem("kaizen_token", token);
  else localStorage.removeItem("kaizen_token");
}

async function request(path, options = {}) {
  if (!API_BASE) {
    throw new Error("Backend URL is not configured. Set VITE_API_BASE in your frontend's .env file.");
  }
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    // The browser's generic "Failed to fetch" almost always means either:
    // the backend is unreachable/asleep, or CORS is blocking the request.
    throw new Error(
      `Could not reach the backend at ${API_BASE}${path}. ` +
      `Check that the backend is running and that CORS_ORIGIN on the backend matches this site's URL. (${err.message})`
    );
  }
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
  // Bulk-applies a new hierarchy order in one request: [{ id, sort_order }, ...]
  reorder: (order) => request("/api/committee/reorder", { method: "POST", body: JSON.stringify({ order }) }),
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
  // Gets-or-creates an audit row for a department+month with no score yet —
  // lets media get uploaded before a score is entered.
  ensure: (department_id, month) => request("/api/audits/ensure", { method: "POST", body: JSON.stringify({ department_id, month }) }),
};

/* --------------------------- Events ------------------------------ */
export const events = {
  list: (from, to) => {
    const params = from && to ? `?from=${from}&to=${to}` : "";
    return request(`/api/events${params}`);
  },
  create: (event) => request("/api/events", { method: "POST", body: JSON.stringify(event) }),
  update: (id, patch) => request(`/api/events/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
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

  let putRes;
  try {
    putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch (err) {
    // This specific fetch — straight to R2/S3, not your own backend — is the
    // one that fails when the bucket's CORS policy hasn't been configured.
    // Your backend's CORS_ORIGIN setting has no effect on this request at all.
    throw new Error(
      "Upload to storage failed before it could even start. This almost always means your " +
      "R2/S3 bucket doesn't have a CORS policy allowing uploads from this website. " +
      "In Cloudflare: R2 → your bucket → Settings → CORS Policy → add this site's URL " +
      `with PUT and GET methods allowed. (${err.message})`
    );
  }
  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (HTTP ${putRes.status}). Double-check your R2/S3 credentials and bucket name.`);
  }

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
  listAll: (year) => request(`/api/media${year ? `?year=${year}` : ""}`),
  currentWinnerMedia: () => request("/api/audits/current-winner-media"),
  viewUrl: (id) => request(`/api/media/${id}/view-url`),
  remove: (id) => request(`/api/media/${id}`, { method: "DELETE" }),
};

/* ------------------------- Independent Gallery ---------------------- */
// A general, department-independent gallery — separate table, separate
// route, on purpose. Uploading here never asks for a department or month.
export const gallery = {
  list: () => request("/api/gallery"),
  remove: (id) => request(`/api/gallery/${id}`, { method: "DELETE" }),
  async upload(file, caption) {
    const { uploadUrl, key, fileUrl, fileType } = await request("/api/media/upload-url", {
      method: "POST",
      body: JSON.stringify({
        category: "gallery",
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
      }),
    });

    let putRes;
    try {
      putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    } catch (err) {
      throw new Error(
        "Upload to storage failed before it could even start. This almost always means your " +
        "R2/S3 bucket doesn't have a CORS policy allowing uploads from this website. " +
        `(${err.message})`
      );
    }
    if (!putRes.ok) throw new Error(`Upload to storage failed (HTTP ${putRes.status}).`);

    return request("/api/gallery/confirm", {
      method: "POST",
      body: JSON.stringify({ key, fileUrl, fileType, fileSizeBytes: file.size, caption: caption || null }),
    });
  },
};

/* --------------------------- Site Settings ------------------------- */
export const settings = {
  get: () => request("/api/settings"),
  update: (patch) => request("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),
};

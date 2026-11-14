const $ = (id) => document.getElementById(id);

// API Base URL (automatically works when served by Express on localhost:5000 or via Live Server)
const API_BASE = window.location.port === '5000' ? '/api' : 'http://localhost:5000/api';

const cropDefaults = {
  rice: { name: "Rice / Paddy", emoji: "🌾", npk: "Nitrogen-focused; balanced phosphorus and potassium", notes: "Split nutrient applications are commonly used in paddy. Follow local soil-test recommendations and water-management advice.", fertilizers: [{ name: "Urea", rate: 45, unit: "kg/acre", why: "Nitrogen source; use only as advised for the crop stage." }, { name: "DAP", rate: 20, unit: "kg/acre", why: "Provides phosphorus and some nitrogen." }, { name: "MOP (Potash)", rate: 15, unit: "kg/acre", why: "Potassium source where required." }] },
  maize: { name: "Maize", emoji: "🌽", npk: "Balanced N-P-K; nitrogen demand increases during vegetative growth", notes: "Nutrient needs vary with hybrid, season, soil and irrigation. Split nitrogen as advised locally.", fertilizers: [{ name: "Urea", rate: 40, unit: "kg/acre", why: "Nitrogen source; timing should match crop stage." }, { name: "DAP", rate: 18, unit: "kg/acre", why: "Phosphorus source, generally considered near planting." }, { name: "MOP (Potash)", rate: 12, unit: "kg/acre", why: "Potassium source where required." }] },
  cotton: { name: "Cotton", emoji: "☁️", npk: "Balanced N-P-K with attention to potassium", notes: "Avoid excess nitrogen. Adjust nutrient plan to soil test, variety and local agricultural guidance.", fertilizers: [{ name: "Urea", rate: 30, unit: "kg/acre", why: "Nitrogen source; avoid over-application." }, { name: "DAP", rate: 18, unit: "kg/acre", why: "Phosphorus source." }, { name: "MOP (Potash)", rate: 18, unit: "kg/acre", why: "Potassium source where required." }] },
  chilli: { name: "Chilli", emoji: "🌶️", npk: "Balanced nutrition; potassium is important during flowering and fruiting", notes: "Use split applications and avoid fertilizer contact with stems or leaves. Confirm rates locally.", fertilizers: [{ name: "Urea", rate: 25, unit: "kg/acre", why: "Nitrogen source; split application may be appropriate." }, { name: "DAP", rate: 15, unit: "kg/acre", why: "Phosphorus source." }, { name: "MOP (Potash)", rate: 15, unit: "kg/acre", why: "Potassium source where required." }] },
  tomato: { name: "Tomato", emoji: "🍅", npk: "Balanced N-P-K; potassium demand is important during fruiting", notes: "Avoid excess nitrogen during fruiting. Base final rates on soil test and local horticulture advice.", fertilizers: [{ name: "Urea", rate: 22, unit: "kg/acre", why: "Nitrogen source; use carefully during fruiting." }, { name: "DAP", rate: 15, unit: "kg/acre", why: "Phosphorus source." }, { name: "MOP (Potash)", rate: 18, unit: "kg/acre", why: "Potassium source where required." }] }
};

let profiles = structuredClone(cropDefaults);
let records = [];
let adminOverviewData = { accounts: [], allRecords: [] };
let activeAccount = null;
let authToken = localStorage.getItem("cg_token") || null;
let authRole = "user";
let authMode = "login";
let currentRecord = null, selectedAdminCrop = "rice", currentStep = 1;

const stageNames = { sowing: "Sowing / Planting", vegetative: "Vegetative growth", flowering: "Flowering", fruiting: "Fruiting / Grain filling" };
const levelNames = { low: "Low", medium: "Medium", high: "High" };

async function apiRequest(endpoint, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function populateCropSelects() {
  const keys = Object.keys(profiles);
  const cropOptions = keys.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(profiles[k].name)}</option>`).join("");
  const cropSelect = $("crop");
  if (cropSelect) {
    const chosen = cropSelect.value;
    cropSelect.innerHTML = '<option value="">Choose your crop</option>' + cropOptions;
    cropSelect.value = chosen;
  }
  const filter = $("adminCropFilter");
  if (filter) {
    const chosen = filter.value || "all";
    filter.innerHTML = '<option value="all">All crops</option>' + cropOptions;
    filter.value = chosen;
  }
}

async function fetchCropsFromBackend() {
  try {
    const data = await apiRequest("/crops");
    if (data.profiles && Object.keys(data.profiles).length) {
      profiles = data.profiles;
      populateCropSelects();
    }
  } catch (err) {
    console.warn("Using fallback crop profiles:", err.message);
    populateCropSelects();
  }
}

async function fetchUserHistory() {
  if (!activeAccount) return;
  try {
    const userId = activeAccount.id || activeAccount.userId || "me";
    const data = await apiRequest(`/recommendations/user/${userId}`);
    records = data.recommendations || [];
  } catch (err) {
    console.error("Failed to load history:", err.message);
  }
}

function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  $("page-" + page).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.page === page));
  if (page === "admin" && activeAccount?.role !== "admin") {
    toast("Admin access is required.");
    return;
  }
  const titles = {
    dashboard: ["FARMER WORKSPACE", "Your farm dashboard"],
    new: ["NEW FARM PLAN", "Create recommendation"],
    history: ["SAVED FARM PLANS", "Recommendation history"],
    admin: ["SYSTEM ADMINISTRATION", "Admin control center"],
    result: ["YOUR FARM PLAN", "Fertilizer recommendation"]
  };
  $("pageEyebrow").textContent = titles[page][0];
  $("pageTitle").textContent = titles[page][1];
  $("sidebar").classList.remove("open");
  if (page === "dashboard") renderDashboard();
  if (page === "history") renderHistory();
  if (page === "admin") loadAndRenderAdmin();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { navigate(b.dataset.go); if (b.dataset.go === "new") setStep(1); }));
$("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));

function setStep(step) {
  currentStep = step;
  document.querySelectorAll(".form-step").forEach(s => s.classList.toggle("active", Number(s.dataset.formStep) === step));
  document.querySelectorAll(".wizard-tab").forEach(s => s.classList.toggle("active", Number(s.dataset.step) === step));
  $("stepLabel").textContent = `Step ${step} of 3`;
  $("progressBar").style.width = `${step / 3 * 100}%`;
  if (step === 3) renderReview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-next]").forEach(b => b.addEventListener("click", () => {
  if (currentStep === 1) {
    if (!$("recommendationForm").reportValidity()) return;
  }
  setStep(Number(b.dataset.next));
}));
document.querySelectorAll("[data-prev]").forEach(b => b.addEventListener("click", () => setStep(Number(b.dataset.prev))));

function getForm() {
  return {
    farmerName: $("farmerName").value.trim(),
    location: $("location").value.trim(),
    crop: $("crop").value,
    stage: $("growthStage").value,
    area: Number($("area").value),
    unit: $("areaUnit").value,
    ph: $("ph").value === "" ? null : Number($("ph").value),
    n: $("nitrogen").value,
    p: $("phosphorus").value,
    k: $("potassium").value
  };
}

function validateAll() {
  const f = getForm();
  if (!f.location || !f.crop || !f.stage || !f.area || f.area <= 0) {
    toast("Please complete all required farm details.");
    setStep(1);
    return false;
  }
  if (f.ph !== null && (f.ph < 0 || f.ph > 14)) {
    toast("Soil pH must be between 0 and 14.");
    setStep(2);
    return false;
  }
  return true;
}

function renderReview() {
  const f = getForm(), crop = profiles[f.crop] || { name: f.crop };
  const items = [
    ["Farmer", f.farmerName || activeAccount?.name || "Not provided"],
    ["Location", f.location],
    ["Crop", crop.name],
    ["Growth stage", stageNames[f.stage]],
    ["Farm area", `${f.area} ${f.unit}`],
    ["Soil pH", f.ph === null ? "Not provided" : f.ph],
    ["Nitrogen", levelNames[f.n]],
    ["Phosphorus", levelNames[f.p]],
    ["Potassium", levelNames[f.k]]
  ];
  $("reviewDetails").innerHTML = items.map(([k, v]) => `<div class="review-item"><small>${k}</small><b>${escapeHtml(String(v))}</b></div>`).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Submit Soil Data & Request Recommendation via POST /api/recommendations/request
$("recommendationForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateAll()) return;
  const formData = getForm();
  try {
    const data = await apiRequest("/recommendations/request", {
      method: "POST",
      body: JSON.stringify(formData)
    });
    currentRecord = data.recommendation;
    records.unshift(currentRecord);
    renderResult(currentRecord);
    navigate("result");
    toast("Recommendation generated and saved to MongoDB!");
  } catch (err) {
    toast(err.message || "Could not generate recommendation.");
  }
});

function renderResult(r) {
  const c = profiles[r.crop] || { name: r.crop, emoji: "🌱" };
  $("resultSub").textContent = `${r.location} • ${r.area} ${r.unit} • ${stageNames[r.stage] || r.stage}`;
  $("resultContent").innerHTML = `
<div class="result-banner"><div><span class="pill light-pill">PERSONALISED INPUT SUMMARY</span><h3>${escapeHtml(c.name)} ${c.emoji}</h3><p>${escapeHtml(r.location)} · ${r.area} ${r.unit} · ${stageNames[r.stage] || r.stage}</p></div><div class="crop-emoji">${c.emoji}</div></div>
<div class="result-grid"><div class="panel"><div class="panel-head"><div><span class="eyebrow">SUGGESTED INPUTS</span><h3>Fertilizer summary</h3></div></div>${(r.items || []).map(x => `<div class="fertilizer-row"><div><b>${escapeHtml(x.name)}</b><p>${escapeHtml(x.why)}</p></div><div class="quantity">${Number(x.ratePerHa).toFixed(1)} kg/ha<small>${Number(x.totalQuantity).toFixed(1)} kg total</small></div></div>`).join("")}<div class="warning-box">⚠️ These quantities are generated by the rule-based engine. Confirm final application rates with your local agricultural extension officer and soil-test report.</div></div>
<div><div class="panel"><span class="eyebrow">WHEN TO APPLY</span><h3>Application timing</h3><p style="font-size:12px;line-height:1.7;color:#66756c">${escapeHtml(r.timing)}</p><h3 style="margin-top:20px">Soil information</h3><ul class="result-list"><li>pH: ${r.ph === null || r.ph === undefined ? "Not provided" : r.ph}</li><li>Nitrogen: ${levelNames[r.n] || r.n}</li><li>Phosphorus: ${levelNames[r.p] || r.p}</li><li>Potassium: ${levelNames[r.k] || r.k}</li></ul></div><div class="panel" style="margin-top:14px"><span class="eyebrow">CROP GUIDANCE</span><h3>Important notes</h3><p style="font-size:12px;line-height:1.7;color:#66756c">${escapeHtml(r.notes)}</p></div></div></div>
<div class="panel" style="margin-top:16px"><span class="eyebrow">INPUT CHECKS</span><h3>Things to review</h3><ul class="result-list">${(r.alerts || []).map(a => `<li>${escapeHtml(a)}</li>`).join("")}</ul></div>`;
}

$("printBtn").addEventListener("click", () => window.print());
$("newPlanBtn").addEventListener("click", () => {
  $("recommendationForm").reset();
  navigate("new");
  setStep(1);
});

// Submit Feedback via POST /api/recommendations/:id/feedback
document.querySelectorAll("[data-rating]").forEach(b => b.addEventListener("click", async () => {
  if (!currentRecord) return;
  const rating = b.dataset.rating;
  try {
    await apiRequest(`/recommendations/${currentRecord.id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ rating })
    });
    currentRecord.feedback = rating;
    const ix = records.findIndex(r => String(r.id) === String(currentRecord.id));
    if (ix >= 0) records[ix].feedback = rating;
    toast("Thank you! Feedback saved to database.");
  } catch (err) {
    toast(err.message || "Failed to submit feedback.");
  }
}));

function renderDashboard() {
  $("statTotal").textContent = records.length;
  $("statRecent").textContent = records.length ? new Date(records[0].date).toLocaleDateString() : "—";
  $("recentList").innerHTML = records.length
    ? records.slice(0, 3).map(r => `<div class="history-item"><div><b>${escapeHtml(profiles[r.crop]?.name || r.crop)}</b><p>${escapeHtml(r.location)} · ${new Date(r.date).toLocaleDateString()}</p></div><button class="small-btn" data-open-record="${r.id}">View plan</button></div>`).join("")
    : "No recommendations yet. Create your first farm plan.";
  bindOpenRecords();
}

function renderHistory() {
  $("historyList").innerHTML = records.length
    ? records.map(r => `<div class="history-item"><div><b>${escapeHtml(profiles[r.crop]?.name || r.crop)} · ${escapeHtml(r.location)}</b><p>${r.area} ${r.unit} · ${stageNames[r.stage] || r.stage} · ${new Date(r.date).toLocaleString()}</p></div><div class="history-actions"><button class="small-btn" data-open-record="${r.id}">View</button><button class="small-btn" data-delete-record="${r.id}">Delete</button></div></div>`).join("")
    : '<div class="empty-state">No saved recommendations yet.</div>';
  bindOpenRecords();
  document.querySelectorAll("[data-delete-record]").forEach(b => b.addEventListener("click", async () => {
    const id = b.dataset.deleteRecord;
    try {
      await apiRequest(`/recommendations/${id}`, { method: "DELETE" });
      records = records.filter(r => String(r.id) !== String(id));
      renderHistory();
      renderDashboard();
      toast("Record deleted from database.");
    } catch (err) {
      toast(err.message || "Could not delete record.");
    }
  }));
}

function bindOpenRecords() {
  document.querySelectorAll("[data-open-record]").forEach(b => b.addEventListener("click", async () => {
    const recId = b.dataset.openRecord;
    let found = records.find(r => String(r.id) === String(recId));
    if (!found) {
      try {
        const res = await apiRequest(`/recommendations/${recId}`);
        found = res.recommendation;
      } catch (err) {
        toast(err.message);
        return;
      }
    }
    currentRecord = found;
    renderResult(currentRecord);
    navigate("result");
  }));
}

async function loadAndRenderAdmin() {
  try {
    const [overview] = await Promise.all([
      apiRequest("/admin/overview"),
      fetchCropsFromBackend()
    ]);
    adminOverviewData = overview;
    renderAdmin();
  } catch (err) {
    toast(err.message || "Failed to load admin overview.");
  }
}

function renderAdmin() {
  const { accounts = [], allRecords = [] } = adminOverviewData;
  const today = new Date().toDateString();
  $("adminUserCount").textContent = accounts.length;
  $("adminRecordCount").textContent = allRecords.length;
  $("adminTodayCount").textContent = allRecords.filter(r => new Date(r.date).toDateString() === today).length;

  const search = ($("adminUserSearch")?.value || "").toLowerCase();
  const visibleUsers = accounts.filter(u => `${u.name} ${u.email} ${u.phone || ""}`.toLowerCase().includes(search));
  $("adminUsersTable").innerHTML = visibleUsers.length
    ? visibleUsers.map(u => `<tr><td><b>${escapeHtml(u.name || "Farmer")}</b><small>${escapeHtml(u.email)}</small></td><td>${escapeHtml(u.phone || "—")}</td><td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td><td><b>${u.planCount || 0}</b></td><td><span class="account-status ${u.disabled ? "disabled" : "enabled"}">${u.disabled ? "Disabled" : "Active"}</span></td><td><button class="small-btn" data-toggle-user="${escapeHtml(u.id)}">${u.disabled ? "Enable" : "Disable"}</button></td></tr>`).join("")
    : '<tr><td colspan="6" class="table-empty">No farmer accounts found.</td></tr>';

  const cropFilter = $("adminCropFilter")?.value || "all";
  const filtered = allRecords.filter(r => cropFilter === "all" || r.crop === cropFilter);
  $("adminRecordsTable").innerHTML = filtered.length
    ? filtered.map(r => `<tr><td><b>${escapeHtml(r.ownerName)}</b><small>${escapeHtml(r.ownerEmail)}</small></td><td><b>${escapeHtml(profiles[r.crop]?.name || r.crop)}</b><small>${escapeHtml(r.location)}</small></td><td>${r.area} ${escapeHtml(r.unit)}</td><td>${new Date(r.date).toLocaleDateString()}</td><td>${escapeHtml(r.feedback || "Not rated")}</td><td><button class="small-btn" data-admin-record="${r.id}">View result</button></td></tr>`).join("")
    : '<tr><td colspan="6" class="table-empty">No recommendations match this filter.</td></tr>';

  document.querySelectorAll("[data-toggle-user]").forEach(b => b.addEventListener("click", async () => {
    try {
      const res = await apiRequest(`/admin/users/${b.dataset.toggleUser}/toggle`, { method: "PATCH" });
      toast(res.message);
      await loadAndRenderAdmin();
    } catch (err) {
      toast(err.message);
    }
  }));

  document.querySelectorAll("[data-admin-record]").forEach(b => b.addEventListener("click", () => {
    const r = allRecords.find(x => String(x.id) === String(b.dataset.adminRecord));
    if (!r) return;
    currentRecord = r;
    renderResult(currentRecord);
    navigate("result");
  }));

  const keys = Object.keys(profiles);
  if (!profiles[selectedAdminCrop]) selectedAdminCrop = keys[0];
  $("cropAdminList").innerHTML = keys.map(k => `<button type="button" class="crop-option ${k === selectedAdminCrop ? "selected" : ""}" data-admin-crop="${escapeHtml(k)}">${escapeHtml(profiles[k].emoji)} ${escapeHtml(profiles[k].name)}<span>›</span></button>`).join("");
  document.querySelectorAll("[data-admin-crop]").forEach(b => b.addEventListener("click", () => {
    selectedAdminCrop = b.dataset.adminCrop;
    renderAdmin();
  }));

  const c = profiles[selectedAdminCrop];
  if (c) {
    $("editCropName").value = c.name;
    $("editNpk").value = c.npk;
    $("editNotes").value = c.notes;
    $("fertilizerRuleEditor").innerHTML = (c.fertilizers || []).map((f, i) => fertilizerRuleRow(f, i)).join("");
  }
  populateCropSelects();
}

function fertilizerRuleRow(f = {}, i = 0) {
  return `<div class="fert-rule-row" style="display:grid;grid-template-columns:1fr 90px;gap:8px;margin:8px 0;padding:10px;border:1px solid var(--line);border-radius:8px"><label>Fertilizer<input data-rule-name value="${escapeHtml(String(f.name || ""))}" required placeholder="Fertilizer name"></label><label>Rate (kg/acre)<input data-rule-rate type="number" min="0" step="0.1" value="${Number(f.rate) || 0}" required></label><label style="grid-column:1/-1">Purpose / explanation<input data-rule-why value="${escapeHtml(String(f.why || ""))}" required></label><button type="button" class="small-btn" data-remove-rule>Remove rule</button></div>`;
}

// Update Crop Profile & Dosage Rules via PUT /api/admin/crops/:cropId
$("cropEditForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fertilizers = [...$("fertilizerRuleEditor").querySelectorAll(".fert-rule-row")].map(row => ({
    name: row.querySelector("[data-rule-name]").value.trim(),
    rate: Number(row.querySelector("[data-rule-rate]").value),
    unit: "kg/acre",
    why: row.querySelector("[data-rule-why]").value.trim()
  }));
  if (!fertilizers.length) {
    toast("Add at least one fertilizer rule.");
    return;
  }
  try {
    await apiRequest(`/admin/crops/${selectedAdminCrop}`, {
      method: "PUT",
      body: JSON.stringify({
        cropId: selectedAdminCrop,
        npk: $("editNpk").value.trim(),
        notes: $("editNotes").value.trim(),
        fertilizers
      })
    });
    await fetchCropsFromBackend();
    renderAdmin();
    toast("Crop profile and fertilizer rules saved to MongoDB.");
  } catch (err) {
    toast(err.message || "Failed to update crop profile.");
  }
});

$("addFertilizerRule").addEventListener("click", () => $("fertilizerRuleEditor").insertAdjacentHTML("beforeend", fertilizerRuleRow({ name: "", rate: 0, why: "" })));
$("fertilizerRuleEditor").addEventListener("click", e => {
  if (e.target.matches("[data-remove-rule]")) e.target.closest(".fert-rule-row").remove();
});

// Add New Crop Profile via POST /api/admin/crops
$("addCropForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = $("newCropKey").value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!key || profiles[key]) {
    toast("Use a unique crop key.");
    return;
  }
  try {
    await apiRequest("/admin/crops", {
      method: "POST",
      body: JSON.stringify({
        cropId: key,
        cropName: $("newCropName").value.trim(),
        emoji: $("newCropEmoji").value.trim() || "🌱",
        npk: $("newCropNpk").value.trim(),
        notes: $("newCropNotes").value.trim(),
        fertilizers: [{ name: "Urea", rate: 25, unit: "kg/acre", why: "Set a verified crop-specific rate before use." }]
      })
    });
    selectedAdminCrop = key;
    e.target.reset();
    $("newCropEmoji").value = "🌱";
    await fetchCropsFromBackend();
    renderAdmin();
    toast("Crop profile added to MongoDB knowledge base.");
  } catch (err) {
    toast(err.message || "Failed to add crop profile.");
  }
});

function setAuthMessage(message, success = false) {
  const el = $("authMessage");
  el.textContent = message;
  el.style.color = success ? "#28764b" : "#b64c3d";
}

function setAuthMode(mode) {
  if (authRole === "admin") mode = "login";
  authMode = mode;
  const registering = mode === "register" && authRole === "user";
  $("authNameWrap").classList.toggle("hidden", !registering);
  $("authPhoneWrap").classList.toggle("hidden", !registering);
  $("authConfirmWrap").classList.toggle("hidden", !registering);
  $("authName").required = registering;
  $("authConfirm").required = registering;
  document.querySelectorAll(".auth-tab").forEach(b => {
    b.classList.toggle("active", b.dataset.authMode === mode);
    b.style.display = (authRole === "admin" && b.dataset.authMode === "register") ? "none" : "";
  });
  $("authHeading").textContent = mode === "login" ? "Welcome back" : "Create farmer account";
  $("authDescription").textContent = mode === "login" ? "Login to continue to your dashboard." : "Enter your details to create a farmer account.";
  $("authSubmit").textContent = mode === "login" ? `Login as ${authRole === "admin" ? "Admin" : "Farmer"}` : "Register as Farmer";
  $("authNote").style.display = authRole === "admin" ? "none" : "block";
  $("authNote").textContent = mode === "login" ? "New here? Select Create account to register." : "Already registered? Select Login.";
  $("adminDemoNote").style.display = authRole === "admin" ? "block" : "none";
  $("authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  setAuthMessage("");
}

document.querySelectorAll("[data-auth-role]").forEach(b => b.addEventListener("click", () => {
  authRole = b.dataset.authRole;
  document.querySelectorAll(".auth-role").forEach(x => x.classList.toggle("active", x === b));
  setAuthMode(authRole === "admin" ? "login" : authMode);
}));
document.querySelectorAll("[data-auth-mode]").forEach(b => b.addEventListener("click", () => setAuthMode(b.dataset.authMode)));

// Register / Login via /api/auth/register and /api/auth/login
$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("authEmail").value.trim().toLowerCase();
  const password = $("authPassword").value;

  if (authMode === "register") {
    if (authRole === "admin") {
      setAuthMessage("Admin accounts are provisioned by the system owner. Use the demo admin login.");
      return;
    }
    const name = $("authName").value.trim();
    const phone = $("authPhone").value.trim();
    const confirm = $("authConfirm").value;
    if (!name) {
      setAuthMessage("Please enter your full name.");
      return;
    }
    if (password.length < 6) {
      setAuthMessage("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setAuthMessage("Passwords do not match.");
      return;
    }
    try {
      const data = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, phone, email, password })
      });
      authToken = data.token;
      localStorage.setItem("cg_token", authToken);
      e.target.reset();
      await loginAccount(data.user);
      toast("Your CropGrowth account was created in MongoDB!");
    } catch (err) {
      setAuthMessage(err.message);
    }
    return;
  }

  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role: authRole })
    });
    authToken = data.token;
    localStorage.setItem("cg_token", authToken);
    await loginAccount(data.user);
  } catch (err) {
    setAuthMessage(err.message);
  }
});

async function loginAccount(account) {
  activeAccount = account;
  await fetchCropsFromBackend();
  await fetchUserHistory();
  $("authScreen").style.display = "none";
  $("appShell").style.display = "";
  $("signedInLabel").textContent = account.name;
  $("userAvatar").textContent = (account.name || "F").charAt(0).toUpperCase();
  document.querySelector('[data-page="admin"]').style.display = account.role === "admin" ? "flex" : "none";
  document.querySelector('[data-page="dashboard"]').style.display = account.role === "admin" ? "none" : "flex";
  document.querySelector('[data-page="new"]').style.display = account.role === "admin" ? "none" : "flex";
  document.querySelector('[data-page="history"]').style.display = account.role === "admin" ? "none" : "flex";
  if (account.role === "admin") navigate("admin");
  else navigate("dashboard");
}

$("logoutBtn").addEventListener("click", () => {
  activeAccount = null;
  authToken = null;
  localStorage.removeItem("cg_token");
  records = [];
  $("appShell").style.display = "none";
  $("authScreen").style.display = "flex";
  $("authForm").reset();
  authRole = "user";
  document.querySelectorAll(".auth-role").forEach(b => b.classList.toggle("active", b.dataset.authRole === "user"));
  setAuthMode("login");
});

$("adminUserSearch").addEventListener("input", renderAdmin);
$("adminCropFilter").addEventListener("change", renderAdmin);

// Initialize session if JWT token exists
(async function initApp() {
  setAuthMode("login");
  await fetchCropsFromBackend();
  if (authToken) {
    try {
      const data = await apiRequest("/auth/me");
      if (data.user) {
        await loginAccount(data.user);
      }
    } catch (err) {
      localStorage.removeItem("cg_token");
      authToken = null;
    }
  }
})();

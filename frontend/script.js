
"use strict";

/*
  Appointly frontend
  API: your existing FastAPI appointment API.
  This frontend is not a substitute for backend authentication or permissions.
*/

const API_BASE = "http://127.0.0.1:8000";

const state = {
  appointments: [],
  view: "dashboard",
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedCalendarDate: localDateString(new Date()),
  pendingDeleteId: null,
  loading: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatTime(timeString) {
  if (!timeString) return "—";

  // Supports HH:mm:ss and ISO-like values containing a time.
  const match = String(timeString).match(/(\d{2}):(\d{2})/);
  if (!match) return timeString;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return timeString;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

function getStatusClass(status) {
  if (status === "booked") return "badge badge-booked";
  if (status === "cancelled") return "badge badge-cancelled";
  return "badge badge-other";
}

function statusBadge(status) {
  const safeStatus = escapeHTML(status || "unknown");
  return `<span class="${getStatusClass(status)}">${safeStatus}</span>`;
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "success" ? "" : type}`;
  toast.textContent = message;
  $("#toastContainer").appendChild(toast);

  window.setTimeout(() => toast.remove(), 4500);
}

function setConnection(connected, message) {
  const status = $(".connection-status");
  status.classList.toggle("connected", connected);
  status.classList.toggle("disconnected", !connected);
  $("#connectionText").textContent = message;
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error(
      `Cannot connect to FastAPI at ${API_BASE}. Make sure the server is running and CORS is configured if needed.`
    );
  }

  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }

  if (!response.ok) {
    let detail = data?.detail;

    if (Array.isArray(detail)) {
      detail = detail.map((item) => item.msg || JSON.stringify(item)).join(", ");
    }

    throw new Error(
      typeof detail === "string"
        ? detail
        : `API request failed with status ${response.status}.`
    );
  }

  return data;
}

function getAllAppointments() {
  return apiRequest("/appointments");
}

async function loadAppointments(showMessage = false) {
  if (state.loading) return;

  state.loading = true;
  $("#refreshButton").disabled = true;

  try {
    const data = await getAllAppointments();

    // Supports either an array or an API response with an appointments array.
    const records = Array.isArray(data)
      ? data
      : Array.isArray(data?.appointments)
        ? data.appointments
        : null;

    if (!records) {
      throw new Error("The API response does not contain an appointments list.");
    }

    state.appointments = records;
    setConnection(true, "API connected");
    renderAll();

    if (showMessage) showToast("Appointments refreshed successfully.");
  } catch (error) {
    setConnection(false, "API unavailable");
    showToast(error.message, "error");
    renderAll();
  } finally {
    state.loading = false;
    $("#refreshButton").disabled = false;
  }
}

function renderAll() {
  renderStats();
  renderRecentAppointments();
  renderAppointmentsTable();
  renderProviders();
  renderReminders();
  renderCalendar();

  $("#navCount").textContent = String(
    state.appointments.filter((appointment) => appointment.status === "booked").length
  );
}

function renderStats() {
  const appointments = state.appointments;
  const booked = appointments.filter((item) => item.status === "booked");
  const cancelled = appointments.filter((item) => item.status === "cancelled");
  const today = localDateString(new Date());
  const todaysAppointments = booked.filter((item) => item.appointment_date === today);
  const other = appointments.length - booked.length - cancelled.length;

  $("#totalStat").textContent = appointments.length;
  $("#bookedStat").textContent = booked.length;
  $("#todayStat").textContent = todaysAppointments.length;
  $("#cancelledStat").textContent = cancelled.length;

  $("#overviewTotal").textContent = appointments.length;
  $("#overviewBooked").textContent = booked.length;
  $("#overviewCancelled").textContent = cancelled.length;
  $("#overviewOther").textContent = Math.max(0, other);

  const total = appointments.length || 1;
  $("#bookedBar").style.width = `${booked.length / total * 100}%`;
  $("#cancelledBar").style.width = `${cancelled.length / total * 100}%`;
  $("#otherBar").style.width = `${Math.max(0, other) / total * 100}%`;

  $("#welcomeDate").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date()).toUpperCase();

  $("#footerYear").textContent = new Date().getFullYear();
}

function clientCell(appointment) {
  return `
    <div class="client-cell">
      <div class="client-avatar">${escapeHTML(initials(appointment.customer_name))}</div>
      <div>
        <div class="client-name">${escapeHTML(appointment.customer_name)}</div>
        <div class="client-sub">#APT-${escapeHTML(appointment.id)}</div>
      </div>
    </div>
  `;
}

function renderRecentAppointments() {
  const tbody = $("#recentAppointments");
  const sorted = [...state.appointments].sort((a, b) => {
    const first = `${a.appointment_date || ""}T${a.appointment_time || ""}`;
    const second = `${b.appointment_date || ""}T${b.appointment_time || ""}`;
    return second.localeCompare(first);
  }).slice(0, 5);

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No appointments found. Create your first appointment to get started.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((appointment) => `
    <tr>
      <td>${clientCell(appointment)}</td>
      <td><span class="provider-name">${escapeHTML(appointment.provider_name)}</span></td>
      <td><div class="date-main">${escapeHTML(formatDate(appointment.appointment_date))}</div><div class="date-sub">${escapeHTML(formatTime(appointment.appointment_time))}</div></td>
      <td>${statusBadge(appointment.status)}</td>
      <td><button class="row-action" data-edit="${escapeHTML(appointment.id)}" title="Edit appointment" aria-label="Edit appointment">✎</button></td>
    </tr>
  `).join("");
}

function getFilteredAppointments() {
  const query = ($("#searchInput")?.value || "").trim().toLowerCase();
  const status = $("#statusFilter")?.value || "all";
  const date = $("#dateFilter")?.value || "";

  return state.appointments.filter((appointment) => {
    const searchable = [
      appointment.customer_name,
      appointment.email,
      appointment.provider_name,
      appointment.id
    ].join(" ").toLowerCase();

    if (query && !searchable.includes(query)) return false;
    if (status !== "all" && appointment.status !== status) return false;
    if (date && appointment.appointment_date !== date) return false;

    return true;
  }).sort((a, b) => {
    const first = `${a.appointment_date || ""}T${a.appointment_time || ""}`;
    const second = `${b.appointment_date || ""}T${b.appointment_time || ""}`;
    return first.localeCompare(second);
  });
}

function renderAppointmentsTable() {
  const tbody = $("#allAppointments");
  const filtered = getFilteredAppointments();

  $("#resultsCount").textContent =
    `${filtered.length} appointment${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-cell">No appointments match your search or filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((appointment) => `
    <tr>
      <td>${clientCell(appointment)}</td>
      <td>${escapeHTML(appointment.email)}</td>
      <td><span class="provider-name">${escapeHTML(appointment.provider_name)}</span></td>
      <td>${escapeHTML(formatDate(appointment.appointment_date))}</td>
      <td>${escapeHTML(formatTime(appointment.appointment_time))}</td>
      <td>${escapeHTML(appointment.duration_minutes)} min</td>
      <td>${statusBadge(appointment.status)}</td>
      <td>
        <div class="row-actions">
          <button class="row-action" data-edit="${escapeHTML(appointment.id)}" title="Edit" aria-label="Edit appointment">✎</button>
          ${appointment.status === "booked"
            ? `<button class="row-action" data-cancel="${escapeHTML(appointment.id)}" title="Cancel appointment" aria-label="Cancel appointment">⊘</button>`
            : ""}
          <button class="row-action delete" data-delete="${escapeHTML(appointment.id)}" title="Delete" aria-label="Delete appointment">⌫</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderProviders() {
  const grid = $("#providersGrid");
  const providerMap = new Map();

  state.appointments.forEach((appointment) => {
    const name = String(appointment.provider_name || "").trim();
    if (!name) return;

    if (!providerMap.has(name)) {
      providerMap.set(name, { name, total: 0, booked: 0 });
    }

    const provider = providerMap.get(name);
    provider.total += 1;
    if (appointment.status === "booked") provider.booked += 1;
  });

  const providers = [...providerMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (!providers.length) {
    grid.innerHTML = `<section class="panel empty-cell">No providers found. Providers are derived from appointment records.</section>`;
    return;
  }

  grid.innerHTML = providers.map((provider) => `
    <article class="provider-card">
      <div class="provider-card-head">
        <div class="client-avatar">${escapeHTML(initials(provider.name))}</div>
        <div><h3>${escapeHTML(provider.name)}</h3><p>Appointment provider</p></div>
      </div>
      <div class="provider-card-foot"><span>${provider.total} total appointments</span><strong>${provider.booked} booked</strong></div>
    </article>
  `).join("");
}

function renderReminders() {
  const tbody = $("#remindersTable");

  if (!state.appointments.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-cell">No appointment records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = [...state.appointments]
    .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date)))
    .map((appointment) => {
      const processed = Number(appointment.reminder_sent) === 1;

      return `
        <tr>
          <td>${clientCell(appointment)}</td>
          <td>${escapeHTML(appointment.provider_name)}</td>
          <td>${escapeHTML(formatDate(appointment.appointment_date))} · ${escapeHTML(formatTime(appointment.appointment_time))}</td>
          <td>${processed
            ? `<span class="badge badge-other">Processed</span>`
            : `<span class="badge badge-booked">Not processed</span>`}</td>
        </tr>
      `;
    }).join("");
}

function showView(view) {
  const knownViews = ["dashboard", "appointments", "calendar", "providers", "reminders"];
  if (!knownViews.includes(view)) return;

  state.view = view;

  knownViews.forEach((name) => {
    $(`#${name}View`).classList.toggle("hidden", name !== view);
  });

  $$(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const labels = {
    dashboard: "Dashboard",
    appointments: "Appointments",
    calendar: "Calendar",
    providers: "Providers",
    reminders: "Reminder status"
  };

  $("#breadcrumbTitle").textContent = labels[view];
  $("#sidebar").classList.remove("open");

  if (view === "calendar") renderCalendar();
}

function openAppointmentModal(appointment = null) {
  $("#appointmentForm").reset();
  $("#formError").classList.add("hidden");
  $("#formError").textContent = "";

  $("#appointmentId").value = appointment ? appointment.id : "";
  $("#modalTitle").textContent = appointment ? "Edit appointment" : "New appointment";
  $("#saveAppointment").innerHTML = appointment
    ? "Save changes <span>→</span>"
    : "Save appointment <span>→</span>";

  $("#customerName").value = appointment?.customer_name || "";
  $("#customerEmail").value = appointment?.email || "";
  $("#providerName").value = appointment?.provider_name || "";
  $("#appointmentDate").value = appointment?.appointment_date || localDateString(new Date());
  $("#appointmentTime").value = appointment?.appointment_time
    ? String(appointment.appointment_time).match(/\d{2}:\d{2}/)?.[0] || ""
    : "";
  $("#durationMinutes").value = String(appointment?.duration_minutes || 30);
  $("#appointmentStatus").value = appointment?.status || "booked";

  $("#appointmentModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  $("#customerName").focus();
}

function closeAppointmentModal() {
  $("#appointmentModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function showFormError(message) {
  $("#formError").textContent = message;
  $("#formError").classList.remove("hidden");
}

async function saveAppointment(event) {
  event.preventDefault();

  const id = $("#appointmentId").value;
  const payload = {
    customer_name: $("#customerName").value.trim(),
    email: $("#customerEmail").value.trim(),
    provider_name: $("#providerName").value.trim(),
    appointment_date: $("#appointmentDate").value,
    appointment_time: $("#appointmentTime").value + ":00",
    duration_minutes: Number($("#durationMinutes").value),
    status: $("#appointmentStatus").value
  };

  if (!payload.customer_name || !payload.email || !payload.provider_name ||
      !payload.appointment_date || !$("#appointmentTime").value) {
    showFormError("Please complete all required fields.");
    return;
  }

  const submitButton = $("#saveAppointment");
  submitButton.disabled = true;
  submitButton.textContent = "Saving…";

  try {
    if (id) {
      await apiRequest(`/appointments/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    } else {
      await apiRequest("/appointments", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    closeAppointmentModal();
    await loadAppointments();
    showToast(id ? "Appointment updated successfully." : "Appointment created successfully.");
  } catch (error) {
    showFormError(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = $("#appointmentId").value
      ? "Save changes <span>→</span>"
      : "Save appointment <span>→</span>";
  }
}

function findAppointment(id) {
  return state.appointments.find((appointment) => String(appointment.id) === String(id));
}

function editAppointment(id) {
  const appointment = findAppointment(id);

  if (!appointment) {
    showToast("Appointment not found. Refresh the list and try again.", "error");
    return;
  }

  openAppointmentModal(appointment);
}

async function cancelAppointment(id) {
  const appointment = findAppointment(id);
  if (!appointment) return;

  const confirmed = window.confirm(
    `Cancel the appointment for ${appointment.customer_name} with ${appointment.provider_name}?`
  );
  if (!confirmed) return;

  try {
    await apiRequest(`/appointments/${encodeURIComponent(id)}/cancel`, {
      method: "PATCH"
    });

    await loadAppointments();
    showToast("Appointment cancelled successfully.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openDeleteDialog(id) {
  const appointment = findAppointment(id);
  if (!appointment) return;

  state.pendingDeleteId = id;
  $("#confirmTitle").textContent = "Delete appointment?";
  $("#confirmText").textContent =
    `This will permanently delete the appointment for ${appointment.customer_name}. This action cannot be undone.`;

  $("#confirmDialog").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeDeleteDialog() {
  state.pendingDeleteId = null;
  $("#confirmDialog").classList.add("hidden");
  document.body.style.overflow = "";
}

async function deleteAppointment() {
  const id = state.pendingDeleteId;
  if (id == null) return;

  $("#confirmDelete").disabled = true;

  try {
    await apiRequest(`/appointments/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    closeDeleteDialog();
    await loadAppointments();
    showToast("Appointment deleted successfully.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    $("#confirmDelete").disabled = false;
  }
}

function renderCalendar() {
  const grid = $("#calendarGrid");
  if (!grid) return;

  const monthDate = state.calendarMonth;
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  $("#calendarMonth").textContent = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric"
  }).format(monthDate);

  const firstDay = new Date(year, month, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const today = localDateString(new Date());

  const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  let html = weekdays.map((day) => `<div class="calendar-cell weekday">${day}</div>`).join("");

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dateKey = localDateString(date);
    const dayAppointments = state.appointments.filter((item) =>
      item.appointment_date === dateKey && item.status === "booked"
    );

    const classes = [
      "calendar-cell",
      date.getMonth() !== month ? "muted-day" : "",
      dateKey === today ? "today" : "",
      dateKey === state.selectedCalendarDate ? "selected" : ""
    ].filter(Boolean).join(" ");

    const events = dayAppointments.slice(0, 2).map((item) =>
      `<div class="day-event">${escapeHTML(item.customer_name)}</div>`
    ).join("");

    const extra = dayAppointments.length > 2
      ? `<div class="day-event">+${dayAppointments.length - 2} more</div>`
      : "";

    html += `
      <button class="${classes}" data-calendar-date="${dateKey}">
        <span class="day-number">${date.getDate()}</span>${events}${extra}
      </button>
    `;
  }

  grid.innerHTML = html;
  renderSelectedDateAppointments();
}

function renderSelectedDateAppointments() {
  const container = $("#selectedDateAppointments");
  if (!container) return;

  const date = state.selectedCalendarDate;
  const appointments = state.appointments.filter((item) =>
    item.appointment_date === date
  ).sort((a, b) => String(a.appointment_time).localeCompare(String(b.appointment_time)));

  let html = `<h3>${escapeHTML(formatDate(date))}</h3>`;

  if (!appointments.length) {
    html += `<p class="muted">No appointments scheduled for this date.</p>`;
  } else {
    html += `<div class="table-wrap"><table><thead><tr><th>TIME</th><th>CLIENT</th><th>PROVIDER</th><th>STATUS</th><th></th></tr></thead><tbody>`;
    html += appointments.map((item) => `
      <tr>
        <td>${escapeHTML(formatTime(item.appointment_time))}</td>
        <td>${escapeHTML(item.customer_name)}</td>
        <td>${escapeHTML(item.provider_name)}</td>
        <td>${statusBadge(item.status)}</td>
        <td><button class="row-action" data-edit="${escapeHTML(item.id)}" aria-label="Edit appointment">✎</button></td>
      </tr>
    `).join("");
    html += `</tbody></table></div>`;
  }

  container.innerHTML = html;
}

function showHelp() {
  showToast(
    "Use New appointment to create a booking. Search and filters help you find records. Edit, cancel, and delete actions call your FastAPI API.",
    "warning"
  );
}

function bindEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  $$("[data-open-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.openView));
  });

  ["#addAppointmentButton", "#addAppointmentButton2", "#quickAdd", "#calendarAdd"]
    .forEach((selector) => {
      $(selector).addEventListener("click", () => openAppointmentModal());
    });

  $("#closeModal").addEventListener("click", closeAppointmentModal);
  $("#cancelForm").addEventListener("click", closeAppointmentModal);
  $("#appointmentForm").addEventListener("submit", saveAppointment);

  $("#appointmentModal").addEventListener("click", (event) => {
    if (event.target === $("#appointmentModal")) closeAppointmentModal();
  });

  $("#confirmCancel").addEventListener("click", closeDeleteDialog);
  $("#confirmDelete").addEventListener("click", deleteAppointment);

  $("#confirmDialog").addEventListener("click", (event) => {
    if (event.target === $("#confirmDialog")) closeDeleteDialog();
  });

  $("#searchInput").addEventListener("input", renderAppointmentsTable);
  $("#statusFilter").addEventListener("change", renderAppointmentsTable);
  $("#dateFilter").addEventListener("change", renderAppointmentsTable);

  $("#clearFilters").addEventListener("click", () => {
    $("#searchInput").value = "";
    $("#statusFilter").value = "all";
    $("#dateFilter").value = "";
    renderAppointmentsTable();
  });

  $("#refreshButton").addEventListener("click", () => loadAppointments(true));
  $("#reminderRefresh").addEventListener("click", () => loadAppointments(true));

  $("#previousMonth").addEventListener("click", () => {
    state.calendarMonth = new Date(
      state.calendarMonth.getFullYear(),
      state.calendarMonth.getMonth() - 1,
      1
    );
    renderCalendar();
  });

  $("#nextMonth").addEventListener("click", () => {
    state.calendarMonth = new Date(
      state.calendarMonth.getFullYear(),
      state.calendarMonth.getMonth() + 1,
      1
    );
    renderCalendar();
  });

  $("#calendarGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-calendar-date]");
    if (!button) return;

    state.selectedCalendarDate = button.dataset.calendarDate;
    renderCalendar();
  });

  // Delegate actions for rows rendered dynamically.
  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    const cancelButton = event.target.closest("[data-cancel]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) editAppointment(editButton.dataset.edit);
    if (cancelButton) cancelAppointment(cancelButton.dataset.cancel);
    if (deleteButton) openDeleteDialog(deleteButton.dataset.delete);
  });

  $("#menuButton").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });

  $("#helpButton").addEventListener("click", showHelp);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAppointmentModal();
      closeDeleteDialog();
      $("#sidebar").classList.remove("open");
    }
  });
}

function init() {
  bindEvents();
  showView("dashboard");
  loadAppointments();
}

document.addEventListener("DOMContentLoaded", init);

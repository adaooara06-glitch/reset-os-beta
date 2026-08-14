const STORAGE_KEY = "reset-os-beta";
const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
state.sessions ||= [];
state.thoughts ||= [];
state.plan ||= [];
state.settings ||= { focusMinutes: 25, wakeHours: 7, nightReminderTime: "", distractions: "Instagram، TikTok، YouTube" };
let remainingSeconds = state.settings.focusMinutes * 60;
let timerId;
let selectedReason = "";
let selectedStatus = "تحرّكت";
let activeTaskId = null;

const views = ["wakeView", "homeView", "focusView", "completeView", "resetView", "thoughtView", "nightView", "reviewView", "settingsView"];
const show = (id) => views.forEach((view) => document.getElementById(view).classList.toggle("hidden", view !== id));
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const stampInteraction = () => { state.lastInteractionAt = Date.now(); save(); };
const byId = (id) => document.getElementById(id);

function format(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function renderPlan() {
  const el = byId("planPreview");
  if (!state.plan.length) { el.innerHTML = "<strong>بكرا:</strong> لم تجهّز خطة بعد."; return; }
  el.innerHTML = `<strong>خطة الغد</strong><ol>${state.plan.map((task) => `<li>${task.title} <small>— ${task.status}${task.reminderTime ? ` · ${task.reminderTime}` : ""}</small></li>`).join("")}</ol>`;
}

function taskForTitle(title) {
  let task = state.plan.find((item) => item.title === title && item.status !== "خلصت");
  if (!task) {
    task = { id: crypto.randomUUID(), title, priority: state.plan.length + 1, status: "لم أبدأ", createdAt: Date.now() };
    state.plan.push(task);
  }
  return task;
}

function startFocus() {
  const title = byId("taskInput").value.trim();
  if (!title) { byId("taskInput").focus(); return; }
  const task = taskForTitle(title);
  activeTaskId = task.id;
  state.currentTask = title;
  stampInteraction();
  remainingSeconds = state.settings.focusMinutes * 60;
  byId("focusTask").textContent = title;
  byId("timer").textContent = format(remainingSeconds);
  show("focusView");
  clearInterval(timerId);
  timerId = setInterval(() => {
    remainingSeconds -= 1;
    byId("timer").textContent = format(Math.max(remainingSeconds, 0));
    if (remainingSeconds <= 0) finishFocus();
  }, 1000);
}

function finishFocus() {
  clearInterval(timerId);
  selectedStatus = "تحرّكت";
  document.querySelectorAll("[data-status]").forEach((item) => item.classList.toggle("selected", item.dataset.status === selectedStatus));
  stampInteraction();
  show("completeView");
}

function openNight() {
  ["priorityOne", "priorityTwo", "priorityThree"].forEach((id, index) => {
    byId(id).value = state.plan[index]?.title || "";
    byId(`${id}Time`).value = state.plan[index]?.reminderTime || "";
  });
  show("nightView");
}

function saveNight() {
  const entries = ["priorityOne", "priorityTwo", "priorityThree"].map((id) => ({ title: byId(id).value.trim(), reminderTime: byId(`${id}Time`).value })).filter((entry) => entry.title);
  if (!entries.length) { byId("priorityOne").focus(); return; }
  state.plan = entries.map((entry, index) => {
    const { title, reminderTime } = entry;
    const previous = state.plan.find((task) => task.title === title);
    return { ...(previous || { id: crypto.randomUUID(), status: "لم أبدأ", createdAt: Date.now() }), title, priority: index + 1, reminderTime };
  });
  state.lastNightSetupAt = Date.now();
  stampInteraction();
  renderPlan();
  byId("taskInput").value = state.plan[0].title;
  show("homeView");
}

function renderReview() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = state.sessions.filter((session) => session.completedAt >= cutoff);
  const done = state.plan.filter((task) => task.status === "خلصت").length;
  const moving = state.plan.filter((task) => task.status === "تحرّكت").length;
  byId("reviewStats").innerHTML = `<strong>آخر 7 أيام</strong><br>${recent.length} جلسة تركيز · ${recent.reduce((sum, session) => sum + (session.minutes || 25), 0)} دقيقة مخططة<br>${state.thoughts.length} فكرة محفوظة`;
  byId("reviewTasks").innerHTML = `<strong>المهام الحالية</strong><br>${done} خلصت · ${moving} تحرّكت · ${state.plan.filter((task) => task.status === "لم أبدأ").length} لم تبدأ`;
}

byId("startFocusButton").addEventListener("click", startFocus);
byId("startWakeButton").addEventListener("click", () => { stampInteraction(); byId("taskInput").value = state.plan[0]?.title || state.currentTask || ""; show("homeView"); });
byId("finishFocusButton").addEventListener("click", finishFocus);
byId("resetButton").addEventListener("click", () => { clearInterval(timerId); show("resetView"); });
byId("thoughtButton").addEventListener("click", () => show("thoughtView"));
byId("nightButton").addEventListener("click", openNight);
byId("reviewButton").addEventListener("click", () => { renderReview(); show("reviewView"); });
byId("settingsButton").addEventListener("click", () => {
  byId("focusMinutes").value = state.settings.focusMinutes;
  byId("wakeHours").value = state.settings.wakeHours;
  byId("nightReminderTime").value = state.settings.nightReminderTime;
  byId("distractions").value = state.settings.distractions;
  show("settingsView");
});
byId("saveThoughtButton").addEventListener("click", () => {
  const text = byId("thoughtInput").value.trim();
  if (!text) { byId("thoughtInput").focus(); return; }
  state.thoughts.unshift({ text, createdAt: Date.now() });
  byId("thoughtInput").value = "";
  stampInteraction();
  show("homeView");
});
byId("saveNightButton").addEventListener("click", saveNight);
byId("saveSettingsButton").addEventListener("click", () => {
  const focusMinutes = Number(byId("focusMinutes").value);
  const wakeHours = Number(byId("wakeHours").value);
  state.settings.focusMinutes = Math.min(180, Math.max(5, focusMinutes || 25));
  state.settings.wakeHours = Math.min(24, Math.max(1, wakeHours || 7));
  state.settings.nightReminderTime = byId("nightReminderTime").value;
  state.settings.distractions = byId("distractions").value.trim();
  stampInteraction();
  show("homeView");
});
byId("continueAfterResetButton").addEventListener("click", () => {
  state.lastResetReason = selectedReason;
  stampInteraction();
  byId("taskInput").value = state.currentTask || state.plan[0]?.title || "";
  show("homeView");
});
byId("saveResultButton").addEventListener("click", () => {
  const task = state.plan.find((item) => item.id === activeTaskId) || taskForTitle(state.currentTask || "مهمة بلا اسم");
  task.status = selectedStatus;
  state.sessions.unshift({ task: task.title, result: byId("resultInput").value.trim(), status: selectedStatus, minutes: state.settings.focusMinutes, completedAt: Date.now() });
  byId("resultInput").value = "";
  stampInteraction();
  renderPlan();
  show("homeView");
});
document.querySelectorAll("[data-reason]").forEach((button) => button.addEventListener("click", () => {
  selectedReason = button.dataset.reason;
  document.querySelectorAll("[data-reason]").forEach((item) => item.classList.toggle("selected", item === button));
}));
document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
  selectedStatus = button.dataset.status;
  document.querySelectorAll("[data-status]").forEach((item) => item.classList.toggle("selected", item === button));
}));

renderPlan();
byId("taskInput").value = state.plan[0]?.title || state.currentTask || "";
const awayLongEnough = !state.lastInteractionAt || Date.now() - state.lastInteractionAt >= state.settings.wakeHours * 60 * 60 * 1000;
show(awayLongEnough ? "wakeView" : "homeView");
if (!awayLongEnough) stampInteraction();

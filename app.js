const TOKEN = "juJTxighw2ZZ1EZ8bay7J4c7H5JrJrFmLkJCMfwQ";
const GROUP_ID = "66189553";
const FALLBACK_AVATAR = "logo.png";

const container = document.getElementById("events-container");
const btnUpcoming = document.getElementById("btn-upcoming");
const btnPast = document.getElementById("btn-past");
const avatarImg = document.getElementById("group-avatar");
const groupNameEls = [
  document.getElementById("group-name"),
  document.getElementById("footer-group-name"),
];

let allEvents = [];
let activeTab = "upcoming";

// ── Fetch ─────────────────────────────────────────────

async function loadEvents() {
  showLoading();
  try {
    const [eventsRes, groupRes] = await Promise.all([
      fetch(`https://api.groupme.com/v3/conversations/${GROUP_ID}/events/list?limit=100&token=${TOKEN}`),
      fetch(`https://api.groupme.com/v3/groups/${GROUP_ID}?token=${TOKEN}`),
    ]);

    if (!eventsRes.ok) throw new Error(`HTTP ${eventsRes.status}`);
    const eventsData = await eventsRes.json();
    allEvents = eventsData.response.events || [];

    if (groupRes.ok) {
      const groupData = await groupRes.json();
      const apiAvatar = groupData.response?.image_url;
      const groupName = groupData.response?.name;
      if (apiAvatar) avatarImg.src = apiAvatar;
      if (groupName) groupNameEls.forEach((el) => (el.textContent = groupName));
    }

    renderTab();
  } catch (err) {
    container.innerHTML = `<p class="empty-state"><span>⚠️</span>Failed to load events. Please try again later.</p>`;
    console.error("Error loading events:", err);
  }
}

// ── Rendering ─────────────────────────────────────────

function renderTab() {
  const now = Date.now();

  const filtered = allEvents.filter((ev) => {
    const start = new Date(ev.start_at).getTime();
    return activeTab === "upcoming" ? start >= now : start < now;
  });

  // Sort upcoming ascending, past descending
  filtered.sort((a, b) =>
    activeTab === "upcoming"
      ? new Date(a.start_at) - new Date(b.start_at)
      : new Date(b.start_at) - new Date(a.start_at)
  );

  if (filtered.length === 0) {
    const label = activeTab === "upcoming" ? "upcoming" : "past";
    container.innerHTML = `
      <div class="empty-state">
        <span>${activeTab === "upcoming" ? "📅" : "🗓️"}</span>
        No ${label} events found.
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(buildCard).join("");
}

function buildCard(ev) {
  const isPast = activeTab === "past";
  const startDate = new Date(ev.start_at);
  const formattedDate = startDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const rsvp = buildRsvpLine(ev);
  const description = ev.description
    ? `<p class="event-description">${escapeHtml(ev.description)}</p>`
    : "";
  const location =
    ev.location && ev.location.name
      ? `<p class="event-location">📍 ${escapeHtml(ev.location.name)}${ev.location.address ? ` — ${escapeHtml(ev.location.address)}` : ""}</p>`
      : "";
  const shareLink = ev.share_url
    ? `<a class="event-link"
          href="${escapeHtml(ev.share_url)}"
          data-ios="${escapeHtml(ev.deep_link_ios || "")}"
          data-android="${escapeHtml(ev.deep_link_android || "")}"
          data-web="${escapeHtml(ev.share_url)}"
          onclick="handleEventLink(event, this)"
          rel="noopener noreferrer">View Event →</a>`
    : "";

  return `
    <article class="event-card${isPast ? " past" : ""}">
      <div class="event-card-header">
        <h2 class="event-name">${escapeHtml(ev.name)}</h2>
        <span class="event-date">${formattedDate} · ${formattedTime}</span>
      </div>
      ${description}
      ${location}
      <p class="event-attendees">${rsvp}</p>
      ${shareLink ? `<div class="event-card-footer">${shareLink}</div>` : ""}
    </article>`;
}

function buildRsvpLine(ev) {
  const going = Array.isArray(ev.going) ? ev.going.length : 0;
  const maybe = Array.isArray(ev.maybe_going) ? ev.maybe_going.length : 0;
  const notGoing = Array.isArray(ev.not_going) ? ev.not_going.length : 0;

  const parts = [];
  parts.push(`<strong>${going}</strong> going`);
  if (maybe > 0) parts.push(`<strong>${maybe}</strong> maybe`);
  if (notGoing > 0) parts.push(`<strong>${notGoing}</strong> not going`);

  return parts.join(" &nbsp;·&nbsp; ");
}

function handleEventLink(e, anchor) {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const deepLink = isIos
    ? anchor.dataset.ios
    : isAndroid
    ? anchor.dataset.android
    : null;
  const webUrl = anchor.dataset.web;

  if (!deepLink) {
    // Desktop — open web URL in new tab as normal
    return true;
  }

  e.preventDefault();

  // Attempt to open the native app; fall back to web URL if app isn't installed
  const fallbackTimer = setTimeout(() => {
    window.location.href = webUrl;
  }, 1500);

  // If the app opens, the page loses focus — cancel the fallback redirect
  window.addEventListener("blur", () => clearTimeout(fallbackTimer), { once: true });

  window.location.href = deepLink;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showLoading() {
  container.innerHTML = `<p class="loading">Loading events…</p>`;
}

// ── Tab switching ──────────────────────────────────────

function setTab(tab) {
  activeTab = tab;
  btnUpcoming.classList.toggle("active", tab === "upcoming");
  btnPast.classList.toggle("active", tab === "past");
  renderTab();
}

btnUpcoming.addEventListener("click", () => setTab("upcoming"));
btnPast.addEventListener("click", () => setTab("past"));

// ── Init ───────────────────────────────────────────────

loadEvents();

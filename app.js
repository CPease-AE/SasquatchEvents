const TOKEN = "juJTxighw2ZZ1EZ8bay7J4c7H5JrJrFmLkJCMfwQ";
const GROUP_ID = "66189553";
const FALLBACK_AVATAR = "logo.png";

const STRAVA_CLIENT_ID     = "252495";
const STRAVA_CLIENT_SECRET = "1dc2922870cba8f6ee69f108e93ec8c39dd745b1";
const STRAVA_REFRESH_TOKEN = "71ab63e66b3539145c05111912a75cea0493845f";
const STRAVA_CLUB_ID       = "1655793";

const container = document.getElementById("events-container");
const btnUpcoming = document.getElementById("btn-upcoming");
const btnPast = document.getElementById("btn-past");
const avatarImg  = document.getElementById("group-avatar");
const clubFeedEl = document.getElementById("club-feed");
const groupNameEls = [
  document.getElementById("group-name"),
  document.getElementById("footer-group-name"),
];

let allEvents = [];
let stravaActivities = [];
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

    // Fetch Strava activities in parallel — re-render cards once loaded
    fetchStravaActivities()
      .then(() => { renderClubFeed(); renderTab(); })
      .catch((err) => console.warn("Strava fetch failed:", err));

    renderTab();
  } catch (err) {
    container.innerHTML = `<p class="empty-state"><span>⚠️</span>Failed to load events. Please try again later.</p>`;
    console.error("Error loading events:", err);
  }
}

// ── Strava ────────────────────────────────────────────

async function fetchStravaActivities() {
  const accessToken = await fetchStravaToken();

  // Fetch up to 200 club activities (max per Strava API)
  const pages = [1, 2, 3, 4, 5, 6, 7];
  const results = await Promise.all(
    pages.map((page) =>
      fetch(
        `https://www.strava.com/api/v3/clubs/${STRAVA_CLUB_ID}/activities?per_page=30&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).then((r) => (r.ok ? r.json() : []))
    )
  );

  stravaActivities = results.flat().filter(Boolean);
}

async function fetchStravaToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
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

  const stravaSection = buildCardStravaSection(ev, isPast);

  return `
    <article class="event-card${isPast ? " past" : ""}">
      <div class="event-card-header">
        <h2 class="event-name">${escapeHtml(ev.name)}</h2>
        <span class="event-date">${formattedDate} · ${formattedTime}</span>
      </div>
      ${description}
      ${location}
      <p class="event-attendees">${rsvp}</p>
      ${stravaSection}
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

// ── Strava club feed ──────────────────────────────────

function renderClubFeed() {
  if (!stravaActivities.length) return;

  const rides = stravaActivities.filter(
    (a) => a.sport_type === "Ride" || a.sport_type === "GravelRide" || a.sport_type === "VirtualRide" || a.type === "Ride"
  );

  const totalDistMi = (
    rides.reduce((s, a) => s + (a.distance || 0), 0) / 1609.344
  ).toFixed(0);
  const totalElevFt = Math.round(
    rides.reduce((s, a) => s + (a.total_elevation_gain || 0), 0) * 3.28084
  );
  const totalSec = rides.reduce((s, a) => s + (a.moving_time || 0), 0);
  const hours = Math.floor(totalSec / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const rows = rides
    .slice(0, 20)
    .map((a) => {
      const name    = escapeHtml(a.name || "Activity");
      const athlete = escapeHtml(
        `${a.athlete?.firstname || ""} ${a.athlete?.lastname || ""}`.trim() || "Member"
      );
      const distMi  = (a.distance / 1609.344).toFixed(1);
      const elevFt  = Math.round((a.total_elevation_gain || 0) * 3.28084);
      return `
        <li class="cf-row">
          <span class="cf-athlete">${athlete}</span>
          <span class="cf-name">${name}</span>
          <span class="cf-meta">${distMi} mi · ${elevFt.toLocaleString()} ft</span>
        </li>`;
    })
    .join("");

  const more = rides.length > 20
    ? `<p class="cf-more">+ ${rides.length - 20} more rides</p>`
    : "";

  clubFeedEl.innerHTML = `
    <section class="club-feed">
      <div class="cf-header">
        <svg class="strava-logo" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg" aria-label="Strava">
          <path d="M158.4 0L0 288h90.4L158.4 0zm28.8 64l97.6 224h-64L192 224l-28.8 64H100l87.2-224zm-28.8 288l32 96 32-96h-64z" fill="#fc4c02"/>
        </svg>
        <h2 class="cf-title">Recent Club Rides</h2>
        <div class="cf-stats">
          <span><strong>${rides.length}</strong> rides</span>
          <span><strong>${Number(totalDistMi).toLocaleString()}</strong> mi</span>
          <span><strong>${totalElevFt.toLocaleString()}</strong> ft</span>
          <span><strong>${timeStr}</strong></span>
        </div>
      </div>
      <ul class="cf-list">${rows}</ul>
      ${more}
    </section>`;
}

// ── Strava hashtag matching ───────────────────────────

function eventHashtag(ev) {
  const slug = (ev.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (ev.series_id) {
    const d = new Date(ev.start_at);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `#${slug}-${mm}${dd}`;
  }
  return `#${slug}`;
}

function matchActivitiesByHashtag(ev) {
  if (!stravaActivities.length) return [];
  const tag = eventHashtag(ev).toLowerCase();
  return stravaActivities.filter(
    (a) => a.name && a.name.toLowerCase().includes(tag)
  );
}

function buildCardStravaSection(ev, isPast) {
  const tag = eventHashtag(ev);

  if (!isPast) {
    return `
      <div class="ev-strava-prompt">
        <svg class="strava-logo" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M158.4 0L0 288h90.4L158.4 0zm28.8 64l97.6 224h-64L192 224l-28.8 64H100l87.2-224zm-28.8 288l32 96 32-96h-64z" fill="#fc4c02"/>
        </svg>
        <span>Tag your Strava ride <code class="ev-strava-tag">${escapeHtml(tag)}</code> to show up here</span>
      </div>`;
  }

  // Past event — only render section once Strava has loaded
  if (!stravaActivities.length) return "";

  const matches = matchActivitiesByHashtag(ev);

  if (matches.length === 0) {
    return `
      <div class="ev-strava-prompt ev-strava-past-empty">
        <svg class="strava-logo" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M158.4 0L0 288h90.4L158.4 0zm28.8 64l97.6 224h-64L192 224l-28.8 64H100l87.2-224zm-28.8 288l32 96 32-96h-64z" fill="#fc4c02"/>
        </svg>
        <span>No rides tagged yet &mdash; use <code class="ev-strava-tag">${escapeHtml(tag)}</code></span>
      </div>`;
  }

  const totalDistMi = (
    matches.reduce((s, a) => s + (a.distance || 0), 0) / 1609.344
  ).toFixed(1);
  const totalElevFt = Math.round(
    matches.reduce((s, a) => s + (a.total_elevation_gain || 0), 0) * 3.28084
  );
  const totalSec = matches.reduce((s, a) => s + (a.moving_time || 0), 0);
  const hrs  = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  const rows = matches.map((a) => {
    const name    = escapeHtml(a.name || "Activity");
    const athlete = escapeHtml(
      `${a.athlete?.firstname || ""} ${a.athlete?.lastname || ""}`.trim() || "Member"
    );
    const distMi = (a.distance / 1609.344).toFixed(1);
    return `
      <li class="ev-strava-row">
        <span class="ev-strava-athlete">${athlete}</span>
        <span class="ev-strava-name">${name}</span>
        <span class="ev-strava-dist">${distMi} mi</span>
      </li>`;
  }).join("");

  return `
    <div class="ev-strava-section">
      <div class="ev-strava-header">
        <svg class="strava-logo" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M158.4 0L0 288h90.4L158.4 0zm28.8 64l97.6 224h-64L192 224l-28.8 64H100l87.2-224zm-28.8 288l32 96 32-96h-64z" fill="#fc4c02"/>
        </svg>
        <div class="ev-strava-stats">
          <span><strong>${matches.length}</strong> ${matches.length === 1 ? "rider" : "riders"}</span>
          <span><strong>${totalDistMi}</strong> mi</span>
          <span><strong>${totalElevFt.toLocaleString()}</strong> ft</span>
          <span><strong>${timeStr}</strong></span>
        </div>
      </div>
      <ul class="ev-strava-list">${rows}</ul>
    </div>`;
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

const PROJECTIONS_API = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/players?scoringPeriodId=0&view=kona_player_info";

const TEAMS_API = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026?view=proTeamSchedules_wl";

const POSITION_BY_ID = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K" };



const state = {

  players: [],

  search: "",

  team: "",

  position: "",

  columnFilters: {},

  sortKey: "projectedFantasyPoints",

  sortDirection: "desc",

};



const elements = {

  rows: document.querySelector("#playerRows"),

  search: document.querySelector("#searchInput"),

  team: document.querySelector("#teamFilter"),

  positions: document.querySelector("#positionFilters"),

  columnFilters: document.querySelector(".filter-row"),

  tableTeam: document.querySelector("#tableTeamFilter"),

  resultCount: document.querySelector("#resultCount"),

  empty: document.querySelector("#emptyState"),

  clear: document.querySelector("#clearFilters"),

};



function calculatePprPoints(stats, position) {

  if (position === "K") {

    return (stats[74] || 0) * 3

      + (stats[77] || 0) * 4

      + (stats[80] || 0) * 5

      + (stats[86] || 0);

  }

  return (stats[3] || 0) * 0.04

    + (stats[4] || 0) * 4

    - (stats[20] || 0) * 2

    + (stats[24] || 0) * 0.1

    + (stats[25] || 0) * 6

    + (stats[42] || 0) * 0.1

    + (stats[43] || 0) * 6

    + (stats[53] || 0);

}



function transformEspnPlayers(records, teams) {

  const teamNames = new Map(teams.map((team) => [team.id, `${team.location} ${team.name}`]));

  const players = records.flatMap((record) => {

    const position = POSITION_BY_ID[record.defaultPositionId];

    if (!record.active || record.proTeamId <= 0 || !position || !teamNames.has(record.proTeamId)) return [];



    const projections = (record.stats || []).filter((stat) => (

      stat.seasonId === 2026 && stat.statSourceId === 1 && stat.statSplitTypeId === 1

    ));

    if (!projections.length) return [];



    const totals = projections.reduce((result, projection) => {

      const stats = projection.stats || {};

      result.points += calculatePprPoints(stats, position);

      result.touchdowns += (stats[4] || 0) + (stats[25] || 0) + (stats[43] || 0);

      result.yards += (stats[3] || 0) + (stats[24] || 0) + (stats[42] || 0);

      return result;

    }, { points: 0, touchdowns: 0, yards: 0 });

    if (totals.points <= 0) return [];



    return [{

      playerName: record.fullName,

      teamName: teamNames.get(record.proTeamId),

      position,

      projectedFantasyPoints: Number(totals.points.toFixed(1)),

      projectedTotalTds: Math.round(totals.touchdowns),

      projectedAllPurposeYards: Math.round(totals.yards),

      isQuestionable: record.injuryStatus === "QUESTIONABLE",

    }];

  });



  const positionGroups = new Map();

  players.forEach((player) => {

    const key = `${player.teamName}|${player.position}`;

    if (!positionGroups.has(key)) positionGroups.set(key, []);

    positionGroups.get(key).push(player);

  });

  positionGroups.forEach((group) => {

    group.sort((first, second) => second.projectedFantasyPoints - first.projectedFantasyPoints);

    group.forEach((player, index) => {

      player.depthRank = index + 1;

      player.playerRole = index === 0 ? "Starter" : index === 1 ? "Backup" : "Depth";

    });

  });



  [...players]

    .sort((first, second) => second.projectedFantasyPoints - first.projectedFantasyPoints)

    .forEach((player, index) => { player.projectionRank = index + 1; });

  return players;

}



function getFilteredPlayers() {

  const query = state.search.toLowerCase();

  const filtered = state.players.filter((player) => {

    const matchesSearch = !query || player.playerName.toLowerCase().includes(query) || player.teamName.toLowerCase().includes(query);

    const matchesColumns = Object.entries(state.columnFilters).every(([key, filter]) => {

      if (!filter.value) return true;

      const value = player[key];

      if (filter.mode === "contains") return String(value).toLowerCase().includes(filter.value.toLowerCase());

      if (filter.mode === "min") return value >= Number(filter.value);

      if (filter.mode === "max") return value <= Number(filter.value);

      return String(value) === filter.value;

    });

    return matchesSearch && matchesColumns && (!state.team || player.teamName === state.team) && (!state.position || player.position === state.position);

  });



  return filtered.sort((first, second) => {

    const a = first[state.sortKey];

    const b = second[state.sortKey];

    const comparison = typeof a === "number" ? a - b : String(a).localeCompare(String(b));

    return state.sortDirection === "asc" ? comparison : -comparison;

  });

}



function getInitials(name) {

  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

}



function formatNumber(value) {

  return new Intl.NumberFormat("en-US").format(value);

}



function render() {

  const players = getFilteredPlayers();



  elements.rows.replaceChildren(...players.map((player) => {

    const row = document.createElement("tr");

    row.classList.toggle("questionable-row", player.isQuestionable);

    row.innerHTML = `

      <td class="rank-column">${String(player.projectionRank).padStart(2, "0")}</td>

      <td><div class="player-cell"><span class="avatar">${escapeHTML(getInitials(player.playerName))}</span><span class="player-name">${escapeHTML(player.playerName)}</span>${player.isQuestionable ? '<span class="questionable-flag" title="Questionable — verify status before selecting">Q</span>' : ""}</div></td>

      <td class="team-name">${escapeHTML(player.teamName)}</td>

      <td><span class="position-badge pos-${escapeHTML(player.position)}">${escapeHTML(player.position)}</span></td>

      <td><span class="role-badge role-${player.playerRole.toLowerCase()}">${player.playerRole}</span></td>

      <td class="number-column points">${player.projectedFantasyPoints.toFixed(1)}</td>

      <td class="number-column">${formatNumber(player.projectedTotalTds)}</td>

      <td class="number-column">${formatNumber(player.projectedAllPurposeYards)}</td>

      <td class="number-column depth">${player.depthRank}</td>`;

    return row;

  }));



  elements.resultCount.textContent = `${formatNumber(players.length)} ${players.length === 1 ? "player" : "players"}`;

  elements.empty.hidden = players.length !== 0;

}



function escapeHTML(value) {

  return String(value).replace(/[&<>'"]/g, (character) => ({

    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",

  })[character]);

}



function resetPageAndRender() {

  render();

}



function attachEvents() {

  let searchTimer;

  elements.search.addEventListener("input", (event) => {

    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {

      state.search = event.target.value.trim();

      resetPageAndRender();

    }, 120);

  });



  elements.team.addEventListener("change", (event) => {

    state.team = event.target.value;

    resetPageAndRender();

  });



  elements.positions.addEventListener("click", (event) => {

    const button = event.target.closest("button[data-position]");

    if (!button) return;

    state.position = button.dataset.position;

    elements.positions.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));

    resetPageAndRender();

  });



  let columnFilterTimer;

  elements.columnFilters.addEventListener("input", (event) => {

    const control = event.target.closest("[data-filter-key]");

    if (!control) return;

    clearTimeout(columnFilterTimer);

    columnFilterTimer = setTimeout(() => {

      const key = control.dataset.filterKey;

      if (key === "teamName") {

        state.team = control.value;

        elements.team.value = control.value;

      } else if (key === "position") {

        state.position = control.value;

        elements.positions.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.position === control.value));

      } else {

        state.columnFilters[key] = { value: control.value.trim(), mode: control.dataset.filterMode || "equals" };

      }

      resetPageAndRender();

    }, control.tagName === "SELECT" ? 0 : 120);

  });



  document.querySelectorAll(".sort-button").forEach((button) => {

    button.addEventListener("click", () => {

      const sameColumn = state.sortKey === button.dataset.key;

      state.sortDirection = sameColumn && state.sortDirection === "desc" ? "asc" : "desc";

      state.sortKey = button.dataset.key;

      document.querySelectorAll(".sort-button").forEach((item) => {

        item.classList.toggle("active", item === button);

        item.classList.toggle("descending", item === button && state.sortDirection === "desc");

        item.setAttribute("aria-sort", item === button ? (state.sortDirection === "desc" ? "descending" : "ascending") : "none");

      });

      resetPageAndRender();

    });

  });



  elements.clear.addEventListener("click", clearFilters);

  document.addEventListener("keydown", (event) => {

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {

      event.preventDefault();

      elements.search.focus();

    }

  });

}



function clearFilters() {

  state.search = "";

  state.team = "";

  state.position = "";

  state.columnFilters = {};

  elements.search.value = "";

  elements.team.value = "";

  elements.columnFilters.querySelectorAll("input, select").forEach((control) => { control.value = ""; });

  elements.positions.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.position === ""));

  resetPageAndRender();

}



function populateSummary() {

  const teams = [...new Set(state.players.map((player) => player.teamName))].sort();

  const topPlayer = [...state.players].sort((a, b) => b.projectedFantasyPoints - a.projectedFantasyPoints)[0];



  document.querySelector("#playerCount").textContent = formatNumber(state.players.length);

  document.querySelector("#teamCount").textContent = formatNumber(teams.length);

  document.querySelector("#topPoints").textContent = topPlayer.projectedFantasyPoints.toFixed(1);

  document.querySelector("#topPlayer").textContent = topPlayer.playerName;



  teams.forEach((team) => {

    [elements.team, elements.tableTeam].forEach((select) => {

      const option = document.createElement("option");

      option.value = team;

      option.textContent = team;

      select.append(option);

    });

  });

}



async function initialize() {

  attachEvents();

  try {

    const playerFilter = { players: { limit: 2000 } };

    const [playerResponse, teamResponse] = await Promise.all([

      fetch(PROJECTIONS_API, { headers: { "x-fantasy-filter": JSON.stringify(playerFilter) } }),

      fetch(TEAMS_API),

    ]);

    if (!playerResponse.ok || !teamResponse.ok) throw new Error("ESPN projection request failed");

    const [playerData, teamData] = await Promise.all([playerResponse.json(), teamResponse.json()]);

    state.players = transformEspnPlayers(playerData, teamData.settings.proTeams);

    populateSummary();

    render();

  } catch (error) {

    console.error(error);

    document.querySelector(".table-wrap").replaceChildren(document.querySelector("#errorTemplate").content.cloneNode(true));

    elements.resultCount.textContent = "Data unavailable";

  }

}



initialize();

const PROJECTIONS_API = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/players?scoringPeriodId=0&view=kona_player_info";
const TEAMS_API = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026?view=proTeamSchedules_wl";
const PAGE_SIZE = 20;
const POSITION_BY_ID = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K" };

const state = {
  players: [],
  search: "",
  team: "",
  position: "",
  columnFilters: {},
  sortKey: "projectedFantasyPoints",
  sortDirection: "desc",
  page: 1,
};

const elements = {
  rows: document.querySelector("#playerRows"),
  search: document.querySelector("#searchInput"),
  team: document.querySelector("#teamFilter"),
  positions: document.querySelector("#positionFilters"),
  columnFilters: document.querySelector(".filter-row"),
  tableTeam: document.querySelector("#tableTeamFilter"),
  resultCount: document.querySelector("#resultCount"),
  pagination: document.querySelector("#pagination"),
  empty: document.querySelector("#emptyState"),
  clear: document.querySelector("#clearFilters"),
};

function calculatePprPoints(stats, position) {
  if (position === "K") {
    return (stats[74] || 0) * 3
      + (stats[77] || 0) * 4
      + (stats[80] || 0) * 5
      + (stats[86] || 0);
  }
  return (stats[3] || 0) * 0.04
    + (stats[4] || 0) * 4
    - (stats[20] || 0) * 2
    + (stats[24] || 0) * 0.1
    + (stats[25] || 0) * 6
    + (stats[42] || 0) * 0.1
    + (stats[43] || 0) * 6
    + (stats[53] || 0);
}

function transformEspnPlayers(records, teams) {
  const teamNames = new Map(teams.map((team) => [team.id, `${team.location} ${team.name}`]));
  const players = records.flatMap((record) => {
    const position = POSITION_BY_ID[record.defaultPositionId];
    if (!record.active || record.proTeamId <= 0 || !position || !teamNames.has(record.proTeamId)) return [];

    const projections = (record.stats || []).filter((stat) => (
      stat.seasonId === 2026 && stat.statSourceId === 1 && stat.statSplitTypeId === 1
    ));
    if (!projections.length) return [];

    const totals = projections.reduce((result, projection) => {
      const stats = projection.stats || {};
      result.points += calculatePprPoints(stats, position);
      result.touchdowns += (stats[4] || 0) + (stats[25] || 0) + (stats[43] || 0);
      result.yards += (stats[3] || 0) + (stats[24] || 0) + (stats[42] || 0);
      return result;
    }, { points: 0, touchdowns: 0, yards: 0 });
    if (totals.points <= 0) return [];

    return [{
      playerName: record.fullName,
      teamName: teamNames.get(record.proTeamId),
      position,
      projectedFantasyPoints: Number(totals.points.toFixed(1)),
      projectedTotalTds: Math.round(totals.touchdowns),
      projectedAllPurposeYards: Math.round(totals.yards),
      isQuestionable: record.injuryStatus === "QUESTIONABLE",
    }];
  });

  const positionGroups = new Map();
  players.forEach((player) => {
    const key = `${player.teamName}|${player.position}`;
    if (!positionGroups.has(key)) positionGroups.set(key, []);
    positionGroups.get(key).push(player);
  });
  positionGroups.forEach((group) => {
    group.sort((first, second) => second.projectedFantasyPoints - first.projectedFantasyPoints);
    group.forEach((player, index) => {
      player.depthRank = index + 1;
      player.playerRole = index === 0 ? "Starter" : index === 1 ? "Backup" : "Depth";
    });
  });

  [...players]
    .sort((first, second) => second.projectedFantasyPoints - first.projectedFantasyPoints)
    .forEach((player, index) => { player.projectionRank = index + 1; });
  return players;
}

function getFilteredPlayers() {
  const query = state.search.toLowerCase();
  const filtered = state.players.filter((player) => {
    const matchesSearch = !query || player.playerName.toLowerCase().includes(query) || player.teamName.toLowerCase().includes(query);
    const matchesColumns = Object.entries(state.columnFilters).every(([key, filter]) => {
      if (!filter.value) return true;
      const value = player[key];
      if (filter.mode === "contains") return String(value).toLowerCase().includes(filter.value.toLowerCase());
      if (filter.mode === "min") return value >= Number(filter.value);
      if (filter.mode === "max") return value <= Number(filter.value);
      return String(value) === filter.value;
    });
    return matchesSearch && matchesColumns && (!state.team || player.teamName === state.team) && (!state.position || player.position === state.position);
  });

  return filtered.sort((first, second) => {
    const a = first[state.sortKey];
    const b = second[state.sortKey];
    const comparison = typeof a === "number" ? a - b : String(a).localeCompare(String(b));
    return state.sortDirection === "asc" ? comparison : -comparison;
  });
}

function getInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function render() {
  const players = getFilteredPlayers();
  const pageCount = Math.max(1, Math.ceil(players.length / PAGE_SIZE));
  state.page = Math.min(state.page, pageCount);
  const offset = (state.page - 1) * PAGE_SIZE;
  const visiblePlayers = players.slice(offset, offset + PAGE_SIZE);

  elements.rows.replaceChildren(...visiblePlayers.map((player, index) => {
    const row = document.createElement("tr");
    row.classList.toggle("questionable-row", player.isQuestionable);
    row.innerHTML = `
      <td class="rank-column">${String(player.projectionRank).padStart(2, "0")}</td>
      <td><div class="player-cell"><span class="avatar">${escapeHTML(getInitials(player.playerName))}</span><span class="player-name">${escapeHTML(player.playerName)}</span>${player.isQuestionable ? '<span class="questionable-flag" title="Questionable — verify status before selecting">Q</span>' : ""}</div></td>
      <td class="team-name">${escapeHTML(player.teamName)}</td>
      <td><span class="position-badge pos-${escapeHTML(player.position)}">${escapeHTML(player.position)}</span></td>
      <td><span class="role-badge role-${player.playerRole.toLowerCase()}">${player.playerRole}</span></td>
      <td class="number-column points">${player.projectedFantasyPoints.toFixed(1)}</td>
      <td class="number-column">${formatNumber(player.projectedTotalTds)}</td>
      <td class="number-column">${formatNumber(player.projectedAllPurposeYards)}</td>
      <td class="number-column depth">${player.depthRank}</td>`;
    return row;
  }));

  elements.resultCount.textContent = `${formatNumber(players.length)} ${players.length === 1 ? "player" : "players"}`;
  elements.empty.hidden = players.length !== 0;
  renderPagination(pageCount);
}

function renderPagination(pageCount) {
  elements.pagination.replaceChildren();
  if (pageCount <= 1) return;

  elements.pagination.append(makePageButton("←", state.page - 1, state.page === 1, "Previous page"));

  const pages = getVisiblePages(pageCount);
  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "ellipsis";
      ellipsis.textContent = "…";
      elements.pagination.append(ellipsis);
    }
    elements.pagination.append(makePageButton(page, page, false, `Page ${page}`, page === state.page));
  });

  elements.pagination.append(makePageButton("→", state.page + 1, state.page === pageCount, "Next page"));
}

function getVisiblePages(pageCount) {
  const pages = new Set([1, pageCount]);
  for (let page = Math.max(1, state.page - 1); page <= Math.min(pageCount, state.page + 1); page += 1) pages.add(page);
  return [...pages].sort((a, b) => a - b);
}

function makePageButton(label, page, disabled, ariaLabel, active = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  button.ariaLabel = ariaLabel;
  button.classList.toggle("active", active);
  if (active) button.setAttribute("aria-current", "page");
  button.addEventListener("click", () => {
    state.page = page;
    render();
    document.querySelector(".draftboard").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return button;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function resetPageAndRender() {
  state.page = 1;
  render();
}

function attachEvents() {
  let searchTimer;
  elements.search.addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = event.target.value.trim();
      resetPageAndRender();
    }, 120);
  });

  elements.team.addEventListener("change", (event) => {
    state.team = event.target.value;
    resetPageAndRender();
  });

  elements.positions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-position]");
    if (!button) return;
    state.position = button.dataset.position;
    elements.positions.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    resetPageAndRender();
  });

  let columnFilterTimer;
  elements.columnFilters.addEventListener("input", (event) => {
    const control = event.target.closest("[data-filter-key]");
    if (!control) return;
    clearTimeout(columnFilterTimer);
    columnFilterTimer = setTimeout(() => {
      const key = control.dataset.filterKey;
      if (key === "teamName") {
        state.team = control.value;
        elements.team.value = control.value;
      } else if (key === "position") {
        state.position = control.value;
        elements.positions.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.position === control.value));
      } else {
        state.columnFilters[key] = { value: control.value.trim(), mode: control.dataset.filterMode || "equals" };
      }
      resetPageAndRender();
    }, control.tagName === "SELECT" ? 0 : 120);
  });

  document.querySelectorAll(".sort-button").forEach((button) => {
    button.addEventListener("click", () => {
      const sameColumn = state.sortKey === button.dataset.key;
      state.sortDirection = sameColumn && state.sortDirection === "desc" ? "asc" : "desc";
      state.sortKey = button.dataset.key;
      document.querySelectorAll(".sort-button").forEach((item) => {
        item.classList.toggle("active", item === button);
        item.classList.toggle("descending", item === button && state.sortDirection === "desc");
        item.setAttribute("aria-sort", item === button ? (state.sortDirection === "desc" ? "descending" : "ascending") : "none");
      });
      resetPageAndRender();
    });
  });

  elements.clear.addEventListener("click", clearFilters);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      elements.search.focus();
    }
  });
}

function clearFilters() {
  state.search = "";
  state.team = "";
  state.position = "";
  state.columnFilters = {};
  elements.search.value = "";
  elements.team.value = "";
  elements.columnFilters.querySelectorAll("input, select").forEach((control) => { control.value = ""; });
  elements.positions.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.position === ""));
  resetPageAndRender();
}

function populateSummary() {
  const teams = [...new Set(state.players.map((player) => player.teamName))].sort();
  const topPlayer = [...state.players].sort((a, b) => b.projectedFantasyPoints - a.projectedFantasyPoints)[0];

  document.querySelector("#playerCount").textContent = formatNumber(state.players.length);
  document.querySelector("#teamCount").textContent = formatNumber(teams.length);
  document.querySelector("#topPoints").textContent = topPlayer.projectedFantasyPoints.toFixed(1);
  document.querySelector("#topPlayer").textContent = topPlayer.playerName;

  teams.forEach((team) => {
    [elements.team, elements.tableTeam].forEach((select) => {
      const option = document.createElement("option");
      option.value = team;
      option.textContent = team;
      select.append(option);
    });
  });
}

async function initialize() {
  attachEvents();
  try {
    const playerFilter = { players: { limit: 2000 } };
    const [playerResponse, teamResponse] = await Promise.all([
      fetch(PROJECTIONS_API, { headers: { "x-fantasy-filter": JSON.stringify(playerFilter) } }),
      fetch(TEAMS_API),
    ]);
    if (!playerResponse.ok || !teamResponse.ok) throw new Error("ESPN projection request failed");
    const [playerData, teamData] = await Promise.all([playerResponse.json(), teamResponse.json()]);
    state.players = transformEspnPlayers(playerData, teamData.settings.proTeams);
    populateSummary();
    render();
  } catch (error) {
    console.error(error);
    document.querySelector(".table-wrap").replaceChildren(document.querySelector("#errorTemplate").content.cloneNode(true));
    elements.resultCount.textContent = "Data unavailable";
  }
}

initialize();

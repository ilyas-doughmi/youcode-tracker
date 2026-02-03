console.log("[YC Plus] Loading...");

let allAssignments = [];
let currentFilter = 'week';
let typeFilter = 'all';
let isScanning = false;

function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function isThisWeek(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const monday = getMonday(now);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    monday.setHours(0, 0, 0, 0);
    nextMonday.setHours(0, 0, 0, 0);
    return d >= monday && d < nextMonday;
}

function getAssignmentType(item) {
    if (item.type && item.type.name) {
        const name = item.type.name.toLowerCase();
        if (name.includes('veille')) return 'veille';
        if (name.includes('live')) return 'live';
    }
    return 'other';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(/-/g, "/"));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getDateStatus(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((targetDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'past';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    return 'future';
}

function scanPageForUsers() {
    const users = new Map();
    $('a[href*="/profile/"]').each(function () {
        const href = $(this).attr('href');
        const match = href.match(/\/profile\/([^\/]+)/);
        if (match && match[1]) {
            let u = decodeURIComponent(match[1]);
            if (u !== 'me' && u !== 'null' && u !== 'undefined' && !users.has(u)) {
                const $parent = $(this).closest('tr, .card, .user-item, div');
                const $img = $parent.find('img').first();
                const photo = $img.attr('src') || null;
                users.set(u, { photo });
            }
        }
    });
    return users;
}

async function fetchUserAssignments(username) {
    const url = `/profile/${encodeURIComponent(username)}/assignments`;
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (e) { return null; }
}

async function runClassScan() {
    if (isScanning) return;
    isScanning = true;

    const usersMap = scanPageForUsers();
    const users = Array.from(usersMap.entries());

    if (users.length === 0) {
        alert("No users found! Go to Leaderboard first.");
        isScanning = false;
        return;
    }

    const list = document.getElementById('yc-dashboard-content');
    list.innerHTML = `<div class="yc-empty"><div class="yc-loader"></div><p>Scanning ${users.length} users...</p></div>`;

    allAssignments = [];

    const results = await Promise.all(users.map(async ([username, info]) => {
        const data = await fetchUserAssignments(username);
        if (data) {
            let userItems = data.assignments || (Array.isArray(data) ? data : []);
            return userItems.map(item => ({
                ...item,
                owner: username,
                ownerPhoto: info.photo || item.learner?.photo || null,
                ownerName: item.learner ? `${item.learner.first_name} ${item.learner.last_name}` : username
            }));
        }
        return [];
    }));

    allAssignments = results.flat();
    isScanning = false;
    renderDashboard();
}

function groupAssignments(items) {
    const groups = new Map();
    items.forEach(item => {
        const key = `${item.subject || item.title}_${item.datetime}`;
        if (!groups.has(key)) {
            groups.set(key, {
                subject: item.subject || item.title,
                datetime: item.datetime,
                type: getAssignmentType(item),
                owners: []
            });
        }
        groups.get(key).owners.push({
            name: item.ownerName || item.owner,
            photo: item.ownerPhoto,
            username: item.owner
        });
    });
    return Array.from(groups.values());
}

function filterAssignments() {
    let filtered = allAssignments.filter(item => {
        const type = getAssignmentType(item);
        if (typeFilter === 'veille') return type === 'veille';
        if (typeFilter === 'live') return type === 'live';
        return type === 'veille' || type === 'live';
    });

    if (currentFilter === 'week') {
        filtered = filtered.filter(item => isThisWeek(item.datetime));
    }

    return filtered;
}

function renderDashboard() {
    const list = document.getElementById('yc-dashboard-content');
    if (!list) return;

    const items = filterAssignments();
    const grouped = groupAssignments(items);
    grouped.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    if (grouped.length === 0) {
        list.innerHTML = `<div class="yc-empty"><p>No assignments found.</p></div>`;
        return;
    }

    let html = '';
    grouped.forEach(group => {
        const dateStatus = getDateStatus(group.datetime);

        const avatarsHtml = group.owners.map(o => {
            let photoUrl = o.photo
                ? (o.photo.startsWith('http') ? o.photo : `https://intranet.youcode.ma/storage/users/profile/thumbnail/${o.photo}`)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(o.name)}&background=7b1fa2&color=fff&size=80`;
            return `<img src="${photoUrl}" title="${o.name}" class="yc-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(o.name)}&background=7b1fa2&color=fff'">`;
        }).join('');

        const ownerNames = group.owners.map(o => o.name.split(' ')[0]).join(' & ');
        const typeLabel = group.type === 'veille' ? 'Veille' : 'Live Coding';

        html += `
            <div class="yc-card type-${group.type} date-${dateStatus}">
                <div class="yc-date-badge">${dateStatus}</div>
                <div class="yc-card-header">
                    <div class="yc-avatars">${avatarsHtml}</div>
                    <div class="yc-card-info">
                        <div class="yc-type-badge">${typeLabel}</div>
                        <div class="yc-card-title">${group.subject}</div>
                        <div class="yc-card-meta">
                            <span>${ownerNames}</span>
                            <span>${formatDate(group.datetime)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
}

function createDashboard() {
    if (document.getElementById('yc-dashboard-container')) return;

    const container = document.createElement('div');
    container.id = 'yc-dashboard-container';

    container.innerHTML = `
        <div id="yc-header">
            <h2>YouCode Tracker</h2>
            <button id="yc-minimize-btn">-</button>
        </div>
        
        <div class="yc-filters">
            <button id="yc-scan-class-btn">SCAN</button>
            <div class="yc-tag-filter" id="type-filter">
                <div class="yc-tag active" data-type="all">All</div>
                <div class="yc-tag" data-type="veille">Veille</div>
                <div class="yc-tag" data-type="live">Live Coding</div>
            </div>
        </div>
        
        <div class="yc-filters">
            <div class="yc-tag-filter" id="date-filter">
                <div class="yc-tag active" data-filter="week">This Week</div>
                <div class="yc-tag" data-filter="all">All Time</div>
            </div>
        </div>

        <div class="yc-legend">
            <span class="legend-past">Past</span>
            <span class="legend-today">Today</span>
            <span class="legend-tomorrow">Tomorrow</span>
            <span class="legend-future">Future</span>
        </div>
        
        <div id="yc-dashboard-content">
            <div class="yc-empty">Go to Leaderboard and click Scan</div>
        </div>
    `;

    document.body.appendChild(container);

    container.querySelector('#yc-minimize-btn').onclick = (e) => {
        e.stopPropagation();
        container.classList.toggle('minimized');
    };

    container.onclick = (e) => {
        if (container.classList.contains('minimized')) container.classList.remove('minimized');
    };

    container.querySelectorAll('#type-filter .yc-tag').forEach(tag => {
        tag.onclick = () => {
            container.querySelectorAll('#type-filter .yc-tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            typeFilter = tag.dataset.type;
            renderDashboard();
        };
    });

    container.querySelectorAll('#date-filter .yc-tag').forEach(tag => {
        tag.onclick = () => {
            container.querySelectorAll('#date-filter .yc-tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            currentFilter = tag.dataset.filter;
            renderDashboard();
        };
    });

    document.getElementById('yc-scan-class-btn').onclick = runClassScan;
}

setTimeout(createDashboard, 800);

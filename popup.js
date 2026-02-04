let allAssignments = [];
let typeFilter = 'all';
let dateFilter = 'week';

document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
    };
});

document.getElementById('type-filter').onchange = (e) => {
    typeFilter = e.target.value;
    renderAssignments();
};

document.getElementById('date-filter').onchange = (e) => {
    dateFilter = e.target.value;
    renderAssignments();
};

document.getElementById('scan-btn').onclick = async () => {
    const btn = document.getElementById('scan-btn');
    btn.disabled = true;
    btn.textContent = 'SCANNING...';

    const list = document.getElementById('assignment-list');
    list.innerHTML = '<div class="loader"></div>';

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('youcode.ma')) {
            list.innerHTML = '<div class="empty-state">Please navigate to YouCode Intranet</div>';
            btn.disabled = false;
            btn.textContent = 'SCAN CLASS';
            return;
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scanPageAndFetch,
            world: 'MAIN'
        });

        if (results && results[0] && results[0].result) {
            allAssignments = results[0].result;
            renderAssignments();
            renderStats();
            document.getElementById('export-btn').style.display = 'block';
        }
    } catch (e) {
        list.innerHTML = '<div class="empty-state">Error scanning. Try refreshing the page.</div>';
        console.error(e);
    }

    btn.disabled = false;
    btn.textContent = 'SCAN CLASS';
};

document.getElementById('export-btn').onclick = () => {
    const filtered = filterAssignments();
    if (filtered.length === 0) {
        alert('No assignments to export');
        return;
    }

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//YouCode Tracker//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    filtered.forEach(group => {
        const owners = group.owners.map(o => o.name).join(', ');
        const startDate = new Date(group.datetime);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

        const formatICSDate = (d) => {
            return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        icsContent += `BEGIN:VEVENT
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${group.type === 'veille' ? 'Veille' : 'Live Coding'}: ${group.subject}
DESCRIPTION:Presenters: ${owners}
END:VEVENT
`;
    });

    icsContent += 'END:VCALENDAR';

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youcode-assignments.ics';
    a.click();
    URL.revokeObjectURL(url);
};

function getMonday(d) {
    d = new Date(d);
    const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function isThisWeek(dateStr) {
    const d = new Date(dateStr);
    const monday = getMonday(new Date());
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    monday.setHours(0, 0, 0, 0);
    nextMonday.setHours(0, 0, 0, 0);
    return d >= monday && d < nextMonday;
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

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getAssignmentType(item) {
    if (item.type && item.type.name) {
        const name = item.type.name.toLowerCase();
        if (name.includes('veille')) return 'veille';
        if (name.includes('live')) return 'live';
    }
    return 'other';
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

    if (dateFilter === 'week') {
        filtered = filtered.filter(item => isThisWeek(item.datetime));
    }

    return groupAssignments(filtered);
}

function renderAssignments() {
    const list = document.getElementById('assignment-list');
    const grouped = filterAssignments();
    grouped.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    if (grouped.length === 0) {
        list.innerHTML = '<div class="empty-state">No assignments found</div>';
        return;
    }

    let html = '';
    grouped.forEach(group => {
        const dateStatus = getDateStatus(group.datetime);

        const avatarsHtml = group.owners.map(o => {
            let photoUrl = o.photo
                ? (o.photo.startsWith('http') ? o.photo : `https://intranet.youcode.ma/storage/users/profile/thumbnail/${o.photo}`)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(o.name)}&background=7b1fa2&color=fff&size=64`;
            return `<img src="${photoUrl}" title="${o.name}" class="avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(o.name)}&background=7b1fa2&color=fff'">`;
        }).join('');

        const ownerNames = group.owners.map(o => o.name.split(' ')[0]).join(' & ');
        const typeLabel = group.type === 'veille' ? 'Veille' : 'Live Coding';

        html += `
            <div class="card date-${dateStatus}">
                <div class="date-badge">${dateStatus}</div>
                <div class="card-header">
                    <div class="avatars">${avatarsHtml}</div>
                    <div class="card-info">
                        <div class="card-type">${typeLabel}</div>
                        <div class="card-title">${group.subject}</div>
                        <div class="card-meta">${ownerNames} - ${formatDate(group.datetime)}</div>
                    </div>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
}

function renderStats() {
    const container = document.getElementById('stats-content');

    const stats = {};
    allAssignments.forEach(item => {
        const type = getAssignmentType(item);
        if (type !== 'veille' && type !== 'live') return;

        const name = item.ownerName || item.owner;
        if (!stats[name]) {
            stats[name] = { veille: 0, live: 0, photo: item.ownerPhoto };
        }
        if (type === 'veille') stats[name].veille++;
        if (type === 'live') stats[name].live++;
    });

    const sorted = Object.entries(stats).sort((a, b) =>
        (b[1].veille + b[1].live) - (a[1].veille + a[1].live)
    );

    const maxCount = sorted.length > 0 ? sorted[0][1].veille + sorted[0][1].live : 1;

    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state">No stats available</div>';
        return;
    }

    let html = '';
    sorted.forEach(([name, data]) => {
        const total = data.veille + data.live;
        const pct = (total / maxCount) * 100;

        let photoUrl = data.photo
            ? (data.photo.startsWith('http') ? data.photo : `https://intranet.youcode.ma/storage/users/profile/thumbnail/${data.photo}`)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7b1fa2&color=fff&size=64`;

        html += `
            <div class="stat-card">
                <img src="${photoUrl}" class="stat-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7b1fa2&color=fff'">
                <div class="stat-info">
                    <div class="stat-name">${name}</div>
                    <div class="stat-count">${data.veille} Veilles, ${data.live} Live Coding</div>
                    <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
                </div>
                <div class="stat-number">${total}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function scanPageAndFetch() {
    const users = new Map();

    document.querySelectorAll('a[href*="/profile/"]').forEach(link => {
        const href = link.getAttribute('href');
        const match = href.match(/\/profile\/([^\/]+)/);
        if (match && match[1]) {
            let u = decodeURIComponent(match[1]);
            if (u !== 'me' && u !== 'null' && u !== 'undefined' && !users.has(u)) {
                const parent = link.closest('tr, .card, div');
                const img = parent ? parent.querySelector('img') : null;
                const photo = img ? img.getAttribute('src') : null;
                users.set(u, { photo });
            }
        }
    });

    const userList = Array.from(users.entries());
    if (userList.length === 0) return [];

    const fetchUser = async (username) => {
        try {
            const response = await fetch(`/profile/${encodeURIComponent(username)}/assignments`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!response.ok) return [];
            const data = await response.json();
            let items = data.assignments || (Array.isArray(data) ? data : []);
            return items.map(item => ({
                ...item,
                owner: username,
                ownerPhoto: users.get(username)?.photo || item.learner?.photo || null,
                ownerName: item.learner ? `${item.learner.first_name} ${item.learner.last_name}` : username
            }));
        } catch (e) {
            return [];
        }
    };

    const results = await Promise.all(userList.map(([username]) => fetchUser(username)));
    return results.flat();
}

let allAssignments = [];
let typeFilter = 'all';
let dateFilter = 'week';
let sortOrder = 'future-today-past';
let statsSearchTerm = '';

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

document.getElementById('sort-filter').onchange = (e) => {
    sortOrder = e.target.value;
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
    const filtered = filterAssignments();

    const groups = {
        past: { title: 'Past', items: [] },
        today: { title: 'Today', items: [] },
        tomorrow: { title: 'Tomorrow', items: [] },
        future: { title: 'Future', items: [] }
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    filtered.forEach(item => {
        const date = new Date(item.datetime);
        const dateStr = date.toDateString();

        if (date < today) groups.past.items.push(item);
        else if (dateStr === today.toDateString()) groups.today.items.push(item);
        else if (dateStr === tomorrow.toDateString()) groups.tomorrow.items.push(item);
        else groups.future.items.push(item);
    });

    const orders = {
        'future-today-past': ['future', 'tomorrow', 'today', 'past'],
        'today-future-past': ['today', 'tomorrow', 'future', 'past'],
        'today-past-future': ['today', 'past', 'tomorrow', 'future'],
        'past-today-future': ['past', 'today', 'tomorrow', 'future']
    };

    const sectionsToRender = orders[sortOrder] || orders['future-today-past'];

    let html = '';

    sectionsToRender.forEach(key => {
        const group = groups[key];
        if (group && group.items.length > 0) {
            if (key === 'past') {
                group.items.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
            } else {
                group.items.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
            }

            html += `<div class="section-title">${group.title}</div>`;
            group.items.forEach(item => {
                const type = getAssignmentType(item);
                const typeLabel = type === 'veille' ? 'Veille' : 'Live Coding';

                const avatarsHtml = item.owners.map(o => {
                    let photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(o.name)}&background=7b1fa2&color=fff&size=64`;
                    return `<img src="${photoUrl}" title="${o.name}" class="avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(o.name)}&background=7b1fa2&color=fff'">`;
                }).join('');

                const ownerNames = item.owners.map(o => o.name.split(' ')[0]).join(' & ');

                html += `
                    <div class="card type-${type}">
                        <div class="card-header">
                            <div class="avatars">${avatarsHtml}</div>
                            <div class="card-info">
                                <span class="card-type">${typeLabel}</span>
                                <div class="card-title">${item.subject}</div>
                                <div class="card-meta">${ownerNames} - ${formatDate(item.datetime)}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    });

    list.innerHTML = html;
}

function renderStats() {
    const container = document.getElementById('stats-content');

    const searchInput = document.getElementById('stats-search');
    searchInput.oninput = (e) => {
        statsSearchTerm = e.target.value.toLowerCase();
        renderStats();
    };

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

    let sorted = Object.entries(stats).sort((a, b) =>
        (b[1].veille + b[1].live) - (a[1].veille + a[1].live)
    );

    if (statsSearchTerm) {
        sorted = sorted.filter(([name]) => name.toLowerCase().includes(statsSearchTerm));
    }

    const maxCount = sorted.length > 0 ? sorted[0][1].veille + sorted[0][1].live : 1;

    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state">No stats available</div>';
        return;
    }

    let html = '';
    sorted.forEach(([name, data]) => {
        const total = data.veille + data.live;
        const pct = (total / maxCount) * 100;

        let photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7b1fa2&color=fff&size=64`;

        html += `
            <div class="stat-card" data-name="${name}">
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

    container.querySelectorAll('.stat-card').forEach(card => {
        card.onclick = () => {
            const name = card.dataset.name;
            showStudentDetail(name);
        };
    });
}

function showStudentDetail(name) {
    const detailView = document.getElementById('student-detail-view');
    const statsContent = document.getElementById('stats-content');
    const searchContainer = document.querySelector('.search-container');
    const content = document.getElementById('student-detail-content');
    content.scrollTop = 0;

    statsContent.style.display = 'none';
    searchContainer.style.display = 'none';
    detailView.style.display = 'flex';

    let statsData = { veille: 0, live: 0, photo: null, fullName: name };

    allAssignments.forEach(item => {
        const ownerName = item.ownerName || item.owner;
        if (ownerName === name) {
            const type = getAssignmentType(item);
            if (type === 'veille') statsData.veille++;
            if (type === 'live') statsData.live++;
            if (!statsData.photo && item.ownerPhoto) statsData.photo = item.ownerPhoto;

            if (item.student_name) statsData.fullName = item.student_name;
        }
    });

    if (statsData.fullName === name) {
        for (const item of allAssignments) {
            if (item.assignments) {
                const selfAsLearner = item.assignments.find(a => a.learner && a.learner.username === name);
                if (selfAsLearner) {
                    statsData.fullName = `${selfAsLearner.learner.first_name} ${selfAsLearner.learner.last_name}`;
                    break;
                }
            }
        }
    }

    const studentAssignments = allAssignments.filter(item => {
        const ownerName = item.ownerName || item.owner;
        const type = getAssignmentType(item);
        return ownerName === name && (type === 'veille' || type === 'live');
    });

    studentAssignments.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

    let photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(statsData.fullName)}&background=7b1fa2&color=fff&size=64`;
    if (statsData.photo) photoUrl = statsData.photo;

    let html = `
        <div class="student-profile-header">
            <img src="${photoUrl}" class="large-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(statsData.fullName)}&background=7b1fa2&color=fff'">
            <div class="student-name-large">${statsData.fullName}</div>
            <div class="student-stats-summary">${statsData.veille} Veilles · ${statsData.live} Live Coding</div>
        </div>
        
        <div class="profile-filters">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="veille">Veille</button>
            <button class="filter-btn" data-filter="live">Live Coding</button>
        </div>

        <div class="activity-list">
    `;

    const collabStats = {};

    if (studentAssignments.length === 0) {
        html += '<div class="empty-state">No activities found</div>';
    } else {
        studentAssignments.forEach(item => {
            const type = getAssignmentType(item);
            const typeLabel = type === 'veille' ? 'Veille' : 'Live Coding';

            let collaboratorsHtml = '';

            const uniqueCoOwners = [];

            if (item.assignments && Array.isArray(item.assignments) && item.assignments.length > 0) {
                item.assignments.forEach(assign => {
                    const learner = assign.learner;
                    if (learner) {
                        const learnerName = `${learner.first_name} ${learner.last_name}`;
                        const learnerUsername = learner.username;
                        if (learnerUsername !== name) {
                            uniqueCoOwners.push({ name: learnerName, username: learnerUsername });
                        }
                    }
                });
            } else {
                const workRule = item.assignment_type && item.assignment_type.work_rule
                    ? item.assignment_type.work_rule.toLowerCase()
                    : '';

                if (!workRule.includes('individuel') && uniqueCoOwners.length === 0) {
                    const coOwners = allAssignments.filter(other => {
                        const otherName = other.ownerName || other.owner;
                        return otherName !== name &&
                            (other.subject === item.subject || other.title === item.title) &&
                            Math.abs(new Date(other.datetime) - new Date(item.datetime)) < 60000;
                    }).map(other => {
                        return { name: other.ownerName || other.owner, username: other.owner };
                    });

                    coOwners.forEach(co => {
                        if (!uniqueCoOwners.find(u => u.username === co.username)) uniqueCoOwners.push(co);
                    });
                }
            }

            uniqueCoOwners.forEach(co => {
                if (!collabStats[co.username]) collabStats[co.username] = { count: 0, veille: 0, live: 0, name: co.name };
                collabStats[co.username].count++;
                if (type === 'veille') collabStats[co.username].veille++;
                if (type === 'live') collabStats[co.username].live++;
            });

            if (uniqueCoOwners.length > 0 && uniqueCoOwners.length <= 6) {
                const links = uniqueCoOwners.map(co => `<span class="collaborator-link" data-name="${co.username}">${co.name}</span>`).join('');
                collaboratorsHtml = `<div class="activity-collaborators">With: ${links}</div>`;
            } else if (uniqueCoOwners.length > 6) {
                collaboratorsHtml = `<div class="activity-collaborators">With: ${uniqueCoOwners.length} others</div>`;
            }

            html += `
                <div class="activity-item type-${type}">
                    <div class="activity-type">${typeLabel}</div>
                    <div class="activity-title">${item.subject || item.title}</div>
                    <div class="activity-date">${formatDate(item.datetime)}</div>
                    ${collaboratorsHtml}
                </div>
            `;
        });
    }

    html += '</div>';

    const topCollabs = Object.entries(collabStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

    if (topCollabs.length > 0) {
        html += `
            <div class="collaborator-stats">
                <div class="collab-stat-title">Top Collaborators</div>
                ${topCollabs.map(([username, stats]) => `
                    <div class="collab-stat-item">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(stats.name)}&background=7b1fa2&color=fff&size=32" class="avatar" style="width:24px;height:24px;">
                        <div class="collab-stat-info">
                            <div class="collab-stat-name collaborator-link" data-name="${username}">${stats.name}</div>
                            <div class="collab-stat-details">With ${statsData.fullName.split(' ')[0]}: ${stats.veille} Veilles, ${stats.live} Live</div>
                        </div>
                        <div class="collab-stat-count-badge">${stats.count}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    content.innerHTML = html;

    content.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            content.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;
            const items = content.querySelectorAll('.activity-item');

            items.forEach(item => {
                if (filter === 'all') {
                    item.style.display = 'block';
                } else {
                    item.style.display = item.classList.contains(`type-${filter}`) ? 'block' : 'none';
                }
            });
        };
    });

    content.querySelectorAll('.collaborator-link').forEach(link => {
        link.onclick = (e) => {
            e.stopPropagation();
            showStudentDetail(link.dataset.name);
        };
    });

    document.getElementById('back-to-stats').onclick = () => {
        detailView.style.display = 'none';
        statsContent.style.display = 'block';
        searchContainer.style.display = 'block';
    };
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

let allAssignments = [];
let allUsers = [];
let typeFilter = 'all';
let dateFilter = 'week';
let selectedUser = null;

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

document.getElementById('user-search').oninput = (e) => {
    renderUserList(e.target.value);
};

document.getElementById('diagnose-btn').onclick = async () => {
    const btn = document.getElementById('diagnose-btn');
    const resultDiv = document.getElementById('diagnose-result');

    btn.textContent = '🔍 Scanning...';
    btn.disabled = true;
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="loader"></div>';

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('youcode.ma')) {
            resultDiv.innerHTML = '<p style="color: #ef5350;">Please navigate to YouCode Intranet first</p>';
            btn.textContent = '🔍 Diagnose Points API';
            btn.disabled = false;
            return;
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: diagnosePointsAPI,
            world: 'MAIN'
        });

        if (results && results[0] && results[0].result) {
            const data = results[0].result;
            let html = '<h4>Diagnostic Results</h4>';

            if (data.pointsLinks.length > 0) {
                html += '<p><strong>Links with "point":</strong></p><ul>';
                data.pointsLinks.forEach(l => {
                    html += `<li><code>${l}</code></li>`;
                });
                html += '</ul>';
            } else {
                html += '<p>No links with "point" found</p>';
            }

            if (data.forms.length > 0) {
                html += '<p><strong>Forms found:</strong></p><ul>';
                data.forms.forEach(f => {
                    html += `<li>Action: <code>${f.action}</code> Method: <code>${f.method}</code></li>`;
                });
                html += '</ul>';
            }

            if (data.selectInputs.length > 0) {
                html += '<p><strong>Select2 / User dropdowns:</strong></p><ul>';
                data.selectInputs.forEach(s => {
                    html += `<li><code>${s}</code></li>`;
                });
                html += '</ul>';
            }

            if (data.ajaxEndpoints.length > 0) {
                html += '<p><strong>Potential AJAX endpoints:</strong></p><ul>';
                data.ajaxEndpoints.forEach(e => {
                    html += `<li><code>${e}</code></li>`;
                });
                html += '</ul>';
            }

            html += `<p><strong>CSRF Token:</strong> <code>${data.csrfToken ? 'Found' : 'Not found'}</code></p>`;
            html += `<p><strong>Current URL:</strong> <code>${data.currentUrl}</code></p>`;

            resultDiv.innerHTML = html;
        }
    } catch (e) {
        resultDiv.innerHTML = `<p style="color: #ef5350;">Error: ${e.message}</p>`;
    }

    btn.textContent = '🔍 Diagnose Points API';
    btn.disabled = false;
};

document.getElementById('security-scan-btn').onclick = async () => {
    const btn = document.getElementById('security-scan-btn');
    const resultsDiv = document.getElementById('security-results');

    btn.textContent = '🛡️ Scanning...';
    btn.disabled = true;
    resultsDiv.innerHTML = '<div class="loader"></div>';

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('youcode.ma')) {
            resultsDiv.innerHTML = '<div class="empty-state">Navigate to YouCode Intranet first</div>';
            btn.textContent = '🛡️ Run Security Scan';
            btn.disabled = false;
            return;
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: runSecurityScan,
            world: 'MAIN'
        });

        if (results && results[0] && results[0].result) {
            const data = results[0].result;
            renderSecurityResults(data);
        }
    } catch (e) {
        resultsDiv.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }

    btn.textContent = '🛡️ Run Security Scan';
    btn.disabled = false;
};

function renderSecurityResults(data) {
    const resultsDiv = document.getElementById('security-results');

    const counts = { critical: 0, warning: 0, info: 0, safe: 0 };
    data.findings.forEach(f => counts[f.severity]++);

    let html = `
        <div class="security-summary">
            <div class="summary-item critical">
                <div class="summary-count">${counts.critical}</div>
                <div class="summary-label">Critical</div>
            </div>
            <div class="summary-item warning">
                <div class="summary-count">${counts.warning}</div>
                <div class="summary-label">Warning</div>
            </div>
            <div class="summary-item info">
                <div class="summary-count">${counts.info}</div>
                <div class="summary-label">Info</div>
            </div>
            <div class="summary-item safe">
                <div class="summary-count">${counts.safe}</div>
                <div class="summary-label">Safe</div>
            </div>
        </div>
    `;

    data.findings.forEach(finding => {
        const icon = {
            critical: '🔴',
            warning: '🟠',
            info: '🔵',
            safe: '🟢'
        }[finding.severity];

        html += `
            <div class="vuln-card ${finding.severity}">
                <div class="vuln-header">
                    <span class="vuln-icon">${icon}</span>
                    <span class="vuln-title">${finding.title}</span>
                </div>
                <div class="vuln-desc">${finding.description}</div>
                ${finding.detail ? `<div class="vuln-detail">${finding.detail}</div>` : ''}
            </div>
        `;
    });

    resultsDiv.innerHTML = html;
}

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
            const data = results[0].result;
            allAssignments = data.assignments;
            allUsers = data.users;
            renderAssignments();
            renderStats();
            renderUserList('');
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

document.querySelector('.close-modal').onclick = () => {
    document.getElementById('points-modal').style.display = 'none';
    document.getElementById('points-result').innerHTML = '';
};

document.getElementById('submit-points').onclick = async () => {
    if (!selectedUser) return;

    const amount = document.getElementById('points-amount').value;
    const reason = document.getElementById('points-reason').value;
    const resultDiv = document.getElementById('points-result');

    resultDiv.innerHTML = 'Sending...';
    resultDiv.className = 'points-result';

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: addPointsToUser,
            args: [selectedUser.username, selectedUser.name, parseInt(amount), reason],
            world: 'MAIN'
        });

        if (results && results[0] && results[0].result) {
            const res = results[0].result;
            if (res.success) {
                resultDiv.innerHTML = `Added ${amount} points to ${selectedUser.name}`;
                resultDiv.className = 'points-result success';
            } else {
                resultDiv.innerHTML = res.message || 'Failed to add points';
                resultDiv.className = 'points-result error';
            }
        }
    } catch (e) {
        resultDiv.innerHTML = 'Error: ' + e.message;
        resultDiv.className = 'points-result error';
    }
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

function renderUserList(searchTerm) {
    const container = document.getElementById('user-list');

    if (allUsers.length === 0) {
        container.innerHTML = '<div class="empty-state">Scan class first to load users</div>';
        return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = allUsers.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No users found</div>';
        return;
    }

    let html = '';
    filtered.forEach(user => {
        let photoUrl = user.photo
            ? (user.photo.startsWith('http') ? user.photo : `https://intranet.youcode.ma/storage/users/profile/thumbnail/${user.photo}`)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7b1fa2&color=fff&size=64`;

        html += `
            <div class="user-card" data-username="${user.username}" data-name="${user.name}" data-photo="${photoUrl}">
                <img src="${photoUrl}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7b1fa2&color=fff'">
                <div class="user-card-info">
                    <div class="user-card-name">${user.name}</div>
                    <div class="user-card-username">@${user.username}</div>
                </div>
                <button class="user-card-btn">+ Points</button>
            </div>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.user-card').forEach(card => {
        card.onclick = () => {
            selectedUser = {
                username: card.dataset.username,
                name: card.dataset.name,
                photo: card.dataset.photo
            };
            document.getElementById('modal-user-photo').src = selectedUser.photo;
            document.getElementById('modal-user-name').textContent = selectedUser.name;
            document.getElementById('modal-user-username').textContent = '@' + selectedUser.username;
            document.getElementById('points-modal').style.display = 'flex';
            document.getElementById('points-result').innerHTML = '';
        };
    });
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

                const nameEl = parent ? parent.querySelector('.fw-bold, .font-bold, strong, b') : null;
                const name = nameEl ? nameEl.textContent.trim() : u.replace(/-/g, ' ');

                users.set(u, { photo, name });
            }
        }
    });

    const userList = Array.from(users.entries());
    if (userList.length === 0) return { assignments: [], users: [] };

    const fetchUser = async (username, info) => {
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
                ownerPhoto: info.photo || item.learner?.photo || null,
                ownerName: item.learner ? `${item.learner.first_name} ${item.learner.last_name}` : info.name
            }));
        } catch (e) {
            return [];
        }
    };

    const results = await Promise.all(userList.map(([username, info]) => fetchUser(username, info)));

    const userArray = userList.map(([username, info]) => ({
        username,
        name: info.name,
        photo: info.photo
    }));

    return {
        assignments: results.flat(),
        users: userArray
    };
}

async function addPointsToUser(username, fullName, amount, reason) {
    try {
        const response = await fetch('/points/add', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
            },
            body: JSON.stringify({
                username: username,
                full_name: fullName,
                points: amount,
                reason: reason
            })
        });

        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        } else {
            const statusText = {
                400: 'Bad Request',
                401: 'Unauthorized',
                403: 'Forbidden',
                404: 'Endpoint Not Found - API does not exist',
                500: 'Server Error'
            };
            return {
                success: false,
                message: `Error ${response.status}: ${statusText[response.status] || response.statusText}`
            };
        }
    } catch (e) {
        return { success: false, message: 'Network Error: ' + e.message };
    }
}

function diagnosePointsAPI() {
    const results = {
        pointsLinks: [],
        forms: [],
        selectInputs: [],
        ajaxEndpoints: [],
        csrfToken: null,
        currentUrl: window.location.href
    };

    results.csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href').toLowerCase();
        if (href.includes('point') || href.includes('score') || href.includes('reward')) {
            results.pointsLinks.push(link.getAttribute('href'));
        }
    });

    document.querySelectorAll('form').forEach(form => {
        results.forms.push({
            action: form.action || 'no action',
            method: form.method || 'GET',
            id: form.id || 'no id'
        });
    });

    document.querySelectorAll('select, .select2, [data-select2-id]').forEach(select => {
        const name = select.name || select.id || select.className;
        if (name) results.selectInputs.push(name);
    });

    const scripts = document.querySelectorAll('script:not([src])');
    scripts.forEach(script => {
        const content = script.textContent;
        const urlMatches = content.match(/['"`](\/[a-zA-Z0-9\/_-]+)['"`]/g);
        if (urlMatches) {
            urlMatches.forEach(match => {
                const url = match.replace(/['"`]/g, '');
                if (url.includes('point') || url.includes('score') || url.includes('add') || url.includes('store')) {
                    if (!results.ajaxEndpoints.includes(url)) {
                        results.ajaxEndpoints.push(url);
                    }
                }
            });
        }
    });

    const allButtons = document.querySelectorAll('button, input[type="submit"], .btn');
    allButtons.forEach(btn => {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        if (text.includes('point') || text.includes('add') || text.includes('ajouter')) {
            const form = btn.closest('form');
            if (form && form.action) {
                if (!results.ajaxEndpoints.includes(form.action)) {
                    results.ajaxEndpoints.push('Form: ' + form.action);
                }
            }
        }
    });

    if (typeof $ !== 'undefined' && $.ajax) {
        const origAjax = $.ajax;
        console.log('[YouCode Tracker] Monitoring AJAX calls...');
    }

    return results;
}

function runSecurityScan() {
    const findings = [];

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (csrfToken) {
        findings.push({
            severity: 'safe',
            title: 'CSRF Protection',
            description: 'CSRF token is present in meta tag',
            detail: `Token length: ${csrfToken.length} chars`
        });
    } else {
        findings.push({
            severity: 'critical',
            title: 'Missing CSRF Protection',
            description: 'No CSRF token found - forms may be vulnerable to CSRF attacks',
            detail: null
        });
    }

    const forms = document.querySelectorAll('form');
    let formsWithoutToken = 0;
    forms.forEach(form => {
        const hasToken = form.querySelector('input[name="_token"]') ||
            form.querySelector('input[name="csrf_token"]') ||
            form.querySelector('input[name="_csrf"]');
        if (!hasToken && form.method.toLowerCase() === 'post') {
            formsWithoutToken++;
        }
    });

    if (formsWithoutToken > 0) {
        findings.push({
            severity: 'warning',
            title: `${formsWithoutToken} POST Form(s) Without CSRF Token`,
            description: 'Some forms may not have CSRF protection in hidden fields',
            detail: null
        });
    } else if (forms.length > 0) {
        findings.push({
            severity: 'safe',
            title: 'Forms Have CSRF Tokens',
            description: `All ${forms.length} POST forms have CSRF tokens`,
            detail: null
        });
    }

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
    const vulnerableInputs = [];
    inputs.forEach(input => {
        const hasMaxLength = input.hasAttribute('maxlength');
        const hasPattern = input.hasAttribute('pattern');
        const hasType = input.type !== 'text';
        if (!hasMaxLength && !hasPattern && !hasType) {
            vulnerableInputs.push(input.name || input.id || 'unnamed');
        }
    });

    if (vulnerableInputs.length > 0) {
        findings.push({
            severity: 'info',
            title: `${vulnerableInputs.length} Input(s) Without Client Validation`,
            description: 'These inputs have no maxlength, pattern, or specific type',
            detail: vulnerableInputs.slice(0, 5).join(', ') + (vulnerableInputs.length > 5 ? '...' : '')
        });
    }

    const scripts = document.querySelectorAll('script:not([src])');
    let inlineJsIssues = [];
    scripts.forEach((script, i) => {
        const content = script.textContent;
        if (content.includes('eval(')) {
            inlineJsIssues.push('eval() usage detected');
        }
        if (content.includes('innerHTML') && content.includes('user')) {
            inlineJsIssues.push('Possible XSS (innerHTML with user data)');
        }
        if (content.match(/\$\.(get|post|ajax)\s*\(\s*['"`][^'"`]*\+/)) {
            inlineJsIssues.push('Dynamic AJAX URL construction');
        }
    });

    if (inlineJsIssues.length > 0) {
        findings.push({
            severity: 'warning',
            title: 'Potential JavaScript Security Issues',
            description: 'Found patterns that might indicate security issues',
            detail: [...new Set(inlineJsIssues)].join(', ')
        });
    }

    const links = document.querySelectorAll('a[href^="javascript:"], a[onclick]');
    if (links.length > 0) {
        findings.push({
            severity: 'info',
            title: `${links.length} Inline JavaScript Links`,
            description: 'Links with javascript: or onclick handlers found',
            detail: null
        });
    }

    const passwordFields = document.querySelectorAll('input[type="password"]');
    passwordFields.forEach(field => {
        if (field.autocomplete !== 'off' && field.autocomplete !== 'new-password') {
            findings.push({
                severity: 'info',
                title: 'Password Autocomplete Enabled',
                description: 'Password field may be cached by browser',
                detail: `Field: ${field.name || field.id || 'unnamed'}`
            });
        }
    });

    const exposedData = [];
    const allScripts = document.querySelectorAll('script');
    allScripts.forEach(script => {
        const content = script.textContent;
        if (content.match(/api[_-]?key\s*[:=]/i)) exposedData.push('API Key');
        if (content.match(/secret\s*[:=]/i)) exposedData.push('Secret');
        if (content.match(/password\s*[:=]\s*['"`][^'"`]+['"`]/i)) exposedData.push('Password');
        if (content.match(/token\s*[:=]\s*['"`][a-zA-Z0-9]{20,}['"`]/i)) exposedData.push('Token');
    });

    if (exposedData.length > 0) {
        findings.push({
            severity: 'critical',
            title: 'Sensitive Data in JavaScript',
            description: 'Potential sensitive data exposed in page source',
            detail: [...new Set(exposedData)].join(', ')
        });
    }

    const httpLinks = document.querySelectorAll('a[href^="http://"], script[src^="http://"], link[href^="http://"]');
    if (httpLinks.length > 0) {
        findings.push({
            severity: 'warning',
            title: `${httpLinks.length} Non-HTTPS Resources`,
            description: 'Mixed content may expose data or allow MITM attacks',
            detail: null
        });
    }

    const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
    const sensitiveHidden = [];
    hiddenInputs.forEach(input => {
        const name = (input.name || '').toLowerCase();
        if (name.includes('user') || name.includes('id') || name.includes('role') || name.includes('admin')) {
            sensitiveHidden.push(`${input.name}=${input.value.substring(0, 20)}`);
        }
    });

    if (sensitiveHidden.length > 0) {
        findings.push({
            severity: 'info',
            title: 'Sensitive Hidden Fields',
            description: 'User-modifiable hidden fields with sensitive names',
            detail: sensitiveHidden.slice(0, 3).join(', ')
        });
    }

    const debugInfo = document.body.innerHTML.match(/laravel|debug|stack trace|exception|error in/gi);
    if (debugInfo && debugInfo.length > 0) {
        findings.push({
            severity: 'warning',
            title: 'Debug Information Leak',
            description: 'Page may contain debug/error information',
            detail: [...new Set(debugInfo)].slice(0, 3).join(', ')
        });
    }

    if (window.location.protocol === 'https:') {
        findings.push({
            severity: 'safe',
            title: 'HTTPS Enabled',
            description: 'Connection is encrypted',
            detail: null
        });
    } else {
        findings.push({
            severity: 'critical',
            title: 'No HTTPS',
            description: 'Connection is not encrypted - all data visible to attackers',
            detail: null
        });
    }

    const cookies = document.cookie.split(';');
    const cookieIssues = [];
    if (cookies.length > 0 && cookies[0] !== '') {
        findings.push({
            severity: 'info',
            title: `${cookies.length} Cookie(s) Accessible via JS`,
            description: 'Cookies without HttpOnly flag can be stolen via XSS',
            detail: cookies.slice(0, 3).map(c => c.split('=')[0].trim()).join(', ')
        });
    }

    const localStorageKeys = Object.keys(localStorage);
    const sessionStorageKeys = Object.keys(sessionStorage);
    const sensitiveStoragePatterns = /token|auth|session|password|secret|key|jwt/i;

    const sensitiveLocalStorage = localStorageKeys.filter(k => sensitiveStoragePatterns.test(k));
    const sensitiveSessionStorage = sessionStorageKeys.filter(k => sensitiveStoragePatterns.test(k));

    if (sensitiveLocalStorage.length > 0) {
        findings.push({
            severity: 'warning',
            title: 'Sensitive Data in localStorage',
            description: 'localStorage persists and is vulnerable to XSS',
            detail: sensitiveLocalStorage.join(', ')
        });
    }

    if (sensitiveSessionStorage.length > 0) {
        findings.push({
            severity: 'info',
            title: 'Sensitive Data in sessionStorage',
            description: 'sessionStorage is vulnerable to XSS within session',
            detail: sensitiveSessionStorage.join(', ')
        });
    }

    const url = window.location.href;
    const sqliPatterns = /[?&][^=]+=[^&]*('|"|;|--|\bOR\b|\bAND\b|\bUNION\b|\bSELECT\b)/i;
    if (sqliPatterns.test(url)) {
        findings.push({
            severity: 'critical',
            title: 'Potential SQL Injection in URL',
            description: 'URL contains SQL-like patterns that might indicate SQLi attempt',
            detail: url.substring(0, 100)
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const redirectParams = ['redirect', 'url', 'next', 'return', 'returnUrl', 'goto', 'link', 'target'];
    redirectParams.forEach(param => {
        const value = urlParams.get(param);
        if (value && (value.startsWith('http') || value.startsWith('//'))) {
            findings.push({
                severity: 'warning',
                title: 'Potential Open Redirect',
                description: `URL parameter "${param}" contains external URL`,
                detail: value.substring(0, 50)
            });
        }
    });

    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        const accept = input.getAttribute('accept');
        if (!accept) {
            findings.push({
                severity: 'warning',
                title: 'Unrestricted File Upload',
                description: 'File input has no accept attribute - allows any file type',
                detail: `Field: ${input.name || input.id || 'unnamed'}`
            });
        }
    });

    const iframes = document.querySelectorAll('iframe');
    const externalIframes = [];
    iframes.forEach(iframe => {
        const src = iframe.src;
        if (src && !src.includes(window.location.hostname)) {
            externalIframes.push(src.substring(0, 50));
        }
    });
    if (externalIframes.length > 0) {
        findings.push({
            severity: 'info',
            title: `${externalIframes.length} External Iframe(s)`,
            description: 'External iframes may pose clickjacking or XSS risk',
            detail: externalIframes[0]
        });
    }

    const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"]');
    emailInputs.forEach(input => {
        if (input.type !== 'email') {
            findings.push({
                severity: 'info',
                title: 'Email Field Without Validation',
                description: 'Email field using type="text" instead of type="email"',
                detail: `Field: ${input.name || input.id}`
            });
        }
    });

    const comments = [];
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT);
    while (walker.nextNode()) {
        const c = walker.currentNode.textContent.trim();
        if (c.length > 10 && (c.includes('TODO') || c.includes('FIXME') || c.includes('password') || c.includes('hack') || c.includes('bug'))) {
            comments.push(c.substring(0, 50));
        }
    }
    if (comments.length > 0) {
        findings.push({
            severity: 'info',
            title: 'Developer Comments in HTML',
            description: 'HTML comments may reveal sensitive information',
            detail: comments[0]
        });
    }

    const dangerousHtml = document.querySelectorAll('[v-html], [ng-bind-html], [dangerouslySetInnerHTML]');
    if (dangerousHtml.length > 0) {
        findings.push({
            severity: 'warning',
            title: `${dangerousHtml.length} Dangerous HTML Binding(s)`,
            description: 'Framework bindings that may allow XSS',
            detail: null
        });
    }

    const targetBlankLinks = document.querySelectorAll('a[target="_blank"]:not([rel*="noopener"])');
    if (targetBlankLinks.length > 0) {
        findings.push({
            severity: 'info',
            title: `${targetBlankLinks.length} Links Without rel="noopener"`,
            description: 'target="_blank" without noopener can expose window.opener',
            detail: null
        });
    }

    const formActions = [];
    document.querySelectorAll('form').forEach(form => {
        const action = form.action;
        if (action && !action.includes(window.location.hostname) && action.startsWith('http')) {
            formActions.push(action);
        }
    });
    if (formActions.length > 0) {
        findings.push({
            severity: 'warning',
            title: `${formActions.length} Form(s) Submit to External Domain`,
            description: 'Forms sending data to external domains',
            detail: formActions[0].substring(0, 50)
        });
    }

    const autofillFields = document.querySelectorAll('input[autocomplete="off"]');
    const creditCardFields = document.querySelectorAll('input[autocomplete*="cc-"], input[name*="card"], input[name*="credit"]');
    if (creditCardFields.length > 0) {
        findings.push({
            severity: 'info',
            title: 'Credit Card Fields Detected',
            description: 'Page appears to handle payment information',
            detail: `${creditCardFields.length} field(s)`
        });
    }

    const accessControls = document.querySelectorAll('[data-role], [data-permission], [v-if*="admin"], [ng-if*="admin"]');
    if (accessControls.length > 0) {
        findings.push({
            severity: 'info',
            title: 'Client-Side Access Control',
            description: 'UI elements controlled by client-side role/permission checks',
            detail: `${accessControls.length} element(s) with role/permission attributes`
        });
    }

    const metaTags = {
        'X-Frame-Options': document.querySelector('meta[http-equiv="X-Frame-Options"]'),
        'Content-Security-Policy': document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
        'Referrer-Policy': document.querySelector('meta[name="referrer"]')
    };

    Object.entries(metaTags).forEach(([header, meta]) => {
        if (meta) {
            findings.push({
                severity: 'safe',
                title: `${header} Set`,
                description: `Security header configured via meta tag`,
                detail: meta.content?.substring(0, 50) || 'Present'
            });
        }
    });

    const jsonData = document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]');
    jsonData.forEach(script => {
        try {
            const data = JSON.parse(script.textContent);
            const str = JSON.stringify(data);
            if (str.match(/email|phone|address|ssn|password/i)) {
                findings.push({
                    severity: 'info',
                    title: 'PII in JSON-LD/Structured Data',
                    description: 'Embedded JSON may contain personal information',
                    detail: null
                });
            }
        } catch (e) { }
    });

    const postMessageHandlers = document.body.innerHTML.includes('addEventListener') &&
        document.body.innerHTML.includes('message');
    if (postMessageHandlers) {
        findings.push({
            severity: 'info',
            title: 'postMessage Handler Detected',
            description: 'Page uses window.postMessage - check origin validation',
            detail: null
        });
    }

    return { findings, url: window.location.href };
}

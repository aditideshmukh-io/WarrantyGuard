
// Warranty Organizer - script.js
// No backend; use localStorage as the "database".

// Constants
const STORAGE_KEY = 'warranties';

// Helpers
function readInput(id) {
return document.getElementById(id);
}

/**

Add months to a Date, returning a new Date.
Handles month overflow (e.g., Jan 31 + 1 month -> Feb 28/29).
*/
function addMonths(date, months) {
const d = new Date(date.getTime());
const targetMonth = d.getMonth() + months;
// setMonth handles overflow and adjusts year
d.setMonth(targetMonth);
// If day rolled forward due to short month, correct by moving to last day of previous month
// Example: Jan 31 + 1 -> Mar 3 (because Feb has 28) — fix to Feb 28/29
if (d.getDate() !== new Date(date.getTime()).getDate()) {
// Move to last day of previous month
d.setDate(0);
}
return d;
}

function formatDateReadable(date) {
const d = new Date(date);
return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysBetween(fromDate, toDate) {
const msPerDay = 1000 * 60 * 60 * 24;
// Normalize times to midday to avoid DST partial-day issues
const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 12, 0, 0);
const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 12, 0, 0);
return Math.ceil((b - a) / msPerDay);
}

// Storage helpers
function loadWarranties() {
const raw = localStorage.getItem(STORAGE_KEY);
if (!raw) return [];
try {
const parsed = JSON.parse(raw);
if (Array.isArray(parsed)) return parsed;
return [];
} catch (e) {
console.error('Failed to parse warranties from localStorage', e);
return [];
}
}

function saveWarranties(arr) {
localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// Notifications storage (persist for 24 hours)
const STORAGE_NOTIF_KEY = 'pw_notifications';

function loadStoredNotifs() {
	const raw = localStorage.getItem(STORAGE_NOTIF_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		// Filter out items older than 24 hours
		const day = 24 * 60 * 60 * 1000;
		const now = Date.now();
		const filtered = parsed.filter(n => (now - (n.ts || 0)) <= day);
		// If some were filtered out, persist trimmed list
		if (filtered.length !== parsed.length) localStorage.setItem(STORAGE_NOTIF_KEY, JSON.stringify(filtered));
		return filtered;
	} catch (e) {
		console.error('Failed to parse stored notifications', e);
		return [];
	}
}

function saveStoredNotifs(arr) {
	localStorage.setItem(STORAGE_NOTIF_KEY, JSON.stringify(arr));
}

function addStoredNotification(message, type = 'info') {
	const nots = loadStoredNotifs();
	const now = Date.now();
	const id = now + '-' + Math.random().toString(36).slice(2, 8);
	const item = { id, message, type, ts: now };
	nots.push(item);
	saveStoredNotifs(nots);
	renderNotifPanel();
	updateNotifBadge();
	return item;
}

function removeStoredNotification(id) {
	const nots = loadStoredNotifs().filter(n => n.id !== id);
	saveStoredNotifs(nots);
	renderNotifPanel();
	updateNotifBadge();
}

function updateNotifBadge() {
	const badge = document.getElementById('notif-count');
	if (!badge) return;
	const nots = loadStoredNotifs();
	if (nots.length === 0) {
		badge.style.display = 'none';
		badge.textContent = '';
	} else {
		badge.style.display = 'inline-block';
		badge.textContent = nots.length > 99 ? '99+' : String(nots.length);
	}
}

function renderNotifPanel() {
	const list = document.getElementById('notif-list');
	if (!list) return;
	list.innerHTML = '';
	const nots = loadStoredNotifs().slice().reverse(); // show newest first
	if (nots.length === 0) {
		const p = document.createElement('div');
		p.className = 'notif-item';
		p.textContent = 'No notifications';
		list.appendChild(p);
		return;
	}
	for (const n of nots) {
		const item = document.createElement('div');
		item.className = 'notif-item';
		item.innerHTML = `<div><div>${escapeHtml(n.message)}</div><div class="meta">${new Date(n.ts).toLocaleString()}</div></div>`;
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'close-small';
		btn.innerText = '×';
		btn.addEventListener('click', () => removeStoredNotification(n.id));
		item.appendChild(btn);
		list.appendChild(item);
	}
}

function escapeHtml(str) {
	return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}

// Rendering
function renderWarranties() {
	const tableBody = document.querySelector('#warranty-table tbody');
	tableBody.innerHTML = ''; // clear

	const warranties = loadWarranties();
	const today = new Date();

	if (warranties.length === 0) {
		const tr = document.createElement('tr');
		const td = document.createElement('td');
		td.colSpan = 4; // now we have Actions column
		td.style.color = '#6b7280';
		td.style.padding = '18px';
		td.textContent = 'No warranties added yet.';
		tr.appendChild(td);
		tableBody.appendChild(tr);
		return;
	}

	// Keep original indices so delete works reliably after sorting
	const indexed = warranties.map((w, i) => ({ w, i }));

	// Sort by expiry date (invalid dates go to the end)
	indexed.sort((a, b) => {
		const da = new Date(a.w.expiryDate);
		const db = new Date(b.w.expiryDate);
		const va = isNaN(da.getTime()) ? Infinity : da.getTime();
		const vb = isNaN(db.getTime()) ? Infinity : db.getTime();
		return va - vb;
	});

	for (const item of indexed) {
		const w = item.w;
		const expiry = new Date(w.expiryDate);
		const valid = !isNaN(expiry.getTime());
		const tr = document.createElement('tr');

		let daysRem = NaN;
		if (valid) daysRem = daysBetween(today, expiry);

		// Apply classes for visual states
		if (valid && daysRem <= 30 && daysRem >= 0) {
			tr.classList.add('expiring-soon');
		} else if (valid && daysRem < 0) {
			tr.classList.add('expired');
		}

		// Product cell
		const tdProduct = document.createElement('td');
		tdProduct.textContent = w.productName || '(No name)';
		tr.appendChild(tdProduct);

		// Expiry cell
		const tdExpiry = document.createElement('td');
		tdExpiry.textContent = valid ? formatDateReadable(expiry) : 'Invalid date';
		tr.appendChild(tdExpiry);

		// Days remaining
		const tdDays = document.createElement('td');
		if (!valid) {
			tdDays.textContent = '—';
		} else if (daysRem < 0) {
			tdDays.textContent = `Expired ${Math.abs(daysRem)} day${Math.abs(daysRem) === 1 ? '' : 's'} ago`;
		} else if (daysRem === 0) {
			tdDays.textContent = 'Expires today';
		} else {
			tdDays.textContent = `${daysRem} day${daysRem === 1 ? '' : 's'}`;
		}
		tr.appendChild(tdDays);

		// Actions cell (Delete)
		const tdAction = document.createElement('td');
		const delBtn = document.createElement('button');
		delBtn.type = 'button';
		delBtn.className = 'action-btn';
		delBtn.textContent = 'Delete';
		delBtn.addEventListener('click', () => {
			// item.i is the original index in the stored array
			deleteWarranty(item.i);
		});
		tdAction.appendChild(delBtn);
		tr.appendChild(tdAction);

		tableBody.appendChild(tr);
	}
}

// Reminders
function checkReminders() {
	const warranties = loadWarranties();
	const today = new Date();
	const reminders = [];

	for (const w of warranties) {
		const expiry = new Date(w.expiryDate);
		if (isNaN(expiry.getTime())) {
			console.warn('Skipping reminder check for invalid expiryDate:', w);
			continue;
		}
		const daysRem = daysBetween(today, expiry);
		if (daysRem <= 30 && daysRem >= 0) {
			reminders.push({ name: w.productName || '(No name)', days: daysRem });
		}
	}

	if (reminders.length === 0) {
		// no reminders; do nothing (keep any existing toasts)
		return;
	}

		// Add a stored notification per reminder (avoid duplicates within 24h)
		const existing = loadStoredNotifs();
		const now = Date.now();
		const day = 24 * 60 * 60 * 1000;
		for (const r of reminders) {
			const msg = `Your '${r.name}' warranty is expiring in ${r.days} day${r.days === 1 ? '' : 's'}.`;
			const dup = existing.find(n => n.message === msg && (now - (n.ts || 0)) <= day);
			if (!dup) addStoredNotification(msg, 'warning');
		}
		// update badge/panel
		updateNotifBadge();
}
// Form handling
function handleFormSubmit(e) {
	e.preventDefault();

	const productInput = readInput('product-name');
	const purchaseInput = readInput('purchase-date');
	const durationInput = readInput('warranty-duration');

	const productName = productInput.value.trim();
	const purchaseDateStr = purchaseInput.value;
	const durationMonths = parseInt(durationInput.value, 10);

	if (!productName || !purchaseDateStr || !durationMonths || durationMonths <= 0) {
		// Inputs are required in HTML, but double-check
		alert('Please fill out all required fields with valid values.');
		return;
	}

	const purchaseDate = new Date(purchaseDateStr);
	const expiryDate = addMonths(purchaseDate, durationMonths);

	const warranty = {
		productName,
		purchaseDate: purchaseDate.toISOString(),
		expiryDate: expiryDate.toISOString()
	};

	const warranties = loadWarranties();
	warranties.push(warranty);
	saveWarranties(warranties);

	// Reset form
	e.target.reset();

	// Re-render and re-check reminders
	renderWarranties();
		// Add a stored notification for the newly added warranty and show a toast for it
		const addedMsg = `Added '${productName}' warranty.`;
		addStoredNotification(addedMsg, 'info');
		showNotification(addedMsg, 'info', 4000);
		updateNotifBadge();
		checkReminders();
}

// Delete a warranty by its index in stored array
function deleteWarranty(index) {
	const warranties = loadWarranties();
	if (index < 0 || index >= warranties.length) {
		showNotification('Unable to delete: index out of range', 'danger');
		return;
	}
	const removed = warranties.splice(index, 1);
	saveWarranties(warranties);
		renderWarranties();
		checkReminders();
		const msg = `Deleted "${removed[0].productName || '(No name)'}".`;
		addStoredNotification(msg, 'info');
		showNotification(msg, 'info', 4000);
}

// Export/Import and utility functions
function showNotification(message, type = 'info', timeout = 7000) {
	const container = document.getElementById('notifications');
	if (!container) return;

	const item = document.createElement('div');
	item.className = 'notification-item ' + (type || 'info');
	item.textContent = message;

	const close = document.createElement('button');
	close.type = 'button';
	close.className = 'close-btn';
	close.innerText = '×';
	close.addEventListener('click', () => {
		if (item._timer) clearTimeout(item._timer);
		item.remove();
	});

	// Append close button to the item (right side)
	item.appendChild(close);
	container.appendChild(item);

	if (timeout > 0) {
		item._timer = setTimeout(() => {
			item.remove();
		}, timeout);
	}
}

function clearNotification() {
	const container = document.getElementById('notifications');
	if (!container) return;
	container.innerHTML = '';
}

function exportWarranties() {
	const data = loadWarranties();
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'warranties.json';
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
		const msg = 'Export started — check your downloads.';
		addStoredNotification(msg, 'info');
		showNotification(msg, 'info', 4000);
}

function importWarrantiesFile(file) {
	const reader = new FileReader();
	reader.onload = () => {
		try {
			const parsed = JSON.parse(reader.result);
			if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
			const replace = confirm('Replace existing warranties with imported data? Cancel to merge.');
			if (replace) {
				saveWarranties(parsed);
			} else {
				const existing = loadWarranties();
				saveWarranties(existing.concat(parsed));
			}
			renderWarranties();
			checkReminders();
			showNotification('Import successful.', 'info');
			addStoredNotification('Import successful.', 'info');
		} catch (err) {
			console.error('Failed to import', err);
			showNotification('Import failed: ' + err.message, 'danger');
			addStoredNotification('Import failed: ' + err.message, 'danger');
		}
	};
	reader.readAsText(file);
}

function clearAllWarranties() {
	if (!confirm('Are you sure you want to delete ALL warranties? This cannot be undone.')) return;
	localStorage.removeItem(STORAGE_KEY);
		renderWarranties();
		clearNotification();
		const msg = 'All warranties cleared.';
		addStoredNotification(msg, 'info');
		showNotification(msg, 'info');
}

// Initial setup
function init() {
	const form = document.getElementById('warranty-form');
	form.addEventListener('submit', handleFormSubmit);

	// Wire up export/import/clear controls
	const exportBtn = document.getElementById('export-btn');
	const importFile = document.getElementById('import-file');
	const clearBtn = document.getElementById('clear-btn');
	if (exportBtn) exportBtn.addEventListener('click', exportWarranties);
	if (importFile) importFile.addEventListener('change', (e) => {
		const f = e.target.files && e.target.files[0];
		if (f) importWarrantiesFile(f);
		// reset so same file can be selected again later
		e.target.value = '';
	});
	if (clearBtn) clearBtn.addEventListener('click', clearAllWarranties);

	// Notification bell wiring
	const bell = document.getElementById('notif-bell');
	const panel = document.getElementById('notif-panel');
	const panelClose = document.getElementById('notif-panel-close');
	if (bell && panel) {
		bell.addEventListener('click', (e) => {
			const isHidden = panel.hasAttribute('hidden');
			if (isHidden) {
				renderNotifPanel();
				panel.removeAttribute('hidden');
			} else {
				panel.setAttribute('hidden', '');
			}
		});
	}
	if (panelClose && panel) panelClose.addEventListener('click', () => panel.setAttribute('hidden', ''));

	// initial badge
	updateNotifBadge();

	renderWarranties();
	checkReminders();
}

// Run on load
document.addEventListener('DOMContentLoaded', init);


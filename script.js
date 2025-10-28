
const STORAGE_KEY = 'warranties';

function readInput(id) {
return document.getElementById(id);
}
function addMonths(date, months) {
const d = new Date(date.getTime());
const targetMonth = d.getMonth() + months;
d.setMonth(targetMonth);
if (d.getDate() !== new Date(date.getTime()).getDate()) {
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

const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 12, 0, 0);
const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 12, 0, 0);
return Math.ceil((b - a) / msPerDay);
}

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


const STORAGE_NOTIF_KEY = 'pw_notifications';


let editingIndex = null;

function openEditModal(index, warranty) {
	const modal = document.getElementById('edit-modal');
	if (!modal) return;
	editingIndex = index;

	const p = document.getElementById('product-name-edit');
	const pu = document.getElementById('purchase-date-edit');
	const d = document.getElementById('warranty-duration-edit');
	if (p) p.value = warranty.productName || '';
	if (pu) pu.value = new Date(warranty.purchaseDate).toISOString().slice(0,10);
	try {
		const pd = new Date(warranty.purchaseDate);
		const ed = new Date(warranty.expiryDate);
		const months = (ed.getFullYear()-pd.getFullYear())*12 + (ed.getMonth()-pd.getMonth());
		if (d) d.value = Math.max(1, months || 12);
	} catch(e) { if (d) d.value = 12 }
	modal.removeAttribute('hidden');
	modal.setAttribute('aria-hidden', 'false');

	if (p) p.focus();
}

function closeEditModal(clearIndex = true) {
	const modal = document.getElementById('edit-modal');
	if (!modal) return;
	modal.setAttribute('hidden', '');
	modal.setAttribute('aria-hidden', 'true');
	if (clearIndex) editingIndex = null;
}

function loadStoredNotifs() {
	const raw = localStorage.getItem(STORAGE_NOTIF_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
	
		const day = 24 * 60 * 60 * 1000;
		const now = Date.now();
		const filtered = parsed.filter(n => (now - (n.ts || 0)) <= day);
	
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
		badge.removeAttribute('aria-label');
	} else {
		badge.style.display = 'inline-block';
		
		badge.setAttribute('aria-label', `${nots.length} unread notification${nots.length === 1 ? '' : 's'}`);
	}
}

function renderNotifPanel() {
	const list = document.getElementById('notif-list');
	if (!list) return;
	list.innerHTML = '';
	const nots = loadStoredNotifs().slice().reverse(); 
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


function getSortMode() {
	const sel = document.getElementById('sort-select');
	return sel ? sel.value : 'soonest';
}

function colorFromString(str) {

	let h = 0;
	for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
	h = Math.abs(h) % 360;
	return `hsl(${h} 70% 40%)`;
}

function initialsFromName(name) {
	const parts = (name || '').trim().split(/\s+/);
	if (parts.length === 0) return '?';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[1][0]).toUpperCase();
}


function renderWarranties() {
	const grid = document.getElementById('warranty-grid');
	if (!grid) return;
	grid.innerHTML = '';

	const warranties = loadWarranties();
	if (!warranties || warranties.length === 0) {
		const p = document.createElement('div');
		p.style.color = '#6b7280';
		p.style.padding = '18px';
		p.textContent = 'No warranties yet. Record your first purchase.';
		grid.appendChild(p);
		return;
	}


	const indexed = warranties.map((w, i) => ({ w, i }));

	const sortMode = getSortMode();
	indexed.sort((a, b) => {
		const wa = a.w;
		const wb = b.w;
		if (sortMode === 'newest') {
			const pa = new Date(wa.purchaseDate).getTime() || 0;
			const pb = new Date(wb.purchaseDate).getTime() || 0;
			return pb - pa;
		}

		const ea = new Date(wa.expiryDate).getTime();
		const eb = new Date(wb.expiryDate).getTime();
		const va = isNaN(ea) ? Infinity : ea;
		const vb = isNaN(eb) ? Infinity : eb;
		return va - vb;
	});

	const today = new Date();

	for (const item of indexed) {
		const w = item.w;
		const expiry = new Date(w.expiryDate);
		const valid = !isNaN(expiry.getTime());
		const daysRem = valid ? daysBetween(today, expiry) : NaN;

		const card = document.createElement('article');
		card.className = 'warranty-card';
		card.style.position = 'relative';


		const avatar = document.createElement('div');
		avatar.className = 'warranty-avatar';
		const color = colorFromString(w.productName || 'item');
		avatar.style.background = color;
		avatar.textContent = initialsFromName(w.productName || '(No name)');
		card.appendChild(avatar);

		// body
		const body = document.createElement('div');
		body.className = 'warranty-body';
		const title = document.createElement('div');
		title.className = 'warranty-title';
		title.textContent = w.productName || '(No name)';
		body.appendChild(title);

		const meta = document.createElement('div');
		meta.className = 'warranty-meta';
		meta.textContent = `Purchased: ${formatDateReadable(new Date(w.purchaseDate))}`;
		body.appendChild(meta);

		// footer: expiry chip + days
		const footer = document.createElement('div');
		footer.style.display = 'flex';
		footer.style.alignItems = 'center';
		footer.style.gap = '8px';

		const chip = document.createElement('span');
		chip.className = 'expiry-chip';
		if (!valid) {
			chip.textContent = 'Invalid date';
			chip.classList.add('expiry-soon-chip');
		} else if (daysRem < 0) {
			chip.textContent = `Expired ${Math.abs(daysRem)}d ago`;
			chip.classList.add('expiry-soon-chip');
		} else if (daysRem <= 30) {
			chip.textContent = `Expires ${formatDateReadable(expiry)}`;
			chip.classList.add('expiry-soon-chip');
		} else {
			chip.textContent = `Expires ${formatDateReadable(expiry)}`;
			chip.classList.add('expiry-ok-chip');
		}
		footer.appendChild(chip);

		const daysText = document.createElement('div');
		daysText.style.color = 'var(--muted)';
		if (!valid) daysText.textContent = '';
		else if (daysRem < 0) daysText.textContent = `${Math.abs(daysRem)} day(s) ago`;
		else if (daysRem === 0) daysText.textContent = 'Expires today';
		else daysText.textContent = `${daysRem} day${daysRem === 1 ? '' : 's'}`;
		footer.appendChild(daysText);

		body.appendChild(footer);
		card.appendChild(body);

		const actions = document.createElement('div');
		actions.className = 'warranty-actions';
		const menuBtn = document.createElement('button');
		menuBtn.type = 'button';
		menuBtn.className = 'menu-btn';
		menuBtn.innerText = '⋯';
		actions.appendChild(menuBtn);

				const pop = document.createElement('div');
		pop.className = 'menu-pop';
		pop.style.display = 'none';
		const editBtn = document.createElement('button');
		editBtn.type = 'button';
		editBtn.textContent = 'Edit';
		// Edit 
		editBtn.addEventListener('click', () => {
			openEditModal(item.i, w);
			pop.style.display = 'none';
		});
		pop.appendChild(editBtn);

		const delBtn = document.createElement('button');
		delBtn.type = 'button';
		delBtn.textContent = 'Delete';
		delBtn.addEventListener('click', () => {
			if (confirm('Delete this warranty?')) {
				deleteWarranty(item.i);
			}
			pop.style.display = 'none';
		});
		pop.appendChild(delBtn);

		menuBtn.addEventListener('click', (ev) => {
			ev.stopPropagation();
		
			pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
		});

	
		document.addEventListener('click', () => { pop.style.display = 'none'; });

		pop.style.position = 'absolute';
		pop.style.right = '12px';
		pop.style.top = '36px';
		card.appendChild(actions);
		card.appendChild(pop);

		grid.appendChild(card);
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

		return;
	}


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


	renderWarranties();
		
		const addedMsg = `Added '${productName}' warranty.`;
		addStoredNotification(addedMsg, 'info');
		showNotification(addedMsg, 'info', 4000);
		updateNotifBadge();
		checkReminders();
}


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


function handleEditFormSubmit(e) {
	e.preventDefault();
	if (editingIndex === null) {
		showNotification('No item selected to edit.', 'danger');
		closeEditModal(true);
		return;
	}
	const pInput = document.getElementById('product-name-edit');
	const purchaseInput = document.getElementById('purchase-date-edit');
	const durationInput = document.getElementById('warranty-duration-edit');

	const productName = pInput.value.trim();
	const purchaseDateStr = purchaseInput.value;
	const durationMonths = parseInt(durationInput.value, 10);
	if (!productName || !purchaseDateStr || !durationMonths || durationMonths <= 0) {
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
	if (editingIndex < 0 || editingIndex >= warranties.length) {
		showNotification('Unable to save edit: index out of range', 'danger');
		closeEditModal(true);
		return;
	}
	warranties[editingIndex] = warranty;
	saveWarranties(warranties);
	closeEditModal(true);
	renderWarranties();
	const msg = `Updated '${productName}'.`;
	addStoredNotification(msg, 'info');
	showNotification(msg, 'info', 4000);
	checkReminders();
}

// Export/Import  functions
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


	item.appendChild(close);
	container.appendChild(item);

	if (timeout > 0) {
		item._timer = setTimeout(() => {
			item.remove();
		}, timeout);
	}
}


async function handleReceiptFile(e) {
	const file = e.target.files && e.target.files[0];
	if (!file) return;

	if (!file.type.startsWith('image/')) {
		showNotification('Please upload an image file (photo of receipt).', 'danger', 5000);
		return;
	}
	showNotification('Scanning receipt image — extracting text...', 'info', 4000);

	try {
		
		if (typeof Tesseract === 'undefined' || !Tesseract.recognize) {
			showNotification('OCR engine not available. Make sure Tesseract.js is loaded.', 'danger');
			return;
		}

		const { data: { text } } = await Tesseract.recognize(file, 'eng');
		if (!text || text.trim().length === 0) {
			showNotification('No text found on image.', 'warning');
			return;
		}

		const found = findFirstDateInText(text);
		if (!found) {
			showNotification('No date found in receipt text. Try a clearer photo.', 'warning');
			return;
		}

		
		const mainDate = document.getElementById('purchase-date');
		if (mainDate) mainDate.value = found;
		const editDate = document.getElementById('purchase-date-edit');
		if (editDate) editDate.value = found;

		showNotification(`Auto-filled date: ${found}`, 'info', 4000);
	} catch (err) {
		console.error('OCR failed', err);
		showNotification('Failed to read receipt: ' + (err.message || err), 'danger');
	} finally {
		
		try { e.target.value = ''; } catch (_) {}
	}
}

function findFirstDateInText(text) {
	// Normalize whitespace
	const t = text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ');

	// Patterns to try
	const patterns = [
	
		/(\b(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})\b)/,
	
		/(\b(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})\b)/,

		/(\b(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2})\b)/,
	
		/(\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\s\.,-]*?(\d{1,2})(?:st|nd|rd|th)?,?[\s\-,]+(\d{4})\b)/i,

		/(\b(\d{1,2})[\s\-](January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec),?[\s\-]+(\d{4})\b)/i
	];

	for (const re of patterns) {
		const m = t.match(re);
		if (m) {
			const raw = m[0];
			const parsed = parseDateString(raw);
			if (parsed) return parsed;
		}
	}
	return null;
}

function parseDateString(s) {
	s = s.trim();

	let m = s.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
	if (m) {
		const y = parseInt(m[1],10), mo = parseInt(m[2],10), d = parseInt(m[3],10);
		if (isValidDate(y,mo,d)) return toInputDate(new Date(y, mo-1, d));
	}


	m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
	if (m) {
		const a = parseInt(m[1],10), b = parseInt(m[2],10), y = parseInt(m[3],10);
	
		if (a > 12 && isValidDate(y, b, a)) return toInputDate(new Date(y, b-1, a));

		if (isValidDate(y, a, b)) return toInputDate(new Date(y, a-1, b));

		if (isValidDate(y, b, a)) return toInputDate(new Date(y, b-1, a));
	}

	// Two-digit year
	m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2})$/);
	if (m) {
		const a = parseInt(m[1],10), b = parseInt(m[2],10), y2 = parseInt(m[3],10);
		const y = y2 > 50 ? 1900 + y2 : 2000 + y2;
		if (a > 12 && isValidDate(y, b, a)) return toInputDate(new Date(y, b-1, a));
		if (isValidDate(y, a, b)) return toInputDate(new Date(y, a-1, b));
		if (isValidDate(y, b, a)) return toInputDate(new Date(y, b-1, a));
	}

	// Text month forms
	m = s.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+?(\d{1,2}),?\s*(\d{4})/i);
	if (m) {
		const mo = monthNameToNumber(m[1]);
		const d = parseInt(m[2],10);
		const y = parseInt(m[3],10);
		if (mo && isValidDate(y, mo, d)) return toInputDate(new Date(y, mo-1, d));
	}

	m = s.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*,?\s*(\d{4})/i);
	if (m) {
		const d = parseInt(m[1],10);
		const mo = monthNameToNumber(m[2]);
		const y = parseInt(m[3],10);
		if (mo && isValidDate(y, mo, d)) return toInputDate(new Date(y, mo-1, d));
	}

	return null;
}

function monthNameToNumber(name) {
	if (!name) return null;
	const m = name.toLowerCase();
	const map = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12 };
	const key = m.slice(0,3);
	return map[key] || null;
}

function isValidDate(y, m, d) {
	if (!y || !m || !d) return false;
	if (m < 1 || m > 12) return false;
	if (d < 1) return false;
	const days = new Date(y, m, 0).getDate();
	return d <= days;
}

function toInputDate(dt) {
	// Format YYYY-MM-DD for date input
	const y = dt.getFullYear();
	const mo = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	return `${y}-${mo}-${d}`;
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

    //  receipt uploader for OCR auto-fill
    const receiptFile = document.getElementById('receipt-file');
    if (receiptFile) {
        receiptFile.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            try {
                const msg = await handleReceiptFile(file);
                showNotification(msg, 'info', 4000);
            } catch (err) {
                console.error('Receipt processing failed:', err);
                showNotification(err.message || 'Failed to process receipt', 'danger', 5000);
            } finally {
                // reset input so same file can be selected again
                try { e.target.value = ''; } catch (_) { }
            }
        });
    }	
	const editForm = document.getElementById('edit-form');
	if (editForm) editForm.addEventListener('submit', handleEditFormSubmit);
	const editCancel = document.getElementById('edit-cancel');
	if (editCancel) editCancel.addEventListener('click', () => closeEditModal(true));
	const editClose = document.getElementById('edit-close');
	if (editClose) editClose.addEventListener('click', () => closeEditModal(true));


	const editModal = document.getElementById('edit-modal');
	if (editModal) {
		editModal.addEventListener('click', (ev) => {
			if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-close') === 'true') {
				closeEditModal(true);
			}
		});
	
		document.addEventListener('keydown', (ev) => {
			if (ev.key === 'Escape') closeEditModal(true);
		});
	}

	// export/import/clear controls
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

	// Notification bell 
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


	updateNotifBadge();

	// sort control
	const sortSelect = document.getElementById('sort-select');
	if (sortSelect) sortSelect.addEventListener('change', renderWarranties);

	renderWarranties();
	checkReminders();
}


document.addEventListener('DOMContentLoaded', init);


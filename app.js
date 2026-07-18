// ================== AUTHENTICATION GUARD ==================
// If not logged in, immediately redirect to the login page.
(function ejayAuthGuard() {
    const isLoggedIn = localStorage.getItem('ejay_auth') === 'true';
    if (!isLoggedIn) {
        window.location.href = 'login.html';
    }
})();

function ejayLogout() {
    localStorage.removeItem('ejay_auth');
    window.location.href = 'login.html';
}
window.ejayLogout = ejayLogout;

document.addEventListener('DOMContentLoaded', () => {
    const userLabel = localStorage.getItem('ejay_user');
    const userBadge = document.getElementById('logged-in-user');
    if (userBadge && userLabel) userBadge.innerText = userLabel;
});

// GLOBAL DATA STORAGE
let salesRecords = [];
let currentEditIndex = null;

function normalizeContactValue(rec) {
    const candidates = [
        rec?.contact,
        rec?.contactNumber,
        rec?.phone,
        rec?.contact_no,
        rec?.['contact number'],
        rec?.['Contact Number']
    ];

    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return 'N/A';
}

function normalizeSalesRecords(records) {
    return (records || []).map((rec) => ({
        ...rec,
        client: rec?.client || '',
        contact: normalizeContactValue(rec),
        po: rec?.po || '',
        service: rec?.service || '',
        qty: parseInt(rec?.qty, 10) || 1,
        amount: parseFloat(rec?.amount) || 0,
        status: rec?.status || 'Paid',
        receivedBy: rec?.receivedBy || 'Nash', // Default to Nash for legacy records
        cash: parseFloat(rec?.cash) || 0,
        gcash: parseFloat(rec?.gcash) || 0
    }));
}

function saveToLocalStorage() {
    localStorage.setItem('ejay_sales_data', JSON.stringify(salesRecords));
}

salesRecords = normalizeSalesRecords(JSON.parse(localStorage.getItem('ejay_sales_data')) || []);
saveToLocalStorage();

// GLOBAL DATA STORAGE - PURCHASE ORDERS
let poRecords = [];
let currentPoEditIndex = null;

function normalizePoRecords(records) {
    return (records || []).map((rec) => {
        const items = (rec?.items || []).map(it => ({
            desc: it?.desc || '',
            qty: parseInt(it?.qty, 10) || 0,
            unit: it?.unit || '',
            price: parseFloat(it?.price) || 0
        }));
        const total = items.reduce((sum, it) => sum + (it.qty * it.price), 0);
        return {
            poNum: rec?.poNum || '',
            poDate: rec?.poDate || '',
            poCompletion: rec?.poCompletion || '',
            supplier: rec?.supplier || '',
            contactPerson: rec?.contactPerson || '',
            phone: rec?.phone || '',
            items: items,
            total: total,
            applyVat: rec?.applyVat === true,
            applyEwt: rec?.applyEwt === true
        };
    });
}

function savePoToLocalStorage() {
    localStorage.setItem('ejay_po_data', JSON.stringify(poRecords));
}

poRecords = normalizePoRecords(JSON.parse(localStorage.getItem('ejay_po_data')) || []);
savePoToLocalStorage();

// DOM ELEMENTS - SALES FORM
const masterForm = document.getElementById('sales-master-form');
const entryIndexId = document.getElementById('entry-index-id');
const fDate = document.getElementById('f-date');
const fClient = document.getElementById('f-client');
const fContact = document.getElementById('contact-number') || document.getElementById('f-contact');
const fPo = document.getElementById('f-po');
const fService = document.getElementById('f-service');
const fQty = document.getElementById('f-qty');
const fAmount = document.getElementById('f-amount');
const fStatus = document.getElementById('f-status');
const fCash = document.getElementById('f-cash');
const fGcash = document.getElementById('f-gcash');
const btnClear = document.getElementById('btn-clear');
const btnDeleteNode = document.getElementById('btn-delete-node');

// DOM ELEMENTS - TABLES, SEARCH & REPORT FILTER
const salesTableBody = document.getElementById('sales-table-body');
const tableSearchInput = document.getElementById('table-search-input');
const reportMonthPicker = document.getElementById('report-month-picker');
const expenseMonthPicker = document.getElementById('expense-month-picker');

// DOM ELEMENTS - PURCHASE ORDER
const poMasterForm = document.getElementById('po-master-form');
const poItemsContainer = document.getElementById('po-items-container');
const btnAddPoLine = document.getElementById('btn-add-po-line');
const poEditIndexId = document.getElementById('po-edit-index');
const poNumInput = document.getElementById('po-num');
const poDateInput = document.getElementById('po-date');
const poCompletionInput = document.getElementById('po-completion');
const poSupplierInput = document.getElementById('po-supplier');
const poContactPersonInput = document.getElementById('po-contact-person');
const poPhoneInput = document.getElementById('po-phone');
const btnClearPo = document.getElementById('btn-clear-po');
const btnDeletePo = document.getElementById('btn-delete-po');
const btnDownloadPoPdf = document.getElementById('btn-download-po-pdf');
const poTableBody = document.getElementById('po-table-body');
const poTableSearchInput = document.getElementById('po-table-search-input');
const poApplyVat = document.getElementById('po-apply-vat');
const poApplyEwt = document.getElementById('po-apply-ewt');
const poTaxPreview = document.getElementById('po-tax-preview');

// INITIALIZE APP
document.addEventListener('DOMContentLoaded', () => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('live-date-str').innerText = new Date().toLocaleDateString('en-US', options);
    
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (reportMonthPicker) reportMonthPicker.value = currentMonthStr;
    if (expenseMonthPicker) expenseMonthPicker.value = currentMonthStr;

    initFormEvents();
    initReportEvents();
    initPoEvents();
    initInventoryModule();
    initExpenseModule();
    
    renderMasterTable();
    renderMonthlyReport();
    renderDashboardView();
    renderExpensesTable();
    renderPoTable();
});

// 2. SALES FORM OPERATIONS
function initFormEvents() {
    if (!masterForm) return;

    masterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const record = {
            date: fDate.value,
            client: fClient.value,
            contact: (fContact.value || '').trim() || 'N/A',
            po: fPo.value,
            service: fService.value,
            qty: parseInt(fQty.value) || 1,
            amount: parseFloat(fAmount.value) || 0,
            status: fStatus.value,
            receivedBy: document.getElementById('f-received-by').value,
            cash: parseFloat(fCash.value) || 0,
            gcash: parseFloat(fGcash.value) || 0
        };

        if (currentEditIndex !== null) {
            salesRecords[currentEditIndex] = record;
            currentEditIndex = null;
        } else {
            salesRecords.push(record);
        }

        saveToLocalStorage();
        resetFormState();
        renderMasterTable();
        renderMonthlyReport();
        renderDashboardView();
    });

    btnClear.addEventListener('click', resetFormState);

    btnDeleteNode.addEventListener('click', () => {
        if (currentEditIndex !== null && confirm('Are you sure you want to delete this record?')) {
            salesRecords.splice(currentEditIndex, 1);
            currentEditIndex = null;
            saveToLocalStorage();
            resetFormState();
            renderMasterTable();
            renderMonthlyReport();
            renderDashboardView();
        }
    });

    tableSearchInput.addEventListener('input', renderMasterTable);
}

function resetFormState() {
    if (!masterForm) return;
    masterForm.reset();
    currentEditIndex = null;
    entryIndexId.value = '';
    btnDeleteNode.style.display = 'none';
    document.getElementById('btn-submit-node').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Record`;
}

// 3. RENDER TRANSACTION MASTER LOG (ORGANIZED BY YEAR & MONTH WITH COLLAPSIBLE ACCORDIONS)
function renderMasterTable() {
    if (!salesTableBody) return;
    const searchKey = tableSearchInput.value.toLowerCase();
    salesTableBody.innerHTML = '';

    const groupedLog = {};

    salesRecords.forEach((rec, index) => {
        const recordWithIndex = { ...rec, originalIndex: index };

        if (
            rec.client.toLowerCase().includes(searchKey) ||
            rec.po.toLowerCase().includes(searchKey) ||
            rec.service.toLowerCase().includes(searchKey)
        ) {
            if (!rec.date) return;
            const [year, month] = rec.date.split('-');

            if (!groupedLog[year]) groupedLog[year] = {};
            if (!groupedLog[year][month]) groupedLog[year][month] = [];

            groupedLog[year][month].push(recordWithIndex);
        }
    });

    const years = Object.keys(groupedLog).sort((a, b) => b - a);

    if (years.length === 0) {
        salesTableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 30px; color: var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                    No records found.
                </td>
            </tr>
        `;
        return;
    }

    // Track open/collapsed state of month folders in localStorage so they persist on refresh
    let collapsedMonths = JSON.parse(localStorage.getItem('ejay_collapsed_months') || '[]');

    years.forEach(year => {
        const months = Object.keys(groupedLog[year]).sort((a, b) => b.localeCompare(a));

        months.forEach(month => {
            const dateObj = new Date(year, month - 1);
            const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            const records = groupedLog[year][month];
            const monthId = `${year}-${month}`;
            const isCollapsed = collapsedMonths.includes(monthId);

            // Header Row (Folder Toggle)
            const headerRow = document.createElement('tr');
            headerRow.style.background = 'rgba(124, 77, 255, 0.12)';
            headerRow.style.cursor = 'pointer';
            headerRow.style.userSelect = 'none';
            headerRow.innerHTML = `
                <td colspan="12" style="font-weight: 700; color: #fff; padding: 12px 20px; border-left: 4px solid var(--violet-accent);">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <i class="fa-solid ${isCollapsed ? 'fa-folder' : 'fa-folder-open'}" style="color: #F5A623; margin-right: 8px; font-size: 1.1rem;"></i>
                            ${monthLabel} — (${records.length} ${records.length === 1 ? 'transaction' : 'transactions'})
                        </div>
                        <i class="fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}" style="font-size: 0.85rem; color: var(--text-muted);"></i>
                    </div>
                </td>
            `;

            headerRow.addEventListener('click', () => {
                let currentCollapsed = JSON.parse(localStorage.getItem('ejay_collapsed_months') || '[]');
                if (currentCollapsed.includes(monthId)) {
                    currentCollapsed = currentCollapsed.filter(id => id !== monthId);
                } else {
                    currentCollapsed.push(monthId);
                }
                localStorage.setItem('ejay_collapsed_months', JSON.stringify(currentCollapsed));
                renderMasterTable();
            });

            salesTableBody.appendChild(headerRow);

            // Only render the rows if the folder is NOT collapsed
            if (!isCollapsed) {
                records.forEach(rec => {
                    const tr = document.createElement('tr');
                    if (rec.status === 'Unpaid') tr.classList.add('unpaid-row');

                    tr.innerHTML = `
                        <td>${rec.date}</td>
                        <td style="font-weight:600;">${rec.client}</td>
                        <td>${normalizeContactValue(rec)}</td>
                        <td><span style="color:#F5A623; font-weight:600;">${rec.po}</span></td>
                        <td>${rec.service}</td>
                        <td>${rec.qty}</td>
                        <td style="font-weight:700;">₱${rec.amount.toFixed(2)}</td>
                        <td><span class="badge ${rec.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">${rec.status}</span></td>
                        <td style="font-weight:600; color: var(--accent);">${rec.receivedBy || 'Nash'}</td>
                        <td>₱${rec.cash.toFixed(2)}</td>
                        <td>₱${rec.gcash.toFixed(2)}</td>
                        <td style="text-align: center;">
                            <div class="action-btns">
                                <button type="button" class="btn-icon btn-edit" onclick="setupEditMode(${rec.originalIndex})">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button type="button" class="btn-icon btn-delete" onclick="triggerDirectDelete(${rec.originalIndex})">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    salesTableBody.appendChild(tr);
                });
            }
        });
    });
}

window.setupEditMode = function(index) {
    currentEditIndex = index;
    const rec = salesRecords[index];
    const modal = document.getElementById('sales-edit-modal');
    if (!modal) {
        // Fallback: inline edit kung walang modal (legacy support)
        fDate.value = rec.date;
        fClient.value = rec.client;
        fContact.value = normalizeContactValue(rec) === 'N/A' ? '' : normalizeContactValue(rec);
        fPo.value = rec.po;
        fService.value = rec.service;
        fQty.value = rec.qty;
        fAmount.value = rec.amount;
        fStatus.value = rec.status;
        fCash.value = rec.cash;
        fGcash.value = rec.gcash;
        btnDeleteNode.style.display = 'inline-flex';
        document.getElementById('btn-submit-node').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Update Record`;
        return;
    }
    // Modal-based edit
    document.getElementById('edit-entry-index-id').value = index;
    document.getElementById('edit-f-date').value = rec.date;
    document.getElementById('edit-f-client').value = rec.client;
    document.getElementById('edit-contact-number').value = normalizeContactValue(rec) === 'N/A' ? '' : normalizeContactValue(rec);
    document.getElementById('edit-f-po').value = rec.po;
    document.getElementById('edit-f-service').value = rec.service;
    document.getElementById('edit-f-qty').value = rec.qty;
    document.getElementById('edit-f-amount').value = rec.amount;
    document.getElementById('edit-f-status').value = rec.status;
    if (document.getElementById('edit-f-received-by')) {
        document.getElementById('edit-f-received-by').value = rec.receivedBy || 'Nash';
    }
    document.getElementById('edit-f-cash').value = rec.cash;
    document.getElementById('edit-f-gcash').value = rec.gcash;
    document.getElementById('sales-edit-modal-title').innerText = `Edit Sales — ${rec.client}`;
    modal.style.display = 'flex';
};

window.closeSalesEditModal = function() {
    document.getElementById('sales-edit-modal').style.display = 'none';
};

window.triggerDirectDelete = function(index) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        salesRecords.splice(index, 1);
        saveToLocalStorage();
        renderMasterTable();
        renderMonthlyReport();
        renderDashboardView();
        if (currentEditIndex === index) resetFormState();
        closeSalesEditModal();
    }
};

// Sales Edit Modal form submit
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('sales-edit-form');
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const index = parseInt(document.getElementById('edit-entry-index-id').value);
            if (isNaN(index) || index < 0) return;

            const record = {
                date: document.getElementById('edit-f-date').value,
                client: document.getElementById('edit-f-client').value,
                contact: (document.getElementById('edit-contact-number').value || '').trim() || 'N/A',
                po: document.getElementById('edit-f-po').value,
                service: document.getElementById('edit-f-service').value,
                qty: parseInt(document.getElementById('edit-f-qty').value) || 1,
                amount: parseFloat(document.getElementById('edit-f-amount').value) || 0,
                status: document.getElementById('edit-f-status').value,
                receivedBy: document.getElementById('edit-f-received-by') ? document.getElementById('edit-f-received-by').value : 'Nash',
                cash: parseFloat(document.getElementById('edit-f-cash').value) || 0,
                gcash: parseFloat(document.getElementById('edit-f-gcash').value) || 0
            };

            salesRecords[index] = record;
            saveToLocalStorage();
            renderMasterTable();
            renderMonthlyReport();
            renderDashboardView();
            closeSalesEditModal();
        });
    }

    // Delete button inside edit modal
    const editDeleteBtn = document.getElementById('edit-btn-delete');
    if (editDeleteBtn) {
        editDeleteBtn.addEventListener('click', () => {
            const index = parseInt(document.getElementById('edit-entry-index-id').value);
            if (!isNaN(index) && index >= 0) {
                triggerDirectDelete(index);
            }
        });
    }
});

// 4. MONTHLY REPORTS ENGINE
function initReportEvents() {
    if (!reportMonthPicker) return;

    reportMonthPicker.addEventListener('change', renderMonthlyReport);
    
    const userFilter = document.getElementById('report-user-filter');
    if (userFilter) {
        userFilter.addEventListener('change', renderMonthlyReport);
    }
    
    document.getElementById('btn-print-browser').addEventListener('click', () => {
        preparePrintableData();
        window.print();
    });

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        preparePrintableData();
        const element = document.getElementById('printable-report-area');
        
        // Apply strict landscape A4 context class
        element.classList.add('pdf-landscape-context');
        element.style.display = 'block'; 

        const targetMonthText = document.getElementById('pdf-target-month').innerText;

        const pdfOptions = {
            margin:       0, // Margins are handled perfectly by our CSS padding
            filename:     `EJAY_Sales_Report_${targetMonthText.replace(/ /g, '_')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true, width: 1122 },
            jsPDF:        { unit: 'px', hotfixes: ['px_scaling'], format: [1122, 794], orientation: 'landscape' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        html2pdf().set(pdfOptions).from(element).save().then(() => {
            element.style.display = 'none';
            element.classList.remove('pdf-landscape-context');
        }).catch(err => {
            console.error(err);
            element.style.display = 'none';
            element.classList.remove('pdf-landscape-context');
        });
    });
}

function renderMonthlyReport() {
    if (!reportMonthPicker) return;
    const targetMonth = reportMonthPicker.value;
    if (!targetMonth) return;

    const [year, month] = targetMonth.split('-');
    const dateObj = new Date(year, month - 1);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    document.getElementById('report-view-heading').innerText = `Breakdown Report for ${monthName}`;
    
    let monthlyFiltered = salesRecords.filter(rec => rec.date.startsWith(targetMonth));
    
    const userFilter = document.getElementById('report-user-filter');
    const selectedUser = userFilter ? userFilter.value : 'Overall';
    
    if (selectedUser !== 'Overall') {
        monthlyFiltered = monthlyFiltered.filter(rec => (rec.receivedBy || 'Nash') === selectedUser);
    }

    let tSales = 0, tCash = 0, tGcash = 0, tUnpaid = 0;
    let tFivePercent = 0;
    
    monthlyFiltered.forEach(rec => {
        tSales += rec.amount;
        tCash += rec.cash;
        tGcash += rec.gcash;
        if (rec.status === 'Unpaid') tUnpaid += rec.amount;
        
        // Only Nash's sales should be included in the 5% commission computation
        if ((rec.receivedBy || 'Nash') === 'Nash') {
            tFivePercent += (rec.cash + rec.gcash) * 0.05;
        }
    });

    document.getElementById('rep-total-sales').innerText = `₱${tSales.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('rep-total-cash').innerText = `₱${tCash.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('rep-total-gcash').innerText = `₱${tGcash.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('rep-total-five-percent').innerText = `₱${tFivePercent.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('rep-total-unpaid').innerText = `₱${tUnpaid.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('rep-total-tx').innerText = `${monthlyFiltered.length} Records`;
}

function preparePrintableData() {
    const targetMonth = reportMonthPicker.value;
    const [year, month] = targetMonth.split('-');
    const dateObj = new Date(year, month - 1);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    document.getElementById('pdf-target-month').innerText = monthName;
    document.getElementById('pdf-generation-timestamp').innerText = new Date().toLocaleString('en-US');

    let filteredRecords = salesRecords.filter(rec => rec.date.startsWith(targetMonth));
    
    const userFilter = document.getElementById('report-user-filter');
    const selectedUser = userFilter ? userFilter.value : 'Overall';
    
    const pdfReportFor = document.getElementById('pdf-report-for');
    if (pdfReportFor) {
        pdfReportFor.innerText = selectedUser;
    }
    
    if (selectedUser !== 'Overall') {
        filteredRecords = filteredRecords.filter(rec => (rec.receivedBy || 'Nash') === selectedUser);
    }

    const pdfTableContainer = document.getElementById('pdf-table-rows-container');
    pdfTableContainer.innerHTML = '';

    let totalGross = 0, totalCash = 0, totalGcash = 0, totalUnpaid = 0;
    let totalFivePercent = 0;

    filteredRecords.forEach(rec => {
        totalGross += rec.amount;
        totalCash += rec.cash;
        totalGcash += rec.gcash;
        if (rec.status === 'Unpaid') totalUnpaid += rec.amount;
        
        // Only Nash's sales should be included in the 5% commission computation
        if ((rec.receivedBy || 'Nash') === 'Nash') {
            totalFivePercent += (rec.cash + rec.gcash) * 0.05;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${rec.date}</td>
            <td style="font-weight:700; color:#111827;">${rec.client}</td>
            <td>${normalizeContactValue(rec)}</td>
            <td style="color:#2F3192; font-weight:700;">${rec.po}</td>
            <td>${rec.service}</td>
            <td style="text-align:center;">${rec.qty}</td>
            <td class="num-col">₱${rec.amount.toFixed(2)}</td>
            <td style="text-align:center; font-weight:800; color: ${rec.status === 'Paid' ? '#10b981' : '#ef4444'}">${rec.status}</td>
            <td style="font-weight:600; color: #F5A623;">${rec.receivedBy || 'Nash'}</td>
            <td class="num-col">₱${rec.cash.toFixed(2)}</td>
            <td class="num-col">₱${rec.gcash.toFixed(2)}</td>
        `;
        pdfTableContainer.appendChild(row);
    });

    document.getElementById('pdf-meta-sales').innerText = `₱${totalGross.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('pdf-meta-cash').innerText = `₱${totalCash.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('pdf-meta-gcash').innerText = `₱${totalGcash.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('pdf-meta-five-percent').innerText = `₱${totalFivePercent.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('pdf-meta-unpaid').innerText = `₱${totalUnpaid.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
}

function buildDashboardTrendData(range) {
    const allRecords = [
        ...salesRecords.map(rec => ({ ...rec, type: 'sales', amountValue: parseFloat(rec.amount) || 0 })),
        ...expenseRecords.map(rec => ({ ...rec, type: 'expense', amountValue: parseFloat(rec.gross) || 0 }))
    ].filter(rec => rec.date);

    const periodsMap = new Map();

    allRecords.forEach(rec => {
        const recDate = new Date(rec.date + 'T00:00:00');
        let periodKey = '';
        let label = '';
        let start = null;

        if (range === 'monthly') {
            periodKey = `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, '0')}`;
            label = recDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            start = new Date(recDate.getFullYear(), recDate.getMonth(), 1);
        } else {
            periodKey = `${recDate.getFullYear()}`;
            label = `${recDate.getFullYear()}`;
            start = new Date(recDate.getFullYear(), 0, 1);
        }

        if (!periodsMap.has(periodKey)) {
            periodsMap.set(periodKey, {
                key: periodKey,
                label,
                start,
                sales: 0,
                expenses: 0
            });
        }

        const periodEntry = periodsMap.get(periodKey);
        if (rec.type === 'sales') periodEntry.sales += rec.amountValue;
        else periodEntry.expenses += rec.amountValue;
    });

    const periods = Array.from(periodsMap.values()).sort((a, b) => a.start - b.start);
    const filteredPeriods = periods.filter(period => period.sales > 0 || period.expenses > 0);

    return {
        periods: filteredPeriods,
        salesData: filteredPeriods.map(period => period.sales),
        expenseData: filteredPeriods.map(period => period.expenses)
    };
}

function renderDashboardChart(range) {
    const svg = document.getElementById('dashboard-chart-svg');
    const emptyState = document.getElementById('dashboard-chart-empty');
    if (!svg) return;

    const { periods, salesData, expenseData } = buildDashboardTrendData(range);
    const hasData = salesData.some(v => v > 0) || expenseData.some(v => v > 0);

    if (!hasData) {
        svg.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    const width = 640;
    const height = 280;
    const padding = { top: 24, right: 20, bottom: 50, left: 56 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    // Add ~15% headroom above the tallest bar so it never touches the top edge
    // or gets its value label clipped.
    const rawMax = Math.max(...salesData, ...expenseData, 1);
    const maxValue = rawMax * 1.15;
    const groupWidth = innerWidth / periods.length;
    const barWidth = Math.max(10, Math.min(34, groupWidth * 0.3));

    const formatShort = (val) => {
        if (val >= 1000000) return `₱${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `₱${(val / 1000).toFixed(1)}K`;
        return `₱${val.toFixed(0)}`;
    };

    const gridLines = 4;
    const gridMarkup = Array.from({ length: gridLines }, (_, index) => {
        const y = padding.top + (innerHeight / gridLines) * index;
        const value = maxValue - (maxValue / gridLines) * index;
        return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid" />
        <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="chart-label">${formatShort(value)}</text>`;
    }).join('');

    const barsMarkup = periods.map((period, index) => {
        const centerX = padding.left + groupWidth * index + groupWidth / 2;
        const salesHeight = (salesData[index] / maxValue) * innerHeight;
        const expenseHeight = (expenseData[index] / maxValue) * innerHeight;
        const salesY = padding.top + innerHeight - salesHeight;
        const expenseY = padding.top + innerHeight - expenseHeight;
        const salesX = centerX - barWidth - 6;
        const expenseX = centerX + 6;

        const salesValueLabel = salesData[index] > 0
            ? `<text x="${salesX + barWidth / 2}" y="${salesY - 6}" text-anchor="middle" class="chart-value-label">${formatShort(salesData[index])}</text>`
            : '';
        const expenseValueLabel = expenseData[index] > 0
            ? `<text x="${expenseX + barWidth / 2}" y="${expenseY - 6}" text-anchor="middle" class="chart-value-label">${formatShort(expenseData[index])}</text>`
            : '';

        return `
            <rect x="${salesX}" y="${Math.max(padding.top, salesY)}" width="${barWidth}" height="${Math.max(0, salesHeight)}" rx="7" class="chart-bar-sales"><title>${period.label} Sales: ${formatShort(salesData[index])}</title></rect>
            <rect x="${expenseX}" y="${Math.max(padding.top, expenseY)}" width="${barWidth}" height="${Math.max(0, expenseHeight)}" rx="7" class="chart-bar-expenses"><title>${period.label} Expenses: ${formatShort(expenseData[index])}</title></rect>
            ${salesValueLabel}
            ${expenseValueLabel}
            <text x="${centerX}" y="${height - 16}" text-anchor="middle" class="chart-label">${period.label}</text>
        `;
    }).join('');

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.innerHTML = `
        <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="transparent"></rect>
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="chart-axis"></line>
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="chart-axis"></line>
        ${gridMarkup}
        ${barsMarkup}
    `;
}

let dashboardChartControlsInitialized = false;
function initDashboardChartControls() {
    // Guard against re-attaching a fresh set of click listeners every time
    // renderDashboardView() runs (on every add/edit/delete), which previously
    // caused listeners to pile up and the chart to re-render multiple times
    // per click.
    if (dashboardChartControlsInitialized) return;
    dashboardChartControlsInitialized = true;

    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-btn').forEach(item => item.classList.remove('active'));
            btn.classList.add('active');
            renderDashboardChart(btn.dataset.range);
        });
    });
}

// 5. DASHBOARD ARCHIVE MODAL SYSTEM
function renderDashboardView() {
    const accordionContainer = document.getElementById('dashboard-monthly-accordion');
    if (!accordionContainer) return;
    accordionContainer.innerHTML = '';
    initDashboardChartControls();
    renderDashboardChart(document.querySelector('.chart-btn.active')?.dataset.range || 'monthly');

    const modalEl = document.getElementById('dashboard-modal');
    const modalTitle = document.getElementById('modal-folder-title');
    const modalData = document.getElementById('modal-dynamic-data');
    const modalClose = document.getElementById('close-dashboard-modal');

    const closeModal = () => { modalEl.style.display = 'none'; };
    modalClose.onclick = closeModal;
    modalEl.querySelector('.modal-backdrop').onclick = closeModal;

    const createArchiveFolder = ({
        title,
        icon,
        accent,
        overallSummary,
        groupedData,
        buildOverallHtml,
        buildMonthHtml,
        folderTitlePrefix
    }) => {
        const mainFolderBlock = document.createElement('div');
        mainFolderBlock.style.marginBottom = '15px';

        const mainHeader = document.createElement('div');
        mainHeader.className = 'glass-card';
        mainHeader.style.cssText = `cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-radius: 12px; border-left: 5px solid ${accent}; background: rgba(255,255,255,0.03);`;
        mainHeader.innerHTML = `
            <span style="font-weight: 800; font-size: 1.1rem; color: #fff; letter-spacing: 0.5px;">
                <i class="${icon}" style="color: ${accent}; margin-right: 12px;"></i>${title}
            </span>
            <i class="fa-solid fa-chevron-down" style="color: var(--text-muted); transition: transform 0.3s;"></i>
        `;

        const mainContent = document.createElement('div');
        mainContent.style.cssText = 'display: none; padding: 20px; background: rgba(7, 8, 20, 0.3); border: 1px solid var(--glass-border); border-top: none; border-radius: 0 0 16px 16px; margin-top: -4px;';

        const overallBlock = document.createElement('div');
        overallBlock.style.marginBottom = '20px';

        const overallHeader = document.createElement('div');
        overallHeader.className = 'glass-card';
        overallHeader.style.cssText = 'cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-radius: 10px; border-left: 5px solid #7C4DFF; background: rgba(124, 77, 255, 0.03);';
        overallHeader.innerHTML = `
            <span style="font-weight: 700; font-size: 0.95rem; color: #fff;">
                <i class="fa-solid fa-layer-group" style="color: #7C4DFF; margin-right: 12px;"></i>OVERALL SUMMARY (ALL-TIME)
            </span>
            <i class="fa-solid fa-expand" style="color: var(--text-muted); font-size: 0.85rem;"></i>
        `;

        overallHeader.onclick = (e) => {
            e.stopPropagation();
            modalTitle.innerText = `${folderTitlePrefix} — OVERALL SUMMARY`;
            modalData.innerHTML = buildOverallHtml(overallSummary);
            modalEl.style.display = 'flex';
        };

        overallBlock.appendChild(overallHeader);
        mainContent.appendChild(overallBlock);

        const sortedYears = Object.keys(groupedData).sort((a, b) => b - a);
        sortedYears.forEach(year => {
            const yearBlock = document.createElement('div');
            yearBlock.style.marginBottom = '15px';

            const yearHeader = document.createElement('div');
            yearHeader.className = 'glass-card';
            yearHeader.style.cssText = 'cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-radius: 10px; border-left: 4px solid var(--violet-accent); background: rgba(255,255,255,0.02);';
            yearHeader.innerHTML = `
                <span style="font-weight: 700; font-size: 0.95rem; color: #fff;">
                    <i class="fa-regular fa-folder-open" style="color: var(--violet-accent); margin-right: 12px;"></i>${title} ${year}
                </span>
                <i class="fa-solid fa-chevron-down" style="color: var(--text-muted); transition: transform 0.3s;"></i>
            `;

            const yearContent = document.createElement('div');
            yearContent.style.cssText = 'display: none; padding: 15px; background: rgba(7, 8, 20, 0.2); border: 1px solid var(--glass-border); border-top: none; border-radius: 0 0 12px 12px; margin-top: -4px;';

            const sortedMonths = Object.keys(groupedData[year]).sort((a, b) => b.localeCompare(a));
            sortedMonths.forEach(month => {
                const dateObj = new Date(year, month - 1);
                const monthYearLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                const group = groupedData[year][month];

                const monthRow = document.createElement('div');
                monthRow.className = 'glass-card';
                monthRow.style.cssText = 'cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-radius: 8px; margin-bottom: 8px; background: rgba(255,255,255,0.01); transition: background 0.2s;';
                monthRow.innerHTML = `
                    <span style="font-weight: 600; font-size: 0.88rem; color: #eee;">
                        <i class="fa-regular fa-folder" style="color: #60a5fa; margin-right: 10px;"></i>${monthYearLabel}
                    </span>
                    <span style="font-size: 0.78rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 20px;">
                        ${group.transactions.length} Tx
                    </span>
                `;

                monthRow.onclick = (e) => {
                    e.stopPropagation();
                    modalTitle.innerHTML = `<i class="fa-regular fa-folder-open"></i> ${folderTitlePrefix} — ${monthYearLabel}`;
                    modalData.innerHTML = buildMonthHtml(group, monthYearLabel);
                    modalEl.style.display = 'flex';
                };

                yearContent.appendChild(monthRow);
            });

            yearHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = yearContent.style.display === 'block';
                yearContent.style.display = isOpen ? 'none' : 'block';
                const icon = yearHeader.querySelector('.fa-chevron-down');
                if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
                yearHeader.style.borderRadius = isOpen ? '10px' : '10px 10px 0 0';
            });

            yearBlock.appendChild(yearHeader);
            yearBlock.appendChild(yearContent);
            mainContent.appendChild(yearBlock);
        });

        mainHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = mainContent.style.display === 'block';
            mainContent.style.display = isOpen ? 'none' : 'block';
            const icon = mainHeader.querySelector('.fa-chevron-down');
            if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            mainHeader.style.borderRadius = isOpen ? '12px' : '12px 12px 0 0';
        });

        mainFolderBlock.appendChild(mainHeader);
        mainFolderBlock.appendChild(mainContent);
        return mainFolderBlock;
    };

    let overallGross = 0, overallPaid = 0, overallUnpaid = 0;
    const salesGroupedData = {};

    salesRecords.forEach(rec => {
        const amt = parseFloat(rec.amount) || 0;
        overallGross += amt;
        if (rec.status === 'Paid') overallPaid += amt; else overallUnpaid += amt;

        if (!rec.date) return;
        const [year, month] = rec.date.split('-');

        if (!salesGroupedData[year]) salesGroupedData[year] = {};
        if (!salesGroupedData[year][month]) {
            salesGroupedData[year][month] = { gross: 0, paid: 0, unpaid: 0, transactions: [] };
        }

        salesGroupedData[year][month].transactions.push(rec);
        salesGroupedData[year][month].gross += amt;
        if (rec.status === 'Paid') salesGroupedData[year][month].paid += amt; else salesGroupedData[year][month].unpaid += amt;
    });

    accordionContainer.appendChild(createArchiveFolder({
        title: 'Ejay Sales',
        icon: 'fa-solid fa-receipt',
        accent: '#F5A623',
        overallSummary: { gross: overallGross, paid: overallPaid, unpaid: overallUnpaid, transactions: salesRecords.length },
        groupedData: salesGroupedData,
        folderTitlePrefix: 'Ejay Sales',
        buildOverallHtml: (summary) => `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div class="glass-card card-total-sales" style="padding: 18px;"><div class="metric-title">Total Gross Sales</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">₱${summary.gross.toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
                <div class="glass-card card-total-paid" style="padding: 18px;"><div class="metric-title">Total Paid</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">₱${summary.paid.toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
                <div class="glass-card card-total-unpaid" style="padding: 18px;"><div class="metric-title">Total Unpaid</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">₱${summary.unpaid.toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
                <div class="glass-card card-total-tx" style="padding: 18px;"><div class="metric-title">Transactions</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">${summary.transactions} Records</div></div>
            </div>
        `,
        buildMonthHtml: (group, monthLabel) => `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="border-left: 4px solid var(--accent); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px;">
                    <div class="metric-title" style="font-size:0.65rem;">Gross Sales</div>
                    <div style="font-size: 1.2rem; font-weight:800; color:#fff; margin-top:4px;">₱${group.gross.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                </div>
                <div style="border-left: 4px solid var(--success); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px;">
                    <div class="metric-title" style="font-size:0.65rem;">Paid Collected</div>
                    <div style="font-size: 1.2rem; font-weight:800; color:#fff; margin-top:4px;">₱${group.paid.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                </div>
                <div style="border-left: 4px solid var(--danger); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px;">
                    <div class="metric-title" style="font-size:0.65rem;">Total Unpaid</div>
                    <div style="font-size: 1.2rem; font-weight:800; color:#fff; margin-top:4px;">₱${group.unpaid.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Client Name</th>
                            <th>PO No.</th>
                            <th>Service Type</th>
                            <th>Qty</th>
                            <th>Total Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.transactions.map(t => `
                            <tr class="${t.status === 'Unpaid' ? 'unpaid-row' : ''}">
                                <td>${t.date}</td>
                                <td style="font-weight:600;">${t.client}</td>
                                <td><span style="color:#F5A623; font-weight:600;">${t.po}</span></td>
                                <td>${t.service}</td>
                                <td>${t.qty}</td>
                                <td style="font-weight:700;">₱${(parseFloat(t.amount) || 0).toFixed(2)}</td>
                                <td><span class="badge ${t.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">${t.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `
    }));

    const inventoryGroupedData = {};
    let inventoryInQty = 0;
    let inventoryOutQty = 0;
    stockMovements.forEach(mv => {
        if (!mv.date) return;
        const [year, month] = mv.date.split('-');

        if (!inventoryGroupedData[year]) inventoryGroupedData[year] = {};
        if (!inventoryGroupedData[year][month]) {
            inventoryGroupedData[year][month] = { inQty: 0, outQty: 0, transactions: [] };
        }

        inventoryGroupedData[year][month].transactions.push(mv);
        inventoryGroupedData[year][month].inQty += mv.type === 'IN' ? (parseFloat(mv.qty) || 0) : 0;
        inventoryGroupedData[year][month].outQty += mv.type === 'OUT' ? (parseFloat(mv.qty) || 0) : 0;
        if (mv.type === 'IN') inventoryInQty += (parseFloat(mv.qty) || 0);
        else inventoryOutQty += (parseFloat(mv.qty) || 0);
    });

    accordionContainer.appendChild(createArchiveFolder({
        title: 'Inventory',
        icon: 'fa-solid fa-boxes-stacked',
        accent: '#60a5fa',
        overallSummary: {
            materials: materials.length,
            lowStock: materials.filter(m => m.stock > 0 && m.stock <= m.reorderLevel).length,
            outStock: materials.filter(m => m.stock <= 0).length,
            inQty: inventoryInQty,
            outQty: inventoryOutQty,
            transactions: stockMovements.length
        },
        groupedData: inventoryGroupedData,
        folderTitlePrefix: 'Inventory',
        buildOverallHtml: (summary) => `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div class="glass-card card-inv-materials" style="padding: 18px;"><div class="metric-title">Total Materials</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">${summary.materials}</div></div>
                <div class="glass-card card-inv-low" style="padding: 18px;"><div class="metric-title">Low Stock Items</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">${summary.lowStock}</div></div>
                <div class="glass-card card-inv-out" style="padding: 18px;"><div class="metric-title">Out of Stock</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">${summary.outStock}</div></div>
                <div class="glass-card card-inv-value" style="padding: 18px;"><div class="metric-title">Movement Qty</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">In ${formatQty(summary.inQty)} / Out ${formatQty(summary.outQty)}</div></div>
            </div>
        `,
        buildMonthHtml: (group, monthLabel) => `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="border-left: 4px solid var(--success); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px;">
                    <div class="metric-title" style="font-size:0.65rem;">Stock In Qty</div>
                    <div style="font-size: 1.2rem; font-weight:800; color:#fff; margin-top:4px;">${formatQty(group.inQty)}</div>
                </div>
                <div style="border-left: 4px solid var(--danger); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px;">
                    <div class="metric-title" style="font-size:0.65rem;">Stock Out Qty</div>
                    <div style="font-size: 1.2rem; font-weight:800; color:#fff; margin-top:4px;">${formatQty(group.outQty)}</div>
                </div>
                <div style="border-left: 4px solid var(--accent); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px;">
                    <div class="metric-title" style="font-size:0.65rem;">Transactions</div>
                    <div style="font-size: 1.2rem; font-weight:800; color:#fff; margin-top:4px;">${group.transactions.length}</div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Material</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Balance After</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.transactions.map(mv => `
                            <tr>
                                <td>${mv.date}</td>
                                <td style="font-weight:600;">${mv.materialCode} — ${mv.materialName}</td>
                                <td><span class="badge ${mv.type === 'IN' ? 'badge-in' : 'badge-out'}">${mv.type === 'IN' ? 'Stock In' : 'Stock Out'}</span></td>
                                <td>${mv.type === 'IN' ? '+' : '-'}${formatQty(mv.qty)} ${mv.unit}</td>
                                <td style="font-weight:700;">${formatQty(mv.balanceAfter)} ${mv.unit}</td>
                                <td>${mv.reference || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `
    }));

    const expenseGroupedData = {};
    let totalExpenseGross = 0;
    let totalExpenseNonVat = 0;
    let totalExpenseOther = 0;
    expenseRecords.forEach(rec => {
        if (!rec.date) return;
        const [year, month] = rec.date.split('-');

        if (!expenseGroupedData[year]) expenseGroupedData[year] = {};
        if (!expenseGroupedData[year][month]) {
            expenseGroupedData[year][month] = { gross: 0, nonVat: 0, other: 0, transactions: [] };
        }

        expenseGroupedData[year][month].transactions.push(rec);
        expenseGroupedData[year][month].gross += (parseFloat(rec.gross) || 0);
        if (rec.category === 'Other Expenses') expenseGroupedData[year][month].other += (parseFloat(rec.gross) || 0);
        else expenseGroupedData[year][month].nonVat += (parseFloat(rec.gross) || 0);
        totalExpenseGross += (parseFloat(rec.gross) || 0);
        if (rec.category === 'Other Expenses') totalExpenseOther += (parseFloat(rec.gross) || 0);
        else totalExpenseNonVat += (parseFloat(rec.gross) || 0);
    });

    accordionContainer.appendChild(createArchiveFolder({
        title: 'Expenses',
        icon: 'fa-solid fa-money-bill-wave',
        accent: '#F5A623',
        overallSummary: {
            gross: totalExpenseGross,
            nonVat: totalExpenseNonVat,
            other: totalExpenseOther,
            transactions: expenseRecords.length
        },
        groupedData: expenseGroupedData,
        folderTitlePrefix: 'Expenses',
        buildOverallHtml: (summary) => `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div class="glass-card card-total-sales" style="padding: 18px;"><div class="metric-title">Total Gross</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">₱${summary.gross.toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
                <div class="glass-card card-total-paid" style="padding: 18px;"><div class="metric-title">Non-Vat</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">₱${summary.nonVat.toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
                <div class="glass-card card-total-unpaid" style="padding: 18px;"><div class="metric-title">Other Expenses</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">₱${summary.other.toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
                <div class="glass-card card-total-tx" style="padding: 18px;"><div class="metric-title">Transactions</div><div style="font-size: 1.4rem; font-weight:800; margin-top:6px;">${summary.transactions} Records</div></div>
            </div>
        `,
        buildMonthHtml: (group, monthLabel) => `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="border-left: 4px solid var(--accent); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px;">
                    <div class="metric-title" style="font-size:0.65rem;">Gross</div>
                    <div style="font-size: 1.2rem; font-weight:800; color:#fff; margin-top:4px;">₱${group.gross.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                </div>
                <div style="border-left: 4px solid var(--success); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px;">
                    <div class="metric-title" style="font-size:0.65rem;">Non-Vat</div>
                    <div style="font-size: 1.2rem; font-weight:800; color:#fff; margin-top:4px;">₱${group.nonVat.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                </div>
                <div style="border-left: 4px solid var(--danger); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px;">
                    <div class="metric-title" style="font-size:0.65rem;">Other Expenses</div>
                    <div style="font-size: 1.2rem; font-weight:800; color:#fff; margin-top:4px;">₱${group.other.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Category</th>
                            <th>OR/Sales #</th>
                            <th>TIN#</th>
                            <th>Gross Amount</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.transactions.map(rec => `
                            <tr>
                                <td>${rec.date}</td>
                                <td><span class="badge ${rec.category === 'Other Expenses' ? 'badge-noreceipt' : 'badge-nonvat'}">${rec.category}</span></td>
                                <td>${rec.orNum || '—'}</td>
                                <td>${rec.tin || '—'}</td>
                                <td style="font-weight:700;">₱${(parseFloat(rec.gross) || 0).toFixed(2)}</td>
                                <td>${rec.remarks || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `
    }));
}

// 7. PURCHASE ORDER MODULE LOGIC

function addPoItemLineRow(item) {
    const row = document.createElement('div');
    row.className = 'form-grid po-item-row';
    row.style.cssText = 'grid-template-columns: 3fr 1fr 1fr 1fr; margin-bottom: 10px; animation: fadeIn 0.2s ease;';
    row.innerHTML = `
        <div class="input-group"><input type="text" placeholder="Description" class="item-desc" required></div>
        <div class="input-group"><input type="number" placeholder="Qty" class="item-qty" min="1" required></div>
        <div class="input-group"><input type="text" placeholder="Unit" class="item-unit" required></div>
        <div class="input-group"><input type="number" placeholder="Unit Price" class="item-price" step="0.01" required></div>
    `;
    poItemsContainer.appendChild(row);
    if (item) {
        row.querySelector('.item-desc').value = item.desc || '';
        row.querySelector('.item-qty').value = item.qty || '';
        row.querySelector('.item-unit').value = item.unit || '';
        row.querySelector('.item-price').value = item.price || '';
    }
    return row;
}

function readPoItemsFromForm() {
    const itemRows = document.querySelectorAll('.po-item-row');
    const items = [];
    itemRows.forEach(row => {
        items.push({
            desc: row.querySelector('.item-desc').value,
            qty: parseInt(row.querySelector('.item-qty').value) || 0,
            unit: row.querySelector('.item-unit').value,
            price: parseFloat(row.querySelector('.item-price').value) || 0
        });
    });
    return items;
}

function computePoTax(items, applyVat, applyEwt) {
    const subtotal = items.reduce((sum, it) => sum + ((it.qty || 0) * (it.price || 0)), 0);
    const vat = applyVat ? subtotal * 0.12 : 0;
    const amountWithVat = subtotal + vat;
    const ewt = applyEwt ? subtotal * 0.02 : 0;
    const netPayable = amountWithVat - ewt;
    return { subtotal, vat, amountWithVat, ewt, netPayable };
}

function updatePoTaxPreview() {
    if (!poTaxPreview) return;
    const items = readPoItemsFromForm();
    const applyVat = poApplyVat && poApplyVat.checked;
    const applyEwt = poApplyEwt && poApplyEwt.checked;
    const hasTax = applyVat || applyEwt;
    const tax = computePoTax(items, applyVat, applyEwt);

    if (!hasTax || items.length === 0 || items.every(it => !it.desc && !it.qty && !it.price)) {
        poTaxPreview.style.display = 'none';
        return;
    }

    poTaxPreview.style.display = 'block';
    const fmt = (n) => '₱' + n.toLocaleString('en-US', { minimumFractionDigits: 2 });

    poTaxPreview.innerHTML = `
        <div class="po-tax-preview-card">
            <div class="preview-row"><span class="label">Subtotal</span><span class="value">${fmt(tax.subtotal)}</span></div>
            ${applyVat ? `<div class="preview-row"><span class="label">VAT (12%)</span><span class="value vat-color">+ ${fmt(tax.vat)}</span></div>` : ''}
            ${applyVat ? `<div class="preview-row"><span class="label">Total Amount (Subtotal + VAT)</span><span class="value">${fmt(tax.amountWithVat)}</span></div>` : ''}
            ${applyEwt ? `<div class="preview-row"><span class="label">Less: EWT (2%)</span><span class="value ewt-color">- ${fmt(tax.ewt)}</span></div>` : ''}
            <div class="preview-row total-row"><span>Net Payable</span><span class="value net-color">${fmt(tax.netPayable)}</span></div>
        </div>
    `;
}

function attachPoItemListeners() {
    document.querySelectorAll('.po-item-row input').forEach(inp => {
        inp.addEventListener('input', updatePoTaxPreview);
    });
}

function resetPoFormState() {
    poMasterForm.reset();
    currentPoEditIndex = null;
    poEditIndexId.value = '';
    poItemsContainer.innerHTML = '';
    addPoItemLineRow();
    // Ensure VAT / EWT checkboxes reset to unchecked
    if (poApplyVat) poApplyVat.checked = false;
    if (poApplyEwt) poApplyEwt.checked = false;
    if (poTaxPreview) poTaxPreview.style.display = 'none';
    btnDeletePo.style.display = 'none';
    document.getElementById('btn-submit-po').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save PO`;
}

function buildPoRecordFromForm() {
    return {
        poNum: poNumInput.value,
        poDate: poDateInput.value,
        poCompletion: poCompletionInput.value,
        supplier: poSupplierInput.value,
        contactPerson: poContactPersonInput.value,
        phone: poPhoneInput.value,
        items: readPoItemsFromForm(),
        applyVat: poApplyVat ? poApplyVat.checked : false,
        applyEwt: poApplyEwt ? poApplyEwt.checked : false
    };
}

function generatePoPdf(rec) {
    // Reset PDF display state
    const element = document.getElementById('printable-po-area');
    if (!element) return;
    element.style.display = 'block';

    // Fill metadata
    document.getElementById('pdf-po-num').innerText = rec.poNum || '-';
    document.getElementById('pdf-po-date').innerText = rec.poDate || '-';
    document.getElementById('pdf-po-completion').innerText = rec.poCompletion || '-';
    document.getElementById('pdf-po-supplier').innerText = rec.supplier || '-';
    document.getElementById('pdf-po-contact-person').innerText = rec.contactPerson || '-';
    document.getElementById('pdf-po-phone').innerText = rec.phone || '-';

    // Fill items table
    const pdfTableRows = document.getElementById('pdf-po-items-rows');
    pdfTableRows.innerHTML = '';

    let grandTotal = 0;
    (rec.items || []).forEach(it => {
        const total = (it.qty || 0) * (it.price || 0);
        grandTotal += total;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${it.desc || ''}</td>
            <td style="text-align: center;">${it.qty || 0}</td>
            <td style="text-align: center;">${it.unit || ''}</td>
            <td class="num-col">₱${(it.price || 0).toFixed(2)}</td>
            <td class="num-col">₱${total.toFixed(2)}</td>
        `;
        pdfTableRows.appendChild(tr);
    });

    document.getElementById('pdf-po-grand-total').innerText = `₱${grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

    // --- Tax Summary for PDF (wrapped in try-catch so it never blocks PDF generation) ---
    try {
        const applyVat = rec.applyVat === true;
        const applyEwt = rec.applyEwt === true;
        const hasTax = applyVat || applyEwt;
        const tax = computePoTax(rec.items || [], applyVat, applyEwt);

        const taxTable = document.getElementById('pdf-tax-summary-table');
        const grandTotalTable = document.getElementById('pdf-grand-total-table');
        const vatRow = document.getElementById('pdf-tax-vat-row');
        const amountRow = document.getElementById('pdf-tax-amount-row');
        const ewtRow = document.getElementById('pdf-tax-ewt-row');
        const netRow = document.getElementById('pdf-tax-net-row');

        if (hasTax && taxTable) {
            taxTable.style.display = 'table';
            if (grandTotalTable) grandTotalTable.style.display = 'none'; // Hide simple total when tax is active
            
            if (document.getElementById('pdf-tax-subtotal'))
                document.getElementById('pdf-tax-subtotal').innerText = `₱${tax.subtotal.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            
            if (applyVat && vatRow && amountRow) {
                vatRow.style.display = 'table-row';
                amountRow.style.display = 'table-row';
                if (document.getElementById('pdf-tax-vat'))
                    document.getElementById('pdf-tax-vat').innerText = `₱${tax.vat.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
                if (document.getElementById('pdf-tax-amount'))
                    document.getElementById('pdf-tax-amount').innerText = `₱${tax.amountWithVat.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            } else {
                if (vatRow) vatRow.style.display = 'none';
                if (amountRow) amountRow.style.display = 'none';
            }

            if (applyEwt && ewtRow) {
                ewtRow.style.display = 'table-row';
                if (document.getElementById('pdf-tax-ewt'))
                    document.getElementById('pdf-tax-ewt').innerText = `₱${tax.ewt.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            } else {
                if (ewtRow) ewtRow.style.display = 'none';
            }

            if (netRow) {
                netRow.style.display = 'table-row';
                if (document.getElementById('pdf-tax-net'))
                    document.getElementById('pdf-tax-net').innerText = `₱${tax.netPayable.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            }
        } else {
            if (taxTable) taxTable.style.display = 'none';
            if (grandTotalTable) grandTotalTable.style.display = 'table'; // Show simple total when no tax is active
        }
    } catch (e) {
        console.warn('Tax summary skipped:', e);
    }

    // Force layout/reflow after VAT/EWT row visibility changes so html2canvas
    // snapshots the final, stable table layout (prevents extra/blank pages
    // and misaligned totals/signatures).
    // eslint-disable-next-line no-unused-expressions
    element.getBoundingClientRect();

    // Minimal stabilization immediately before html2pdf capture:
    // - ensure totals/tax rows that were toggled via display are fully laid out
    // - wait 2 frames to let the browser commit layout changes
    const pdfTaxSummaryTable = document.getElementById('pdf-tax-summary-table');
    if (pdfTaxSummaryTable) pdfTaxSummaryTable.getBoundingClientRect();

    const pdfOptions = {
        margin:       0,
        filename:     `EJAY_PO_${rec.poNum || 'Draft'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    }).then(() => {
        element.classList.add('pdf-portrait-context');
        element.style.display = 'block';
        return html2pdf().set(pdfOptions).from(element).save();
    }).then(() => {
        element.style.display = 'none';
        element.classList.remove('pdf-portrait-context');
    }).catch(err => {
        console.error(err);
        element.style.display = 'none';
        element.classList.remove('pdf-portrait-context');
    });
}

function computePoTax(items, applyVat, applyEwt) {
    const subtotal = items.reduce((sum, it) => sum + ((it.qty || 0) * (it.price || 0)), 0);
    const vat = applyVat ? subtotal * 0.12 : 0;
    const amountWithVat = subtotal + vat;
    const ewt = applyEwt ? subtotal * 0.02 : 0;
    const netPayable = amountWithVat - ewt;
    return { subtotal, vat, amountWithVat, ewt, netPayable };
}

function updatePoTaxPreview() {
    if (!poTaxPreview) return;
    const items = readPoItemsFromForm();
    const applyVat = poApplyVat && poApplyVat.checked;
    const applyEwt = poApplyEwt && poApplyEwt.checked;
    const hasTax = applyVat || applyEwt;
    const tax = computePoTax(items, applyVat, applyEwt);

    if (!hasTax || items.length === 0) {
        poTaxPreview.style.display = 'none';
        return;
    }

    poTaxPreview.style.display = 'block';
    const fmt = (n) => '₱' + n.toLocaleString('en-US', { minimumFractionDigits: 2 });

    poTaxPreview.innerHTML = `
        <div class="po-tax-preview-card">
            <div class="preview-row"><span class="label">Subtotal</span><span class="value">${fmt(tax.subtotal)}</span></div>
            ${applyVat ? `<div class="preview-row"><span class="label">VAT (12%)</span><span class="value vat-color">+ ${fmt(tax.vat)}</span></div>` : ''}
            ${applyVat ? `<div class="preview-row"><span class="label">Total Amount (Subtotal + VAT)</span><span class="value">${fmt(tax.amountWithVat)}</span></div>` : ''}
            ${applyEwt ? `<div class="preview-row"><span class="label">Less: EWT (2%)</span><span class="value ewt-color">- ${fmt(tax.ewt)}</span></div>` : ''}
            <div class="preview-row total-row"><span>Net Payable</span><span class="value net-color">${fmt(tax.netPayable)}</span></div>
        </div>
    `;
}

function attachPoItemListeners() {
    document.querySelectorAll('.po-item-row input').forEach(inp => {
        inp.addEventListener('input', updatePoTaxPreview);
    });
}

function initPoEvents() {
    if (btnAddPoLine) {
        btnAddPoLine.addEventListener('click', () => {
            addPoItemLineRow();
            attachPoItemListeners();
            updatePoTaxPreview();
        });
    }

    // Tax toggle live preview
    if (poApplyVat) poApplyVat.addEventListener('change', updatePoTaxPreview);
    if (poApplyEwt) poApplyEwt.addEventListener('change', updatePoTaxPreview);

    if (btnClearPo) {
        btnClearPo.addEventListener('click', resetPoFormState);
    }

    if (btnDeletePo) {
        btnDeletePo.addEventListener('click', () => {
            if (currentPoEditIndex !== null && confirm('Are you sure you want to delete this PO?')) {
                poRecords.splice(currentPoEditIndex, 1);
                currentPoEditIndex = null;
                savePoToLocalStorage();
                resetPoFormState();
                renderPoTable();
            }
        });
    }

    if (btnDownloadPoPdf) {
        btnDownloadPoPdf.addEventListener('click', () => {
            const rec = buildPoRecordFromForm();
            if (!rec.poNum || !rec.poDate || !rec.supplier) {
                alert('Please complete the PO Number, PO Date, and Client/Company Name before downloading the PDF.');
                return;
            }
            generatePoPdf(rec);
        });
    }

    if (poMasterForm) {
        poMasterForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const record = buildPoRecordFromForm();

            if (currentPoEditIndex !== null) {
                poRecords[currentPoEditIndex] = record;
                currentPoEditIndex = null;
            } else {
                poRecords.push(record);
            }

            savePoToLocalStorage();
            resetPoFormState();
            renderPoTable();

            // Offer to download the PDF right after saving, so the user
            // doesn't have to look for the PO in the table and press
            // download separately.
            if (confirm('Purchase Order saved. Do you want to download the PDF now?')) {
                generatePoPdf(record);
            }
        });
    }

    if (poTableSearchInput) {
        poTableSearchInput.addEventListener('input', renderPoTable);
    }

    // Ensure at least one item line exists on first load
    if (poItemsContainer && poItemsContainer.children.length === 0) {
        addPoItemLineRow();
    }

    // Attach listeners to the initial item row
    attachPoItemListeners();
}

// RENDER PO MASTER LOG
function renderPoTable() {
    if (!poTableBody) return;
    const searchKey = (poTableSearchInput ? poTableSearchInput.value : '').toLowerCase();
    poTableBody.innerHTML = '';

    const filtered = poRecords
        .map((rec, index) => ({ ...rec, originalIndex: index }))
        .filter(rec =>
            (rec.poNum || '').toLowerCase().includes(searchKey) ||
            (rec.supplier || '').toLowerCase().includes(searchKey) ||
            (rec.contactPerson || '').toLowerCase().includes(searchKey)
        );

    if (filtered.length === 0) {
        poTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                    No PO found.
                </td>
            </tr>
        `;
        return;
    }

    // Group POs by Year and Month based on poDate (YYYY-MM-DD)
    const groupedPo = {};
    filtered.forEach(rec => {
        if (!rec.poDate) return;
        const [year, month] = rec.poDate.split('-');
        if (!year || !month) return;

        if (!groupedPo[year]) groupedPo[year] = {};
        if (!groupedPo[year][month]) groupedPo[year][month] = [];

        groupedPo[year][month].push(rec);
    });

    const years = Object.keys(groupedPo).sort((a, b) => b - a);
    let collapsedPoMonths = JSON.parse(localStorage.getItem('ejay_collapsed_po_months') || '[]');

    years.forEach(year => {
        const months = Object.keys(groupedPo[year]).sort((a, b) => b.localeCompare(a));

        months.forEach(month => {
            const dateObj = new Date(year, month - 1);
            const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            const records = groupedPo[year][month];
            const monthId = `po-${year}-${month}`;
            const isCollapsed = collapsedPoMonths.includes(monthId);

            // Header Row (Folder Toggle)
            const headerRow = document.createElement('tr');
            headerRow.style.background = 'rgba(124, 77, 255, 0.12)';
            headerRow.style.cursor = 'pointer';
            headerRow.style.userSelect = 'none';
            headerRow.innerHTML = `
                <td colspan="8" style="font-weight: 700; color: #fff; padding: 12px 20px; border-left: 4px solid var(--violet-accent);">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <i class="fa-solid ${isCollapsed ? 'fa-folder' : 'fa-folder-open'}" style="color: #F5A623; margin-right: 8px; font-size: 1.1rem;"></i>
                            ${monthLabel} — (${records.length} ${records.length === 1 ? 'Purchase Order' : 'Purchase Orders'})
                        </div>
                        <i class="fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}" style="font-size: 0.85rem; color: var(--text-muted);"></i>
                    </div>
                </td>
            `;

            headerRow.addEventListener('click', () => {
                let currentCollapsed = JSON.parse(localStorage.getItem('ejay_collapsed_po_months') || '[]');
                if (currentCollapsed.includes(monthId)) {
                    currentCollapsed = currentCollapsed.filter(id => id !== monthId);
                } else {
                    currentCollapsed.push(monthId);
                }
                localStorage.setItem('ejay_collapsed_po_months', JSON.stringify(currentCollapsed));
                renderPoTable();
            });

            poTableBody.appendChild(headerRow);

            // Only render the rows if the folder is NOT collapsed
            if (!isCollapsed) {
                records.forEach(rec => {
                    const total = (rec.items || []).reduce((sum, it) => sum + ((it.qty || 0) * (it.price || 0)), 0);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><span style="color:#F5A623; font-weight:600;">${rec.poNum}</span></td>
                        <td>${rec.poDate}</td>
                        <td>${rec.poCompletion}</td>
                        <td style="font-weight:600;">${rec.supplier}</td>
                        <td>${rec.contactPerson}</td>
                        <td>${rec.phone}</td>
                        <td style="font-weight:700;">₱${total.toFixed(2)}</td>
                        <td style="text-align: center;">
                            <div class="action-btns">
                                <button type="button" class="btn-icon btn-edit" onclick="setupPoEditMode(${rec.originalIndex})">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button type="button" class="btn-icon btn-pdf" onclick="downloadSavedPoPdf(${rec.originalIndex})" title="Download PDF">
                                    <i class="fa-solid fa-file-pdf"></i>
                                </button>
                                <button type="button" class="btn-icon btn-delete" onclick="triggerPoDirectDelete(${rec.originalIndex})">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    poTableBody.appendChild(tr);
                });
            }
        });
    });
}

// PO Edit Modal helpers
function addEditPoItemLine(item) {
    const container = document.getElementById('edit-po-items-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'form-grid po-item-row';
    row.style.cssText = 'grid-template-columns: 3fr 1fr 1fr 1fr; margin-bottom: 10px; animation: fadeIn 0.2s ease;';
    row.innerHTML = `
        <div class="input-group"><input type="text" placeholder="Description" class="edit-item-desc" required></div>
        <div class="input-group"><input type="number" placeholder="Qty" class="edit-item-qty" min="1" required></div>
        <div class="input-group"><input type="text" placeholder="Unit" class="edit-item-unit" required></div>
        <div class="input-group"><input type="number" placeholder="Unit Price" class="edit-item-price" step="0.01" required></div>
    `;
    container.appendChild(row);
    if (item) {
        row.querySelector('.edit-item-desc').value = item.desc || '';
        row.querySelector('.edit-item-qty').value = item.qty || '';
        row.querySelector('.edit-item-unit').value = item.unit || '';
        row.querySelector('.edit-item-price').value = item.price || '';
    }
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateEditPoTaxPreview));
    return row;
}

function readEditPoItems() {
    const rows = document.querySelectorAll('#edit-po-items-container .po-item-row');
    const items = [];
    rows.forEach(row => {
        items.push({
            desc: row.querySelector('.edit-item-desc').value,
            qty: parseInt(row.querySelector('.edit-item-qty').value) || 0,
            unit: row.querySelector('.edit-item-unit').value,
            price: parseFloat(row.querySelector('.edit-item-price').value) || 0
        });
    });
    return items;
}

function updateEditPoTaxPreview() {
    const preview = document.getElementById('edit-po-tax-preview');
    if (!preview) return;
    const items = readEditPoItems();
    const applyVat = document.getElementById('edit-po-apply-vat')?.checked || false;
    const applyEwt = document.getElementById('edit-po-apply-ewt')?.checked || false;
    const hasTax = applyVat || applyEwt;
    const tax = computePoTax(items, applyVat, applyEwt);

    if (!hasTax || items.length === 0 || items.every(it => !it.desc && !it.qty && !it.price)) {
        preview.style.display = 'none';
        return;
    }

    preview.style.display = 'block';
    const fmt = (n) => '₱' + n.toLocaleString('en-US', { minimumFractionDigits: 2 });
    preview.innerHTML = `
        <div class="po-tax-preview-card">
            <div class="preview-row"><span class="label">Subtotal</span><span class="value">${fmt(tax.subtotal)}</span></div>
            ${applyVat ? `<div class="preview-row"><span class="label">VAT (12%)</span><span class="value vat-color">+ ${fmt(tax.vat)}</span></div>` : ''}
            ${applyVat ? `<div class="preview-row"><span class="label">Total Amount (Subtotal + VAT)</span><span class="value">${fmt(tax.amountWithVat)}</span></div>` : ''}
            ${applyEwt ? `<div class="preview-row"><span class="label">Less: EWT (2%)</span><span class="value ewt-color">- ${fmt(tax.ewt)}</span></div>` : ''}
            <div class="preview-row total-row"><span>Net Payable</span><span class="value net-color">${fmt(tax.netPayable)}</span></div>
        </div>
    `;
}

window.closePoEditModal = function() {
    const modal = document.getElementById('po-edit-modal');
    if (modal) modal.style.display = 'none';
};

window.setupPoEditMode = function(index) {
    currentPoEditIndex = index;
    const rec = poRecords[index];
    const modal = document.getElementById('po-edit-modal');
    if (!modal) {
        // Fallback inline edit
        poEditIndexId.value = index;
        poNumInput.value = rec.poNum;
        poDateInput.value = rec.poDate;
        poCompletionInput.value = rec.poCompletion;
        poSupplierInput.value = rec.supplier;
        poContactPersonInput.value = rec.contactPerson;
        poPhoneInput.value = rec.phone;
        poItemsContainer.innerHTML = '';
        (rec.items && rec.items.length ? rec.items : [null]).forEach(item => addPoItemLineRow(item));
        if (poApplyVat) poApplyVat.checked = rec.applyVat === true;
        if (poApplyEwt) poApplyEwt.checked = rec.applyEwt === true;
        updatePoTaxPreview();
        attachPoItemListeners();
        btnDeletePo.style.display = 'inline-flex';
        document.getElementById('btn-submit-po').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Update PO`;
        return;
    }

    // Modal-based edit
    document.getElementById('edit-po-index').value = index;
    document.getElementById('edit-po-num').value = rec.poNum;
    document.getElementById('edit-po-date').value = rec.poDate;
    document.getElementById('edit-po-completion').value = rec.poCompletion;
    document.getElementById('edit-po-supplier').value = rec.supplier;
    document.getElementById('edit-po-contact-person').value = rec.contactPerson;
    document.getElementById('edit-po-phone').value = rec.phone;

    const container = document.getElementById('edit-po-items-container');
    container.innerHTML = '';
    (rec.items && rec.items.length ? rec.items : [null]).forEach(item => addEditPoItemLine(item));

    document.getElementById('edit-po-apply-vat').checked = rec.applyVat === true;
    document.getElementById('edit-po-apply-ewt').checked = rec.applyEwt === true;
    updateEditPoTaxPreview();

    document.getElementById('po-edit-modal-title').innerText = `Edit PO — ${rec.poNum}`;
    modal.style.display = 'flex';
};

// PO Edit Modal form events
document.addEventListener('DOMContentLoaded', () => {
    const poEditForm = document.getElementById('po-edit-form');
    if (poEditForm) {
        poEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const index = parseInt(document.getElementById('edit-po-index').value);
            if (isNaN(index) || index < 0) return;

            const items = readEditPoItems();
            const record = {
                poNum: document.getElementById('edit-po-num').value,
                poDate: document.getElementById('edit-po-date').value,
                poCompletion: document.getElementById('edit-po-completion').value,
                supplier: document.getElementById('edit-po-supplier').value,
                contactPerson: document.getElementById('edit-po-contact-person').value,
                phone: document.getElementById('edit-po-phone').value,
                items: items,
                applyVat: document.getElementById('edit-po-apply-vat').checked,
                applyEwt: document.getElementById('edit-po-apply-ewt').checked
            };

            poRecords[index] = record;
            savePoToLocalStorage();
            renderPoTable();
            closePoEditModal();
        });
    }

    const poEditDeleteBtn = document.getElementById('edit-po-btn-delete');
    if (poEditDeleteBtn) {
        poEditDeleteBtn.addEventListener('click', () => {
            const index = parseInt(document.getElementById('edit-po-index').value);
            if (!isNaN(index) && index >= 0) {
                triggerPoDirectDelete(index);
            }
        });
    }

    // VAT/EWT toggle listeners for edit modal
    const editVat = document.getElementById('edit-po-apply-vat');
    const editEwt = document.getElementById('edit-po-apply-ewt');
    if (editVat) editVat.addEventListener('change', updateEditPoTaxPreview);
    if (editEwt) editEwt.addEventListener('change', updateEditPoTaxPreview);
});

window.triggerPoDirectDelete = function(index) {
    if (confirm('Are you sure you want to delete this PO?')) {
        poRecords.splice(index, 1);
        savePoToLocalStorage();
        renderPoTable();
        if (currentPoEditIndex === index) resetPoFormState();
        closePoEditModal();
    }
};

window.downloadSavedPoPdf = function(index) {
    const rec = poRecords[index];
    if (rec) generatePoPdf(rec);
};

// 8. INVENTORY MODULE — DATA LAYER
let materials = [];
let stockMovements = [];

function genId() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function normalizeMaterial(m) {
    return {
        id: m?.id || genId(),
        code: m?.code || '',
        name: m?.name || '',
        category: m?.category || '',
        unit: m?.unit || '',
        stock: parseFloat(m?.stock) || 0,
        reorderLevel: parseFloat(m?.reorderLevel) || 0,
        unitCost: parseFloat(m?.unitCost) || 0,
        dateAdded: m?.dateAdded || new Date().toISOString().slice(0, 10)
    };
}

function normalizeMovement(mv) {
    return {
        id: mv?.id || genId(),
        date: mv?.date || '',
        materialId: mv?.materialId || '',
        materialCode: mv?.materialCode || '',
        materialName: mv?.materialName || '',
        category: mv?.category || '',
        unit: mv?.unit || '',
        type: mv?.type === 'OUT' ? 'OUT' : 'IN',
        qty: parseFloat(mv?.qty) || 0,
        balanceAfter: parseFloat(mv?.balanceAfter) || 0,
        reference: mv?.reference || '',
        remarks: mv?.remarks || '',
        timestamp: mv?.timestamp || Date.now()
    };
}

function saveMaterials() {
    localStorage.setItem('ejay_inventory_materials', JSON.stringify(materials));
}
function saveMovements() {
    localStorage.setItem('ejay_inventory_movements', JSON.stringify(stockMovements));
}

materials = (JSON.parse(localStorage.getItem('ejay_inventory_materials')) || []).map(normalizeMaterial);
stockMovements = (JSON.parse(localStorage.getItem('ejay_inventory_movements')) || []).map(normalizeMovement);
saveMaterials();
saveMovements();

function formatQty(n) {
    const num = parseFloat(n) || 0;
    return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

function getMaterialStatus(mat) {
    if (mat.stock <= 0) return { key: 'out', label: 'Out of Stock', class: 'badge-outstock' };
    if (mat.stock <= mat.reorderLevel) return { key: 'low', label: 'Low Stock', class: 'badge-lowstock' };
    return { key: 'ok', label: 'In Stock', class: 'badge-instock' };
}

// 8a. INVENTORY MODULE — MASTER INIT
function initInventoryModule() {
    if (!document.getElementById('inventory-view')) return;

    initSubtabNav();
    initMaterialFormEvents();
    initMovementFormEvents();
    initHistoryFilterEvents();

    populateMaterialSelects();
    renderMaterialsTable();
    renderInventorySummary();
    renderRecentMovements();
    renderMovementHistory();
    updateStockPreview();
}

function initSubtabNav() {
    document.querySelectorAll('.subtab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.subtab;
            document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.subtab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`subtab-${target}`).classList.add('active');
        });
    });
}

// 8b. MATERIALS MANAGEMENT
function initMaterialFormEvents() {
    const materialForm = document.getElementById('material-form');

    materialForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const editId = document.getElementById('material-edit-id').value;
        const code = document.getElementById('mat-code').value.trim();
        const name = document.getElementById('mat-name').value.trim();
        const category = document.getElementById('mat-category').value.trim();
        const unit = document.getElementById('mat-unit').value.trim();
        const opening = parseFloat(document.getElementById('mat-opening-stock').value) || 0;
        const reorder = parseFloat(document.getElementById('mat-reorder').value) || 0;
        const cost = parseFloat(document.getElementById('mat-cost').value) || 0;

        const dupCode = materials.find(m => m.code.toLowerCase() === code.toLowerCase() && m.id !== editId);
        if (dupCode) {
            alert('A material with this code already exists. Please use a unique code.');
            return;
        }

        if (editId) {
            const mat = materials.find(m => m.id === editId);
            if (mat) {
                mat.code = code;
                mat.name = name;
                mat.category = category;
                mat.unit = unit;
                mat.reorderLevel = reorder;
                mat.unitCost = cost;
                // Current stock is intentionally not overwritten here — it only changes via Stock In/Out movements.
            }
        } else {
            const newMat = normalizeMaterial({
                code, name, category, unit, stock: opening, reorderLevel: reorder, unitCost: cost,
                dateAdded: new Date().toISOString().slice(0, 10)
            });
            materials.push(newMat);

            if (opening > 0) {
                const openingMovement = normalizeMovement({
                    date: newMat.dateAdded,
                    materialId: newMat.id,
                    materialCode: newMat.code,
                    materialName: newMat.name,
                    category: newMat.category,
                    unit: newMat.unit,
                    type: 'IN',
                    qty: opening,
                    balanceAfter: opening,
                    reference: 'Opening Balance',
                    remarks: 'Initial stock recorded on material creation',
                    timestamp: Date.now()
                });
                stockMovements.push(openingMovement);
                saveMovements();
            }
        }

        saveMaterials();
        resetMaterialForm();
        renderMaterialsTable();
        renderInventorySummary();
        populateMaterialSelects();
        renderRecentMovements();
        renderMovementHistory();
    });

    document.getElementById('btn-clear-material').addEventListener('click', resetMaterialForm);

    document.getElementById('btn-delete-material').addEventListener('click', () => {
        const editId = document.getElementById('material-edit-id').value;
        if (!editId) return;
        if (confirm('Delete this material? Its past transaction history will be preserved for your records, but it will no longer be available for new stock movements.')) {
            materials = materials.filter(m => m.id !== editId);
            saveMaterials();
            resetMaterialForm();
            renderMaterialsTable();
            renderInventorySummary();
            populateMaterialSelects();
            renderMovementHistory();
        }
    });

    document.getElementById('material-search-input').addEventListener('input', renderMaterialsTable);
}

function resetMaterialForm() {
    const materialForm = document.getElementById('material-form');
    materialForm.reset();
    document.getElementById('material-edit-id').value = '';

    const openingInput = document.getElementById('mat-opening-stock');
    openingInput.disabled = false;
    openingInput.previousElementSibling.innerText = 'Opening Stock';

    document.getElementById('btn-delete-material').style.display = 'none';
    document.getElementById('btn-submit-material').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Material`;
}

window.setupMaterialEditMode = function(id) {
    const mat = materials.find(m => m.id === id);
    if (!mat) return;

    document.getElementById('material-edit-id').value = mat.id;
    document.getElementById('mat-code').value = mat.code;
    document.getElementById('mat-name').value = mat.name;
    document.getElementById('mat-category').value = mat.category;
    document.getElementById('mat-unit').value = mat.unit;

    const openingInput = document.getElementById('mat-opening-stock');
    openingInput.value = mat.stock;
    openingInput.disabled = true;
    openingInput.previousElementSibling.innerText = 'Current Stock (adjust via Stock In / Out)';

    document.getElementById('mat-reorder').value = mat.reorderLevel;
    document.getElementById('mat-cost').value = mat.unitCost;

    document.getElementById('btn-delete-material').style.display = 'inline-flex';
    document.getElementById('btn-submit-material').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Update Material`;

    document.querySelector('.subtab-btn[data-subtab="materials"]').click();
    document.getElementById('material-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.triggerMaterialDelete = function(id) {
    if (confirm('Delete this material? Its past transaction history will be preserved for your records, but it will no longer be available for new stock movements.')) {
        const wasEditing = document.getElementById('material-edit-id').value === id;
        materials = materials.filter(m => m.id !== id);
        saveMaterials();
        renderMaterialsTable();
        renderInventorySummary();
        populateMaterialSelects();
        renderMovementHistory();
        if (wasEditing) resetMaterialForm();
    }
};

function renderMaterialsTable() {
    const tbody = document.getElementById('materials-table-body');
    if (!tbody) return;
    const searchKey = (document.getElementById('material-search-input').value || '').toLowerCase();
    tbody.innerHTML = '';

    const filtered = materials.filter(m =>
        m.code.toLowerCase().includes(searchKey) ||
        m.name.toLowerCase().includes(searchKey) ||
        m.category.toLowerCase().includes(searchKey)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">
                    <i class="fa-solid fa-box-open" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                    No materials found. Add your first material above.
                </td>
            </tr>
        `;
        return;
    }

    filtered.sort((a, b) => a.name.localeCompare(b.name)).forEach(mat => {
        const status = getMaterialStatus(mat);
        const tr = document.createElement('tr');
        if (status.key === 'out') tr.classList.add('out-stock-row');
        else if (status.key === 'low') tr.classList.add('low-stock-row');

        tr.innerHTML = `
            <td style="font-weight:700; color:#F5A623;">${mat.code}</td>
            <td style="font-weight:600;">${mat.name}</td>
            <td>${mat.category}</td>
            <td>${mat.unit}</td>
            <td style="font-weight:700;">${formatQty(mat.stock)}</td>
            <td>${formatQty(mat.reorderLevel)}</td>
            <td>₱${mat.unitCost.toFixed(2)}</td>
            <td><span class="badge ${status.class}">${status.label}</span></td>
            <td style="text-align: center;">
                <div class="action-btns">
                    <button type="button" class="btn-icon btn-edit" onclick="setupMaterialEditMode('${mat.id}')">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" class="btn-icon btn-delete" onclick="triggerMaterialDelete('${mat.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderInventorySummary() {
    const grid = document.getElementById('inv-summary-grid');
    if (!grid) return;

    const totalMaterials = materials.length;
    const lowStock = materials.filter(m => m.stock > 0 && m.stock <= m.reorderLevel).length;
    const outStock = materials.filter(m => m.stock <= 0).length;
    const totalValue = materials.reduce((sum, m) => sum + (m.stock * m.unitCost), 0);

    grid.innerHTML = `
        <div class="glass-card inv-metric-card card-inv-materials">
            <div class="metric-title"><i class="fa-solid fa-cubes"></i> Total Materials</div>
            <div class="metric-value">${totalMaterials}</div>
        </div>
        <div class="glass-card inv-metric-card card-inv-low">
            <div class="metric-title"><i class="fa-solid fa-triangle-exclamation"></i> Low Stock Alerts</div>
            <div class="metric-value">${lowStock}</div>
        </div>
        <div class="glass-card inv-metric-card card-inv-out">
            <div class="metric-title"><i class="fa-solid fa-circle-xmark"></i> Out of Stock</div>
            <div class="metric-value">${outStock}</div>
        </div>
        <div class="glass-card inv-metric-card card-inv-value">
            <div class="metric-title"><i class="fa-solid fa-sack-dollar"></i> Total Stock Value</div>
            <div class="metric-value">₱${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
    `;
}

function populateMaterialSelects() {
    const mvSelect = document.getElementById('mv-material');
    const histSelect = document.getElementById('hist-filter-material');
    if (!mvSelect || !histSelect) return;

    const currentMv = mvSelect.value;
    const currentHist = histSelect.value;
    const sorted = [...materials].sort((a, b) => a.name.localeCompare(b.name));

    mvSelect.innerHTML = `<option value="">-- Select Material --</option>` +
        sorted.map(m => `<option value="${m.id}">${m.code} — ${m.name} (${formatQty(m.stock)} ${m.unit} available)</option>`).join('');

    histSelect.innerHTML = `<option value="">All Materials</option>` +
        sorted.map(m => `<option value="${m.id}">${m.code} — ${m.name}</option>`).join('');

    if (sorted.some(m => m.id === currentMv)) mvSelect.value = currentMv;
    if (sorted.some(m => m.id === currentHist)) histSelect.value = currentHist;
}

// 8c. STOCK IN / STOCK OUT MOVEMENTS
function initMovementFormEvents() {
    const movementForm = document.getElementById('movement-form');
    document.getElementById('mv-date').value = new Date().toISOString().slice(0, 10);

    document.getElementById('mv-material').addEventListener('change', updateStockPreview);
    document.getElementById('mv-type').addEventListener('change', updateStockPreview);
    document.getElementById('mv-qty').addEventListener('input', updateStockPreview);

    movementForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const matId = document.getElementById('mv-material').value;
        const type = document.getElementById('mv-type').value;
        const qty = parseFloat(document.getElementById('mv-qty').value) || 0;
        const date = document.getElementById('mv-date').value;
        const reference = document.getElementById('mv-reference').value.trim();
        const remarks = document.getElementById('mv-remarks').value.trim();

        const mat = materials.find(m => m.id === matId);
        if (!mat) { alert('Please select a valid material.'); return; }
        if (qty <= 0) { alert('Quantity must be greater than zero.'); return; }
        if (type === 'OUT' && qty > mat.stock) {
            alert(`Insufficient stock. Available: ${formatQty(mat.stock)} ${mat.unit}`);
            return;
        }

        mat.stock = type === 'IN' ? mat.stock + qty : mat.stock - qty;
        saveMaterials();

        const movement = normalizeMovement({
            date, materialId: mat.id, materialCode: mat.code, materialName: mat.name,
            category: mat.category, unit: mat.unit, type, qty, balanceAfter: mat.stock,
            reference, remarks, timestamp: Date.now()
        });
        stockMovements.push(movement);
        saveMovements();

        movementForm.reset();
        document.getElementById('mv-date').value = new Date().toISOString().slice(0, 10);

        renderMaterialsTable();
        renderInventorySummary();
        populateMaterialSelects();
        renderRecentMovements();
        renderMovementHistory();
        updateStockPreview();
    });

    document.getElementById('btn-clear-movement').addEventListener('click', () => {
        movementForm.reset();
        document.getElementById('mv-date').value = new Date().toISOString().slice(0, 10);
        updateStockPreview();
    });
}

function updateStockPreview() {
    const preview = document.getElementById('mv-stock-preview');
    if (!preview) return;

    const matId = document.getElementById('mv-material').value;
    const type = document.getElementById('mv-type').value;
    const qty = parseFloat(document.getElementById('mv-qty').value) || 0;

    preview.classList.remove('state-ok', 'state-low', 'state-error');

    const mat = materials.find(m => m.id === matId);
    if (!mat) {
        preview.innerHTML = `<i class="fa-solid fa-circle-info"></i> Select a material to view its current stock level.`;
        return;
    }

    if (type === 'OUT' && qty > mat.stock) {
        preview.classList.add('state-error');
        preview.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Insufficient stock. Current: <strong>${formatQty(mat.stock)} ${mat.unit}</strong>. Cannot release ${formatQty(qty)} ${mat.unit}.`;
        return;
    }

    const projected = type === 'IN' ? mat.stock + qty : mat.stock - qty;
    let stateClass = 'state-ok';
    if (projected <= mat.reorderLevel) stateClass = 'state-low';
    if (projected <= 0) stateClass = 'state-error';
    preview.classList.add(stateClass);
    preview.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> Current Stock: <strong>${formatQty(mat.stock)} ${mat.unit}</strong> &nbsp;→&nbsp; Balance After: <strong>${formatQty(projected)} ${mat.unit}</strong>`;
}

function renderRecentMovements() {
    const tbody = document.getElementById('recent-movements-body');
    if (!tbody) return;

    const recent = [...stockMovements].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);

    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">No stock movements recorded yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = recent.map(mv => `
        <tr>
            <td>${mv.date}</td>
            <td style="font-weight:600;">${mv.materialCode} — ${mv.materialName}</td>
            <td><span class="badge ${mv.type === 'IN' ? 'badge-in' : 'badge-out'}">${mv.type === 'IN' ? 'Stock In' : 'Stock Out'}</span></td>
            <td>${mv.type === 'IN' ? '+' : '-'}${formatQty(mv.qty)} ${mv.unit}</td>
            <td style="font-weight:700;">${formatQty(mv.balanceAfter)} ${mv.unit}</td>
            <td>${mv.reference || '—'}</td>
        </tr>
    `).join('');
}

// 8d. TRANSACTION HISTORY
function initHistoryFilterEvents() {
    document.getElementById('history-search-input').addEventListener('input', renderMovementHistory);
    document.getElementById('hist-filter-material').addEventListener('change', renderMovementHistory);
    document.getElementById('hist-filter-type').addEventListener('change', renderMovementHistory);
    document.getElementById('hist-filter-from').addEventListener('change', renderMovementHistory);
    document.getElementById('hist-filter-to').addEventListener('change', renderMovementHistory);

    document.getElementById('btn-reset-history-filter').addEventListener('click', () => {
        document.getElementById('history-search-input').value = '';
        document.getElementById('hist-filter-material').value = '';
        document.getElementById('hist-filter-type').value = '';
        document.getElementById('hist-filter-from').value = '';
        document.getElementById('hist-filter-to').value = '';
        renderMovementHistory();
    });

    document.getElementById('btn-export-inventory-pdf').addEventListener('click', exportInventoryPdf);
}

function getFilteredHistory() {
    const searchKey = (document.getElementById('history-search-input').value || '').toLowerCase();
    const matFilter = document.getElementById('hist-filter-material').value;
    const typeFilter = document.getElementById('hist-filter-type').value;
    const fromDate = document.getElementById('hist-filter-from').value;
    const toDate = document.getElementById('hist-filter-to').value;

    return stockMovements.filter(mv => {
        if (matFilter && mv.materialId !== matFilter) return false;
        if (typeFilter && mv.type !== typeFilter) return false;
        if (fromDate && mv.date < fromDate) return false;
        if (toDate && mv.date > toDate) return false;
        if (searchKey && !(
            mv.materialName.toLowerCase().includes(searchKey) ||
            mv.materialCode.toLowerCase().includes(searchKey) ||
            (mv.reference || '').toLowerCase().includes(searchKey)
        )) return false;
        return true;
    });
}

function renderMovementHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = getFilteredHistory();

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                    No stock movement records found.
                </td>
            </tr>
        `;
        return;
    }

    const grouped = {};
    filtered.forEach(mv => {
        if (!mv.date) return;
        const [year, month] = mv.date.split('-');
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];
        grouped[year][month].push(mv);
    });

    const years = Object.keys(grouped).sort((a, b) => b - a);
    years.forEach(year => {
        const months = Object.keys(grouped[year]).sort((a, b) => b.localeCompare(a));
        months.forEach(month => {
            const dateObj = new Date(year, month - 1);
            const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            const records = grouped[year][month].sort((a, b) => b.timestamp - a.timestamp);

            const headerRow = document.createElement('tr');
            headerRow.style.background = 'rgba(124, 77, 255, 0.08)';
            headerRow.innerHTML = `
                <td colspan="8" style="font-weight: 700; color: #fff; padding: 12px 20px; border-left: 4px solid var(--violet-accent);">
                    <i class="fa-regular fa-calendar-check" style="color: var(--violet-accent); margin-right: 8px;"></i>
                    ${monthLabel} — (${records.length} movement${records.length !== 1 ? 's' : ''})
                </td>
            `;
            tbody.appendChild(headerRow);

            records.forEach(mv => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${mv.date}</td>
                    <td style="font-weight:600;">${mv.materialName}</td>
                    <td>${mv.category}</td>
                    <td><span class="badge ${mv.type === 'IN' ? 'badge-in' : 'badge-out'}">${mv.type === 'IN' ? 'Stock In' : 'Stock Out'}</span></td>
                    <td>${mv.type === 'IN' ? '+' : '-'}${formatQty(mv.qty)} ${mv.unit}</td>
                    <td style="font-weight:700;">${formatQty(mv.balanceAfter)} ${mv.unit}</td>
                    <td><span style="color:#F5A623; font-weight:600;">${mv.reference || '—'}</span></td>
                    <td>${mv.remarks || '—'}</td>
                `;
                tbody.appendChild(tr);
            });
        });
    });
}

// 8e. INVENTORY PDF REPORT EXPORT (matches Monthly Report / PO PDF styling)
function exportInventoryPdf() {
    const filtered = getFilteredHistory().sort((a, b) => a.timestamp - b.timestamp);

    const fromDate = document.getElementById('hist-filter-from').value;
    const toDate = document.getElementById('hist-filter-to').value;
    const coverageText = (fromDate || toDate)
        ? `${fromDate || 'Start'} to ${toDate || 'Present'}`
        : 'All Records';

    document.getElementById('pdf-inv-generation-timestamp').innerText = new Date().toLocaleString('en-US');
    document.getElementById('pdf-inv-coverage').innerText = coverageText;

    let totalIn = 0, totalOut = 0;
    const movementRowsHtml = filtered.map(mv => {
        if (mv.type === 'IN') totalIn += mv.qty; else totalOut += mv.qty;
        return `
            <tr>
                <td>${mv.date}</td>
                <td style="font-weight:700; color:#111827;">${mv.materialCode} — ${mv.materialName}</td>
                <td>${mv.category}</td>
                <td style="text-align:center; font-weight:800; color: ${mv.type === 'IN' ? '#10b981' : '#ef4444'}">${mv.type === 'IN' ? 'STOCK IN' : 'STOCK OUT'}</td>
                <td class="num-col">${mv.type === 'IN' ? '+' : '-'}${formatQty(mv.qty)} ${mv.unit}</td>
                <td class="num-col">${formatQty(mv.balanceAfter)} ${mv.unit}</td>
                <td>${mv.reference || '—'}</td>
                <td>${mv.remarks || '—'}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('pdf-inv-movement-rows').innerHTML = movementRowsHtml ||
        `<tr><td colspan="8" style="text-align:center; padding: 20px; color:#6b7280;">No movement records for the selected filters.</td></tr>`;

    const sortedMaterials = [...materials].sort((a, b) => a.name.localeCompare(b.name));
    const stockRowsHtml = sortedMaterials.map(mat => {
        const status = getMaterialStatus(mat);
        const statusColor = status.key === 'out' ? '#ef4444' : status.key === 'low' ? '#F5A623' : '#10b981';
        return `
            <tr>
                <td style="font-weight:700; color:#2F3192;">${mat.code}</td>
                <td style="font-weight:600;">${mat.name}</td>
                <td>${mat.category}</td>
                <td style="text-align:center;">${mat.unit}</td>
                <td class="num-col">${formatQty(mat.stock)}</td>
                <td class="num-col">${formatQty(mat.reorderLevel)}</td>
                <td style="text-align:center; font-weight:800; color: ${statusColor}">${status.label}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('pdf-inv-stock-rows').innerHTML = stockRowsHtml ||
        `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#6b7280;">No materials on record.</td></tr>`;

    const lowStockCount = materials.filter(m => m.stock > 0 && m.stock <= m.reorderLevel).length;
    const totalValue = materials.reduce((sum, m) => sum + (m.stock * m.unitCost), 0);

    document.getElementById('pdf-inv-total-materials').innerText = materials.length;
    document.getElementById('pdf-inv-total-in').innerText = formatQty(totalIn);
    document.getElementById('pdf-inv-total-out').innerText = formatQty(totalOut);
    document.getElementById('pdf-inv-low-stock').innerText = lowStockCount;
    document.getElementById('pdf-inv-stock-value').innerText = `₱${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const element = document.getElementById('printable-inventory-area');
    element.classList.add('pdf-landscape-context');
    element.style.display = 'block';

    const pdfOptions = {
        margin:       0, // Margins are handled perfectly by our CSS padding
        filename:     `EJAY_Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, width: 1122 },
        jsPDF:        { unit: 'px', hotfixes: ['px_scaling'], format: [1122, 794], orientation: 'landscape' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(pdfOptions).from(element).save().then(() => {
        element.style.display = 'none';
        element.classList.remove('pdf-landscape-context');
    }).catch(err => {
        console.error(err);
        element.style.display = 'none';
        element.classList.remove('pdf-landscape-context');
    });
}

// =====================================================================
// 9. EXPENSES MODULE
// =====================================================================
let expenseRecords = [];
let currentExpenseEditIndex = null;

function normalizeExpenseRecord(rec) {
    return {
        date: rec?.date || '',
        category: rec?.category === 'Other Expenses' ? 'Other Expenses' : 'Non-Vat',
        orNum: rec?.orNum || '',
        tin: rec?.tin || '',
        gross: parseFloat(rec?.gross) || 0,
        remarks: rec?.remarks || ''
    };
}

function saveExpensesToLocalStorage() {
    localStorage.setItem('ejay_expenses_data', JSON.stringify(expenseRecords));
}

expenseRecords = (JSON.parse(localStorage.getItem('ejay_expenses_data')) || []).map(normalizeExpenseRecord);
saveExpensesToLocalStorage();

// DOM ELEMENTS - EXPENSE FORM
const expenseMasterForm = document.getElementById('expense-master-form');
const expEditId = document.getElementById('exp-edit-id');
const expDate = document.getElementById('exp-date');
const expCategory = document.getElementById('exp-category');
const expOrNum = document.getElementById('exp-or-num');
const expTin = document.getElementById('exp-tin');
const expGross = document.getElementById('exp-gross');
const expRemarks = document.getElementById('exp-remarks');
const expReceiptHint = document.getElementById('exp-receipt-hint');
const btnClearExpense = document.getElementById('btn-clear-expense');
const btnDeleteExpense = document.getElementById('btn-delete-expense');
const expensesTableBody = document.getElementById('expenses-table-body');
const expenseSearchInput = document.getElementById('expense-search-input');

function initExpenseModule() {
    if (!document.getElementById('expenses-view')) return;

    initExpenseFormEvents();
    initExpenseEditFormEvent();
    initExpenseReportEvents();
    updateExpenseReceiptRequirement();
}

// Toggle OR#/TIN# requirement based on Category ("Other Expenses" = walang resibo)
function updateExpenseReceiptRequirement() {
    const isOtherExpenses = expCategory.value === 'Other Expenses';
    expOrNum.required = !isOtherExpenses;
    expTin.required = !isOtherExpenses;
    expReceiptHint.style.display = isOtherExpenses ? 'block' : 'none';
    if (isOtherExpenses) {
        expOrNum.placeholder = 'N/A (No Receipt)';
        expTin.placeholder = 'N/A (No Receipt)';
    } else {
        expOrNum.placeholder = 'e.g. OR-00123';
        expTin.placeholder = 'e.g. 123-456-789-000';
    }
}

function initExpenseFormEvents() {
    expCategory.addEventListener('change', updateExpenseReceiptRequirement);

    expenseMasterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const record = {
            date: expDate.value,
            category: expCategory.value,
            orNum: expOrNum.value.trim(),
            tin: expTin.value.trim(),
            gross: parseFloat(expGross.value) || 0,
            remarks: expRemarks.value.trim()
        };

        if (currentExpenseEditIndex !== null) {
            expenseRecords[currentExpenseEditIndex] = record;
        } else {
            expenseRecords.push(record);
        }

        saveExpensesToLocalStorage();
        renderExpensesTable();
        resetExpenseFormState();
    });

    btnClearExpense.addEventListener('click', resetExpenseFormState);

    btnDeleteExpense.addEventListener('click', () => {
        if (currentExpenseEditIndex !== null) {
            triggerExpenseDelete(currentExpenseEditIndex);
        }
    });

    expenseSearchInput.addEventListener('input', renderExpensesTable);
}

function resetExpenseFormState() {
    currentExpenseEditIndex = null;
    expenseMasterForm.reset();
    expEditId.value = '';
    expCategory.value = 'Non-Vat';
    updateExpenseReceiptRequirement();
    btnDeleteExpense.style.display = 'none';
    document.getElementById('btn-submit-expense').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Expense`;
}

window.closeExpenseEditModal = function() {
    const modal = document.getElementById('expense-edit-modal');
    if (modal) modal.style.display = 'none';
};

window.setupExpenseEditMode = function(index) {
    currentExpenseEditIndex = index;
    const rec = expenseRecords[index];
    const modal = document.getElementById('expense-edit-modal');
    
    if (!modal) {
        // Fallback inline edit
        expDate.value = rec.date;
        expCategory.value = rec.category;
        expOrNum.value = rec.orNum;
        expTin.value = rec.tin;
        expGross.value = rec.gross;
        expRemarks.value = rec.remarks;
        updateExpenseReceiptRequirement();
        btnDeleteExpense.style.display = 'inline-flex';
        document.getElementById('btn-submit-expense').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Update Expense`;
        return;
    }

    // Modal-based edit
    document.getElementById('edit-exp-index-id').value = index;
    document.getElementById('edit-exp-date').value = rec.date;
    document.getElementById('edit-exp-category').value = rec.category;
    document.getElementById('edit-exp-ornum').value = rec.orNum;
    document.getElementById('edit-exp-tin').value = rec.tin;
    document.getElementById('edit-exp-gross').value = rec.gross;
    document.getElementById('edit-exp-remarks').value = rec.remarks;

    // Toggle OR#/TIN# requirement in modal
    const editCategory = document.getElementById('edit-exp-category');
    const editOrNum = document.getElementById('edit-exp-ornum');
    const editTin = document.getElementById('edit-exp-tin');
    const editHint = document.getElementById('edit-exp-receipt-hint');

    function updateEditExpenseReceiptRequirement() {
        const isOtherExpenses = editCategory.value === 'Other Expenses';
        editOrNum.required = !isOtherExpenses;
        editTin.required = !isOtherExpenses;
        editHint.style.display = isOtherExpenses ? 'block' : 'none';
        if (isOtherExpenses) {
            editOrNum.placeholder = 'N/A (No Receipt)';
            editTin.placeholder = 'N/A (No Receipt)';
        } else {
            editOrNum.placeholder = 'e.g. OR-00123';
            editTin.placeholder = 'e.g. 123-456-789-000';
        }
    }

    editCategory.removeEventListener('change', updateEditExpenseReceiptRequirement);
    editCategory.addEventListener('change', updateEditExpenseReceiptRequirement);
    updateEditExpenseReceiptRequirement();

    modal.style.display = 'flex';
};

// Attach submit listener to the edit form in modal
function initExpenseEditFormEvent() {
    const editForm = document.getElementById('expense-edit-form');
    if (!editForm) return;

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const idx = parseInt(document.getElementById('edit-exp-index-id').value, 10);
        if (isNaN(idx)) return;

        expenseRecords[idx] = {
            date: document.getElementById('edit-exp-date').value,
            category: document.getElementById('edit-exp-category').value,
            orNum: document.getElementById('edit-exp-ornum').value.trim(),
            tin: document.getElementById('edit-exp-tin').value.trim(),
            gross: parseFloat(document.getElementById('edit-exp-gross').value) || 0,
            remarks: document.getElementById('edit-exp-remarks').value.trim()
        };

        saveExpensesToLocalStorage();
        renderExpensesTable();
        closeExpenseEditModal();
    });
}

window.triggerExpenseDelete = function(index) {
    if (confirm('Are you sure you want to delete this expense record?')) {
        expenseRecords.splice(index, 1);
        saveExpensesToLocalStorage();
        renderExpensesTable();
        if (currentExpenseEditIndex === index) resetExpenseFormState();
        closeExpenseEditModal();
    }
};

function renderExpensesTable() {
    if (!expensesTableBody) return;
    const searchKey = (expenseSearchInput.value || '').toLowerCase();
    expensesTableBody.innerHTML = '';

    const filtered = expenseRecords
        .map((rec, index) => ({ ...rec, originalIndex: index }))
        .filter(rec =>
            rec.orNum.toLowerCase().includes(searchKey) ||
            rec.tin.toLowerCase().includes(searchKey) ||
            rec.remarks.toLowerCase().includes(searchKey)
        );

    if (filtered.length === 0) {
        expensesTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                    No expense records found.
                </td>
            </tr>
        `;
        return;
    }

    // Group Expenses by Year and Month based on date (YYYY-MM-DD)
    const groupedExpenses = {};
    filtered.forEach(rec => {
        if (!rec.date) return;
        const [year, month] = rec.date.split('-');
        if (!year || !month) return;

        if (!groupedExpenses[year]) groupedExpenses[year] = {};
        if (!groupedExpenses[year][month]) groupedExpenses[year][month] = [];

        groupedExpenses[year][month].push(rec);
    });

    const years = Object.keys(groupedExpenses).sort((a, b) => b - a);
    let collapsedExpenseMonths = JSON.parse(localStorage.getItem('ejay_collapsed_expense_months') || '[]');

    years.forEach(year => {
        const months = Object.keys(groupedExpenses[year]).sort((a, b) => b.localeCompare(a));

        months.forEach(month => {
            const dateObj = new Date(year, month - 1);
            const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            const records = groupedExpenses[year][month].sort((a, b) => b.date.localeCompare(a.date));
            const monthId = `expense-${year}-${month}`;
            const isCollapsed = collapsedExpenseMonths.includes(monthId);

            // Header Row (Folder Toggle)
            const headerRow = document.createElement('tr');
            headerRow.style.background = 'rgba(124, 77, 255, 0.12)';
            headerRow.style.cursor = 'pointer';
            headerRow.style.userSelect = 'none';
            headerRow.innerHTML = `
                <td colspan="7" style="font-weight: 700; color: #fff; padding: 12px 20px; border-left: 4px solid var(--violet-accent);">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <i class="fa-solid ${isCollapsed ? 'fa-folder' : 'fa-folder-open'}" style="color: #F5A623; margin-right: 8px; font-size: 1.1rem;"></i>
                            ${monthLabel} — (${records.length} ${records.length === 1 ? 'expense record' : 'expense records'})
                        </div>
                        <i class="fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}" style="font-size: 0.85rem; color: var(--text-muted);"></i>
                    </div>
                </td>
            `;

            headerRow.addEventListener('click', () => {
                let currentCollapsed = JSON.parse(localStorage.getItem('ejay_collapsed_expense_months') || '[]');
                if (currentCollapsed.includes(monthId)) {
                    currentCollapsed = currentCollapsed.filter(id => id !== monthId);
                } else {
                    currentCollapsed.push(monthId);
                }
                localStorage.setItem('ejay_collapsed_expense_months', JSON.stringify(currentCollapsed));
                renderExpensesTable();
            });

            expensesTableBody.appendChild(headerRow);

            // Only render the rows if the folder is NOT collapsed
            if (!isCollapsed) {
                records.forEach(rec => {
                    const tr = document.createElement('tr');
                    const isOther = rec.category === 'Other Expenses';
                    tr.innerHTML = `
                        <td>${rec.date}</td>
                        <td><span class="badge ${isOther ? 'badge-noreceipt' : 'badge-nonvat'}">${isOther ? 'Other Expenses' : 'Non-Vat'}</span></td>
                        <td>${rec.orNum || '—'}</td>
                        <td>${rec.tin || '—'}</td>
                        <td style="font-weight:700;">₱${rec.gross.toFixed(2)}</td>
                        <td>${rec.remarks || '—'}</td>
                        <td style="text-align: center;">
                            <div class="action-btns">
                                <button type="button" class="btn-icon btn-edit" onclick="setupExpenseEditMode(${rec.originalIndex})">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button type="button" class="btn-icon btn-delete" onclick="triggerExpenseDelete(${rec.originalIndex})">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    expensesTableBody.appendChild(tr);
                });
            }
        });
    });
}

// EXPENSES PDF REPORT EXPORT (matches Monthly Report / PO / Inventory styling)
function initExpenseReportEvents() {
    document.getElementById('btn-export-expenses-pdf').addEventListener('click', exportExpensesPdf);
}

function exportExpensesPdf() {
    const targetMonth = expenseMonthPicker.value;
    let filtered = expenseRecords;
    let periodLabel = 'All Records';

    if (targetMonth) {
        const [year, month] = targetMonth.split('-');
        const dateObj = new Date(year, month - 1);
        periodLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        filtered = expenseRecords.filter(rec => rec.date && rec.date.startsWith(targetMonth));
    }

    filtered = [...filtered].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    document.getElementById('pdf-exp-generation-timestamp').innerText = new Date().toLocaleString('en-US');
    document.getElementById('pdf-exp-target-month').innerText = periodLabel;

    let totalGross = 0, totalNonVat = 0, totalOther = 0;
    const rowsHtml = filtered.map(rec => {
        const isOther = rec.category === 'Other Expenses';
        totalGross += rec.gross;
        if (isOther) totalOther += rec.gross; else totalNonVat += rec.gross;

        return `
            <tr>
                <td>${rec.date}</td>
                <td style="font-weight:700; color: ${isOther ? '#F5A623' : '#3b82f6'};">${isOther ? 'Other Expenses' : 'Non-Vat'}</td>
                <td>${rec.orNum || '—'}</td>
                <td>${rec.tin || '—'}</td>
                <td class="num-col">₱${rec.gross.toFixed(2)}</td>
                <td>${rec.remarks || '—'}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('pdf-exp-rows-container').innerHTML = rowsHtml ||
        `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#6b7280;">No expense records for the selected period.</td></tr>`;

    document.getElementById('pdf-exp-total-gross').innerText = `₱${totalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('pdf-exp-total-nonvat').innerText = `₱${totalNonVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('pdf-exp-total-other').innerText = `₱${totalOther.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('pdf-exp-total-tx').innerText = filtered.length;

    const element = document.getElementById('printable-expenses-area');
    element.classList.add('pdf-landscape-context');
    element.style.display = 'block';

    const pdfOptions = {
        margin:       0, // Margins are handled perfectly by our CSS padding
        filename:     `EJAY_Expenses_Report_${periodLabel.replace(/ /g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, width: 1122 },
        jsPDF:        { unit: 'px', hotfixes: ['px_scaling'], format: [1122, 794], orientation: 'landscape' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(pdfOptions).from(element).save().then(() => {
        element.style.display = 'none';
        element.classList.remove('pdf-landscape-context');
    }).catch(err => {
        console.error(err);
        element.style.display = 'none';
        element.classList.remove('pdf-landscape-context');
    });
}



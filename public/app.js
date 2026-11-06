let products = JSON.parse(localStorage.getItem('arabbika_products')) || [];
let currentCalculation = null;
let currentSaleProductIndex = null;
let currentPaymentStatus = 'paid';

// --- TAB SWITCHING ---
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabId + '-tab').style.display = 'block';
  document.getElementById('nav-' + tabId).classList.add('active');

  const title = document.getElementById('page-title');
  if (tabId === 'calculator') title.textContent = 'Price Calculator';
  if (tabId === 'products') { title.textContent = 'My Inventory'; renderProducts(); }
  if (tabId === 'dashboard') { title.textContent = 'Business Dashboard'; renderDashboard(); }
}

function showToast(message) {
  const toast = document.getElementById('toast-container');
  document.getElementById('toast-message').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- DASHBOARD & DEBT LOGIC ---
function renderDashboard() {
  let totalProfit = 0;
  let totalOwed = 0;
  let totalStockValue = 0;
  const debtList = document.getElementById('debt-list');
  debtList.innerHTML = '';
  let hasDebts = false;

  products.forEach(p => {
    // Profit from paid sales only
    totalProfit += (p.sellingPrice - p.trueCost) * (p.soldPaid || 0);
    
    // Stock value (remaining stock * wholesale cost)
    const remainingStock = Math.max(0, (p.unitsBought || 1) - (p.sold || 0));
    totalStockValue += remainingStock * p.wholesaleCost;

    // Debts
    if (p.debts && p.debts.length > 0) {
      p.debts.forEach(debt => {
        hasDebts = true;
        totalOwed += debt.amount;
        
        const div = document.createElement('div');
        div.className = 'debt-item';
        div.innerHTML = `
          <div class="debt-info">
            <h4>${escapeHTML(debt.customerName)}</h4>
            <p>for ${debt.quantity}x ${escapeHTML(p.name)}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span class="debt-amount">R${debt.amount.toFixed(2)}</span>
            <button onclick="remindDebt('${debt.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;">Remind</button>
          </div>
        `;
        debtList.appendChild(div);
      });
    }
  });

  document.getElementById('total-profit').textContent = totalProfit.toFixed(2);
  document.getElementById('total-owed').textContent = totalOwed.toFixed(2);
  document.getElementById('total-stock-value').textContent = totalStockValue.toFixed(2);
  document.getElementById('empty-debt').style.display = hasDebts ? 'none' : 'block';
}

// --- PRODUCTS & INVENTORY ---
function renderProducts() {
  const grid = document.getElementById('products-list');
  const empty = document.getElementById('empty-products');
  grid.innerHTML = '';

  if (products.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  products.forEach((p, index) => {
    const unitsBought = p.unitsBought || 1;
    const sold = p.sold || 0;
    const remaining = Math.max(0, unitsBought - sold);
    const stockPercent = (remaining / unitsBought) * 100;
    const isLow = stockPercent <= 20;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-header">
        <h3>${escapeHTML(p.name)}</h3>
        <span class="sold-badge">Sold: ${sold}</span>
      </div>
      <div>
        <p style="font-size: 24px; font-weight: 800; color: white;">R${p.sellingPrice.toFixed(2)}</p>
        <p style="font-size: 12px; color: var(--muted);">Profit/unit: R${(p.sellingPrice - p.trueCost).toFixed(2)}</p>
      </div>
      
      <div style="margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-bottom: 4px;">
          <span>Stock: ${remaining} left</span>
          <span>${unitsBought} total</span>
        </div>
        <div class="stock-bar-bg">
          <div class="stock-bar-fill ${isLow ? 'low' : ''}" style="width: ${stockPercent}%;"></div>
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 16px;">
        <button onclick="logSale(${index})" class="btn-primary" style="flex: 1; padding: 8px; font-size: 13px;">+1 Sale</button>
        <button onclick="deleteProduct(${index})" class="btn-secondary" style="padding: 8px 12px; color: var(--danger);">×</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// --- MODAL & SALE LOGGING ---
function logSale(index) {

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
    // 1. Calculate Profit (Only from sales that were marked "Paid")
    totalProfit += (p.sellingPrice - p.trueCost) * (p.soldPaid || 0);
    
    // 2. Calculate Stock Value (Remaining items * Wholesale cost)
    const remainingStock = Math.max(0, (p.unitsBought || 1) - (p.sold || 0));
    totalStockValue += remainingStock * (p.wholesaleCost || 0);

    // 3. Calculate Debts
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
  currentSaleProductIndex = index;
  currentPaymentStatus = 'paid'; 
  document.getElementById('crm-modal').style.display = 'flex';
  document.getElementById('crm-customer-name').value = '';
  document.getElementById('crm-quantity').value = 1;
  updatePaymentButtons();
}

function closeCrmModal() {
  document.getElementById('crm-modal').style.display = 'none';
  currentSaleProductIndex = null;
}

function setPaymentStatus(status) {
  currentPaymentStatus = status;
  updatePaymentButtons();
}

function updatePaymentButtons() {
  const btnPaid = document.getElementById('btn-paid');
  const btnOwing = document.getElementById('btn-owing');
  if (currentPaymentStatus === 'paid') {
    btnPaid.style.background = 'var(--accent)';
    btnPaid.style.color = '#000';
    btnOwing.style.background = 'transparent';
    btnOwing.style.color = 'var(--text)';
  } else {
    btnOwing.style.background = 'var(--danger)';
    btnOwing.style.color = '#fff';
    btnPaid.style.background = 'transparent';
    btnPaid.style.color = 'var(--text)';
  }
}

function confirmSale() {
  if (currentSaleProductIndex === null) return;

  const customerName = document.getElementById('crm-customer-name').value.trim() || 'Walk-in';
  const quantity = Number(document.getElementById('crm-quantity').value) || 1;
  const product = products[currentSaleProductIndex];

  // Update inventory
  product.sold = (product.sold || 0) + quantity;

  if (currentPaymentStatus === 'paid') {
    product.soldPaid = (product.soldPaid || 0) + quantity;
  } else {
    // Add to debts
    if (!product.debts) product.debts = [];
    product.debts.push({
      id: Date.now().toString(),
      customerName: customerName,
      quantity: quantity,
      amount: product.sellingPrice * quantity
    });
  }

  // Save to localStorage and update UI
  localStorage.setItem('arabbika_products', JSON.stringify(products));
  closeCrmModal();
  renderProducts();
  showToast(`${quantity} sale(s) logged!`);
}

function deleteProduct(index) {
  if (confirm('Remove this product?')) {
    products.splice(index, 1);
    localStorage.setItem('arabbika_products', JSON.stringify(products));
    renderProducts();
  }
}

// --- DEBT REMINDER ---
function remindDebt(debtId) {
  const p = products.find(prod => prod.debts && prod.debts.some(d => d.id === debtId));
  if (!p) return;
  
  const debt = p.debts.find(d => d.id === debtId);
  const text = `Hi ${debt.customerName}, just a reminder that you owe R${debt.amount.toFixed(2)} for ${debt.quantity}x ${p.name}. Please let me know when you can settle this.`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// --- CALCULATOR LOGIC ---
document.getElementById('calc-btn').addEventListener('click', async () => {
  const itemName = document.getElementById('item-name').value;
  const wholesale = document.getElementById('wholesale-cost').value;
  const unitsBought = document.getElementById('units-trip').value;
  
  if(!itemName || !wholesale) return showToast('Please fill in the item name and wholesale cost.');

  const btn = document.getElementById('calc-btn');
  btn.disabled = true; btn.textContent = 'Calculating...';

  const payload = {
    itemName,
    wholesaleCost: wholesale,
    unitsBought: unitsBought,
    transportPerTrip: document.getElementById('transport-trip').value,
    unitsPerTrip: unitsBought, // Use the same units for transport split
    dataPerWeek: document.getElementById('data-week').value,
    weeklySales: document.getElementById('sales-week').value,
    shrinkage: document.getElementById('shrinkage').value,
    desiredMargin: document.getElementById('margin').value,
    currentPrice: document.getElementById('current-price').value,
    weeklyVolume: document.getElementById('weekly-volume').value,
    theme: document.getElementById('flyer-theme').value
  };

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Store the full calculation for saving
    currentCalculation = {
      name: itemName,
      sellingPrice: Number(data.sellingPrice),
      trueCost: Number(data.trueCost),
      wholesaleCost: Number(wholesale),
      unitsBought: Number(unitsBought) || 1,
      sold: 0,
      soldPaid: 0,
      debts: [] // Initialize empty debts array
    };

    // Update UI
    document.getElementById('res-selling-price').textContent = `R${data.sellingPrice}`;
    document.getElementById('flyer-item-name').textContent = itemName;
    document.getElementById('flyer-single-price').textContent = `R${data.sellingPrice}`;
    document.getElementById('flyer-bulk-price').textContent = `Bulk (3+): R${data.bulkPrice}`;
    
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('result-box').style.display = 'block';
    document.getElementById('save-product-btn').style.display = 'block';

    showToast('Price calculated!');
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Calculate & Generate Flyer';
  }
});

document.getElementById('save-product-btn').addEventListener('click', () => {
  if (!currentCalculation) return;
  products.push(currentCalculation);
  localStorage.setItem('arabbika_products', JSON.stringify(products));
  showToast('Saved to My Products!');
  switchTab('products');
});

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Initialize Dashboard on load
renderDashboard();

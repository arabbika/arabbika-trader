// --- 1. SAFE STORAGE HELPERS ---
// 🔴 FIX: Wrap storage in try/catch so private mode doesn't crash the app
const safeStorage = {
  get: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, val); } catch { /* fail silently */ }
  }
};

// --- 2. IDENTITY & ATTRIBUTION ---
let userRef = safeStorage.get('arabbika_user_id');
let referredBy = safeStorage.get('arabbika_referred_by');

const urlParams = new URLSearchParams(window.location.search);
let incomingRef = urlParams.get('ref');

// 🔴 FIX: Sanitize referral code (keep only alphanumerics, -, _, max 16 chars)
if (incomingRef) {
  incomingRef = incomingRef.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 16);
}

if (!userRef) {
  userRef = 'usr-' + Math.random().toString(36).substring(2, 8);
  safeStorage.set('arabbika_user_id', userRef);
  
  if (incomingRef) {
    safeStorage.set('arabbika_referred_by', incomingRef);
    referredBy = incomingRef;
  }
  track('new_user', { referredBy: referredBy || 'organic' });
} else {
  track('return_visit', { referredBy: referredBy || 'organic' });
}

// --- 3. CORE TRACKING FUNCTION ---
function track(eventName, meta = {}) {
  const safeMeta = Object.fromEntries(Object.entries(meta).slice(0, 4)); 
  
  fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      event: eventName, 
      userRef: userRef,
      metadata: safeMeta
    })
  }).catch(() => {});
}

// --- 4. STATE & STORAGE ---
let products = [];
try {
  const stored = safeStorage.get('arabbika_products');
  products = stored ? JSON.parse(stored) : [];
  if (!Array.isArray(products)) products = [];
} catch (e) {
  products = []; 
}

let currentCalculation = null;
let currentEditingId = null;

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function saveProducts() {
  safeStorage.set('arabbika_products', JSON.stringify(products));
}

// --- 5. NAVIGATION ---
function switchTab(tab) {
  if (tab === 'dashboard') {
    currentEditingId = null; 
    resetCalculatorForm(); 
  }

  document.getElementById('view-dashboard').classList.add('hidden');
  document.getElementById('view-calculator').classList.add('hidden');
  document.getElementById('nav-dashboard').classList.remove('active');
  document.getElementById('nav-calculator').classList.remove('active');

  if (tab === 'dashboard') {
    document.getElementById('view-dashboard').classList.remove('hidden');
    document.getElementById('nav-dashboard').classList.add('active');
    renderDashboard();
  } else {
    document.getElementById('view-calculator').classList.remove('hidden');
    document.getElementById('nav-calculator').classList.add('active');
  }
}

// --- 6. DASHBOARD & SALES LOG ---
function renderDashboard() {
  const list = document.getElementById('products-list');
  const empty = document.getElementById('empty-state');
  list.innerHTML = '';

  if (products.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  products.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'product-item';
    el.innerHTML = `
      <div class="product-info">
        <h3>${escapeHTML(p.name)}</h3>
        <p>Selling: <strong>R${Number(p.sellingPrice).toFixed(2)}</strong> | Cost: R${Number(p.trueCost).toFixed(2)}</p>
        <p style="color: var(--accent); margin-top: 2px;">Profit: R${(p.sellingPrice - p.trueCost).toFixed(2)}</p>
        <div style="margin-top: 8px; display: flex; gap: 8px;">
           <button onclick="loadProductForEdit('${p.id}')" style="width: auto; padding: 4px 8px; font-size: 11px; background: var(--surface); color: var(--text); border: 1px solid var(--border);">Edit</button>
           <button onclick="deleteProduct('${p.id}')" style="width: auto; padding: 4px 8px; font-size: 11px; background: rgba(255,71,87,0.1); color: var(--danger); border: 1px solid var(--danger);">Delete</button>
        </div>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 11px; color: var(--muted); margin-bottom: 4px;">Sold: <strong>${p.sold || 0}</strong></p>
        <button onclick="logSale('${p.id}')" style="padding: 6px 12px; font-size: 12px; background: var(--accent); color: #000; width: auto; border-radius: 6px;">+1</button>
      </div>
    `;
    list.appendChild(el);
  });
}

function logSale(id) {
  const product = products.find(p => p.id === id);
  if (product) {
    product.sold = (product.sold || 0) + 1;
    saveProducts();
    renderDashboard();
    track('sale_logged', { profit: Number((product.sellingPrice - product.trueCost).toFixed(2)) });
  }
}

function deleteProduct(id) {
  if (confirm("Remove this product?")) {
    products = products.filter(p => p.id !== id);
    saveProducts();
    renderDashboard();
  }
}

// --- 7. CALCULATOR & EDIT FLOW ---
function loadProductForEdit(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  
  currentEditingId = id;
  switchTab('calculator');
  
  const inputs = p.inputs || {};

  document.getElementById('item-name').value = p.name || '';
  document.getElementById('wholesale-cost').value = inputs.wholesaleCost || '';
  document.getElementById('transport-trip').value = inputs.transportPerTrip || '';
  document.getElementById('units-trip').value = inputs.unitsPerTrip || '';
  document.getElementById('data-week').value = inputs.dataPerWeek || '';
  document.getElementById('sales-week').value = inputs.weeklySales || '';
  document.getElementById('shrinkage').value = inputs.shrinkage || '5';
  document.getElementById('margin').value = inputs.desiredMargin || '50';
  document.getElementById('current-price').value = p.sellingPrice || '';
  document.getElementById('weekly-volume').value = inputs.weeklyVolume || '';
}

function resetCalculatorForm() {
  document.getElementById('item-name').value = '';
  document.getElementById('wholesale-cost').value = '';
  document.getElementById('transport-trip').value = '';
  document.getElementById('units-trip').value = '';
  document.getElementById('data-week').value = '';
  document.getElementById('sales-week').value = '';
  document.getElementById('shrinkage').value = '5';
  document.getElementById('margin').value = '50';
  document.getElementById('current-price').value = '';
  document.getElementById('weekly-volume').value = '';
  document.getElementById('result-section').classList.add('hidden');
}

document.getElementById('calc-btn').addEventListener('click', async () => {
  const name = document.getElementById('item-name').value;
  const wholesale = document.getElementById('wholesale-cost').value;
  
  if (!name || !wholesale) return alert('Please enter a product name and wholesale cost.');

  const inputs = {
    itemName: name,
    wholesaleCost: wholesale,
    transportPerTrip: document.getElementById('transport-trip').value,
    unitsPerTrip: document.getElementById('units-trip').value,
    dataPerWeek: document.getElementById('data-week').value,
    weeklySales: document.getElementById('sales-week').value,
    shrinkage: document.getElementById('shrinkage').value,
    desiredMargin: document.getElementById('margin').value,
    currentPrice: document.getElementById('current-price').value,
    weeklyVolume: document.getElementById('weekly-volume').value
  };

  const btn = document.getElementById('calc-btn');
  btn.disabled = true; btn.textContent = 'Calculating...';

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentCalculation = { inputs, result: data };

    document.getElementById('res-selling-price').textContent = `R${data.sellingPrice.toFixed(2)}`;
    document.getElementById('flyer-item-name').textContent = name;
    document.getElementById('flyer-single-price').textContent = `R${data.sellingPrice.toFixed(2)}`;
    document.getElementById('flyer-bulk-price').textContent = `Bulk (3+): R${data.bulkPrice.toFixed(2)}`;

    const alertBox = document.getElementById('alert-box');
    const alertText = document.getElementById('alert-text');
    if (data.alertType !== 'none') {
      alertText.textContent = data.alertMessage;
      alertBox.className = data.alertType === 'loss' ? 'alert-loss' : 'alert-target';
      alertBox.style.display = 'block';
    } else {
      alertBox.style.display = 'none';
    }

    document.getElementById('result-section').classList.remove('hidden');
    document.getElementById('result-section').scrollIntoView({ behavior: 'smooth' });

    track('price_calculated', { margin: Number(inputs.desiredMargin), alert: data.alertType });

  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Calculate Price';
  }
});

// --- 8. SAVE/UPDATE PRODUCT ---
document.getElementById('save-btn').addEventListener('click', () => {
  if (!currentCalculation) return;
  
  if (currentEditingId) {
    const idx = products.findIndex(p => p.id === currentEditingId);
    if (idx >= 0) {
      products[idx] = {
        ...products[idx],
        name: currentCalculation.inputs.itemName,
        sellingPrice: currentCalculation.result.sellingPrice,
        trueCost: currentCalculation.result.trueCost,
        inputs: currentCalculation.inputs
      };
      // 🔴 FIX: Track product updated
      track('product_updated', { price: currentCalculation.result.sellingPrice });
    }
    currentEditingId = null;
  } else {
    products.push({
      id: Date.now().toString(),
      name: currentCalculation.inputs.itemName,
      sellingPrice: currentCalculation.result.sellingPrice,
      trueCost: currentCalculation.result.trueCost,
      sold: 0,
      inputs: currentCalculation.inputs
    });
    track('product_saved', { price: currentCalculation.result.sellingPrice });
  }

  saveProducts();
  resetCalculatorForm();
  switchTab('dashboard');
});

// --- 9. SHARE LOGIC ---
async function shareFlyerImage(btnElement) {
  const flyerTarget = document.getElementById('flyer-canvas-target');
  const originalText = btnElement.textContent;
  btnElement.textContent = 'Generating...';
  btnElement.disabled = true;

  try {
    const canvas = await html2canvas(flyerTarget, { backgroundColor: '#111', scale: 2 });
    
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'flyer.png', { type: 'image/png' });
      const shareText = `Check out my latest stock! Priced with Arabbika Trader: https://arabbika-trader.onrender.com?ref=${userRef}`;

      let sharedSuccessfully = false;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'My Flyer', text: shareText });
          sharedSuccessfully = true;
        } catch (e) {
          console.log('User cancelled share');
        }
      } else {
        // Fallback download
        const link = document.createElement('a');
        link.download = 'arabbika-flyer.png';
        link.href = canvas.toDataURL();
        link.click();
        // 🔴 FIX: Alert on desktop download
        alert('Flyer downloaded! You can now post it to WhatsApp or Facebook.');
        sharedSuccessfully = true;
      }

      if (sharedSuccessfully) {
        track('flyer_shared', { price: currentCalculation ? currentCalculation.result.sellingPrice : 0 });
      }

      btnElement.textContent = originalText;
      btnElement.disabled = false;
    });
  } catch (err) {
    alert('Failed to generate image.');
    btnElement.textContent = originalText;
    btnElement.disabled = false;
  }
}

renderDashboard();

// --- STATE MANAGEMENT ---
let products = JSON.parse(localStorage.getItem('arabbika_products')) || [];
let currentCalculation = null;
let currentTab = 'dashboard';

// --- NAVIGATION ---
function switchTab(tab) {
  currentTab = tab;
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

// --- DASHBOARD LOGIC ---
function renderDashboard() {
  const list = document.getElementById('products-list');
  const empty = document.getElementById('empty-state');
  list.innerHTML = '';

  if (products.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  // Calculate total sales
  let totalSold = 0;
  let totalProfit = 0;

  products.forEach((p, index) => {
    totalSold += (p.sold || 0);
    totalProfit += ((p.sellingPrice - p.trueCost) * (p.sold || 0));

    let alertHtml = '';
    if (p.marginDrop) {
      alertHtml = `<p style="color: var(--warning); font-size: 11px; margin-top: 4px;">⚠️ Margin dropped. Recalculate.</p>`;
    }

    const el = document.createElement('div');
    el.className = 'product-item';
    el.innerHTML = `
      <div class="product-info">
        <h3>${p.name}</h3>
        <p>Selling: <strong>R${p.sellingPrice.toFixed(2)}</strong> | Cost: R${p.trueCost.toFixed(2)}</p>
        <p style="color: var(--accent); margin-top: 2px;">Profit/unit: R${(p.sellingPrice - p.trueCost).toFixed(2)}</p>
        ${alertHtml}
      </div>
      <div style="text-align: right;">
        <p style="font-size: 11px; color: var(--muted); margin-bottom: 4px;">Sold: <strong>${p.sold || 0}</strong></p>
        <button onclick="logSale(${index})" style="padding: 6px 12px; font-size: 12px; background: var(--accent); color: #000; width: auto; border-radius: 6px;">+1</button>
      </div>
    `;
    list.appendChild(el);
  });
}

function logSale(index) {
  products[index].sold = (products[index].sold || 0) + 1;
  localStorage.setItem('arabbika_products', JSON.stringify(products));
  renderDashboard();
}

// --- CALCULATOR LOGIC ---
document.getElementById('calc-btn').addEventListener('click', async () => {
  const name = document.getElementById('item-name').value;
  const wholesale = document.getElementById('wholesale-cost').value;
  
  if (!name || !wholesale) return alert('Please enter a product name and wholesale cost.');

  const payload = {
    itemName: name,
    wholesaleCost: wholesale,
    transportPerTrip: document.getElementById('transport-trip').value,
    unitsPerTrip: document.getElementById('units-trip').value,
    dataPerWeek: document.getElementById('data-week').value,
    weeklySales: document.getElementById('sales-week').value,
    shrinkage: document.getElementById('shrinkage').value,
    desiredMargin: document.getElementById('margin').value,
    currentPrice: document.getElementById('current-price').value
  };

  const btn = document.getElementById('calc-btn');
  btn.disabled = true; btn.textContent = 'Calculating...';

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentCalculation = { ...payload, ...data };

    // Populate UI
    document.getElementById('res-selling-price').textContent = `R${data.sellingPrice.toFixed(2)}`;
    document.getElementById('flyer-item-name').textContent = name;
    document.getElementById('flyer-single-price').textContent = `R${data.sellingPrice.toFixed(2)}`;
    document.getElementById('flyer-bulk-price').textContent = `Bulk (3+): R${data.bulkPrice.toFixed(2)}`;

    // Alert Box
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

  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Calculate Price';
  }
});

// --- SAVE PRODUCT ---
document.getElementById('save-btn').addEventListener('click', () => {
  if (!currentCalculation) return;
  
  // Check if it already exists (update it)
  const existingIdx = products.findIndex(p => p.itemName === currentCalculation.itemName);
  
  const productToSave = {
    name: currentCalculation.itemName,
    sellingPrice: currentCalculation.sellingPrice,
    trueCost: currentCalculation.trueCost,
    sold: existingIdx >= 0 ? products[existingIdx].sold : 0, // keep previous sales if updating
    marginDrop: false
  };

  if (existingIdx >= 0) {
    products[existingIdx] = productToSave;
  } else {
    products.push(productToSave);
  }

  localStorage.setItem('arabbika_products', JSON.stringify(products));
  
  // Reset Calculator
  document.querySelectorAll('input').forEach(i => i.value = '');
  document.getElementById('result-section').classList.add('hidden');
  
  switchTab('dashboard');
});

// --- IMAGE SHARING ---
async function shareFlyerImage() {
  const flyerTarget = document.getElementById('flyer-canvas-target');
  const btn = document.querySelector('button[onclick="shareFlyerImage()"]');
  btn.textContent = 'Generating...';

  try {
    const canvas = await html2canvas(flyerTarget, { backgroundColor: '#111', scale: 2 });
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'flyer.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Flyer' });
      } else {
        const link = document.createElement('a');
        link.download = 'arabbika-flyer.png';
        link.href = canvas.toDataURL();
        link.click();
      }
      btn.textContent = 'Share to WhatsApp';
    });
  } catch (err) {
    alert('Failed to generate image.');
    btn.textContent = 'Share to WhatsApp';
  }
}

// Init
renderDashboard();
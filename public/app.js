// --- STATE & STORAGE ---
let products = [];
try {
  const stored = localStorage.getItem('arabbika_products');
  products = stored ? JSON.parse(stored) : [];
  if (!Array.isArray(products)) products = [];
} catch (e) {
  products = []; // 🔴 FIX 5: Prevent crash on corrupt JSON
}

let currentCalculation = null;
let currentEditingId = null;

// 🔴 FIX 5: XSS protection
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function saveProducts() {
  localStorage.setItem('arabbika_products', JSON.stringify(products));
}

// --- NAVIGATION ---
function switchTab(tab) {
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

// --- DASHBOARD ---
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
    let alertHtml = '';
    if (p.marginDrop) {
      alertHtml = `<p style="color: var(--warning); font-size: 11px; margin-top: 4px;">⚠️ Margin dropped. Update costs.</p>`;
    }

    const el = document.createElement('div');
    el.className = 'product-item';
    el.innerHTML = `
      <div class="product-info">
        <h3>${escapeHTML(p.name)}</h3>
        <p>Selling: <strong>R${p.sellingPrice.toFixed(2)}</strong> | Cost: R${p.trueCost.toFixed(2)}</p>
        <p style="color: var(--accent); margin-top: 2px;">Profit: R${(p.sellingPrice - p.trueCost).toFixed(2)}</p>
        ${alertHtml}
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
  // 🔴 FIX 5: Uses ID instead of index so deleting items doesn't break the buttons
  const product = products.find(p => p.id === id);
  if (product) {
    product.sold = (product.sold || 0) + 1;
    saveProducts();
    renderDashboard();
  }
}

function deleteProduct(id) {
  if (confirm("Remove this product?")) {
    products = products.filter(p => p.id !== id);
    saveProducts();
    renderDashboard();
  }
}

function loadProductForEdit(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  
  currentEditingId = id;
  switchTab('calculator');
  
  document.getElementById('item-name').value = p.inputs.itemName;
  document.getElementById('wholesale-cost').value = p.inputs.wholesaleCost;
  document.getElementById('transport-trip').value = p.inputs.transportPerTrip || '';
  document.getElementById('units-trip').value = p.inputs.unitsPerTrip || '';
  document.getElementById('data-week').value = p.inputs.dataPerWeek || '';
  document.getElementById('sales-week').value = p.inputs.weeklySales || '';
  document.getElementById('shrinkage').value = p.inputs.shrinkage;
  document.getElementById('margin').value = p.inputs.desiredMargin;
  document.getElementById('current-price').value = p.inputs.currentPrice || '';
  
  document.getElementById('calc-btn').click(); // Auto-calculate on load
}

// --- CALCULATOR ---
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
    weeklyVolume: 10 // Hardcoded for now, can be added to UI later
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

  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Calculate Price';
  }
});

// --- SAVE/UPDATE PRODUCT ---
document.getElementById('save-btn').addEventListener('click', () => {
  if (!currentCalculation) return;
  
  if (currentEditingId) {
    // Update existing
    const idx = products.findIndex(p => p.id === currentEditingId);
    if (idx >= 0) {
      // 🔴 FIX 3: Calculate margin drop alert
      const oldMargin = products[idx].inputs.desiredMargin;
      const newMargin = currentCalculation.inputs.desiredMargin;
      const marginDrop = Number(newMargin) < Number(oldMargin); 
      
      products[idx] = {
        ...products[idx],
        name: currentCalculation.inputs.itemName,
        sellingPrice: currentCalculation.result.sellingPrice,
        trueCost: currentCalculation.result.trueCost,
        inputs: currentCalculation.inputs,
        marginDrop: marginDrop
      };
    }
    currentEditingId = null;
  } else {
    // Save new
    products.push({
      id: Date.now().toString(), // Unique ID
      name: currentCalculation.inputs.itemName,
      sellingPrice: currentCalculation.result.sellingPrice,
      trueCost: currentCalculation.result.trueCost,
      sold: 0,
      marginDrop: false,
      inputs: currentCalculation.inputs
    });
  }

  saveProducts();
  
  // 🔴 FIX 1: Reset to defaults, not empty strings
  document.getElementById('item-name').value = '';
  document.getElementById('wholesale-cost').value = '';
  document.getElementById('transport-trip').value = '';
  document.getElementById('units-trip').value = '';
  document.getElementById('data-week').value = '';
  document.getElementById('sales-week').value = '';
  document.getElementById('shrinkage').value = '5';
  document.getElementById('margin').value = '50';
  document.getElementById('current-price').value = '';
  document.getElementById('result-section').classList.add('hidden');
  
  switchTab('dashboard');
});

// --- SHARE ---
async function shareFlyerImage(btnElement) {
  const flyerTarget = document.getElementById('flyer-canvas-target');
  const originalText = btnElement.textContent;
  btnElement.textContent = 'Generating...';
  btnElement.disabled = true;

  try {
    const canvas = await html2canvas(flyerTarget, { backgroundColor: '#111', scale: 2 });
    
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'flyer.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'My Flyer' });
        } catch (e) {
          // 🔴 FIX 5: Catch user cancellation so button doesn't freeze
          console.log('Share cancelled');
        }
      } else {
        const link = document.createElement('a');
        link.download = 'arabbika-flyer.png';
        link.href = canvas.toDataURL();
        link.click();
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

// Init
renderDashboard();

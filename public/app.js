let products = JSON.parse(localStorage.getItem('arabbika_products')) || [];
let currentCalculation = null;

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabId + '-tab').style.display = 'block';
  document.getElementById('nav-' + tabId).classList.add('active');

  const title = document.getElementById('page-title');
  if (tabId === 'calculator') {
    title.textContent = 'Price Calculator';
  } else if (tabId === 'products') {
    title.textContent = 'My Inventory';
    renderProducts();
  }
}

function showToast(message) {
  const toast = document.getElementById('toast-container');
  document.getElementById('toast-message').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- PRODUCTS DASHBOARD ---
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
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-header">
        <h3>${escapeHTML(p.name)}</h3>
        <span class="sold-badge">Sold: ${p.sold || 0}</span>
      </div>
      <div>
        <p style="font-size: 24px; font-weight: 800; color: white;">R${p.sellingPrice.toFixed(2)}</p>
        <p style="font-size: 12px; color: var(--muted);">True Cost: R${p.trueCost.toFixed(2)}</p>
        <p class="product-profit" style="font-size: 13px; margin-top: 4px;">Profit/unit: R${(p.sellingPrice - p.trueCost).toFixed(2)}</p>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button onclick="logSale(${index})" class="btn-primary" style="flex: 1; padding: 8px; font-size: 13px;">+1 Sale</button>
        <button onclick="deleteProduct(${index})" class="btn-secondary" style="padding: 8px 12px; color: var(--danger); border-color: rgba(255, 71, 87, 0.2);">×</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function logSale(index) {
  products[index].sold = (products[index].sold || 0) + 1;
  localStorage.setItem('arabbika_products', JSON.stringify(products));
  renderProducts();
  showToast('Sale logged!');
}

function deleteProduct(index) {
  if (confirm('Remove this product?')) {
    products.splice(index, 1);
    localStorage.setItem('arabbika_products', JSON.stringify(products));
    renderProducts();
  }
}

// --- CALCULATOR LOGIC ---
const inputs = ['item-name', 'wholesale-cost', 'transport-trip', 'units-trip', 'data-week', 'sales-week', 'shrinkage', 'margin', 'current-price', 'weekly-volume', 'flyer-theme'];

window.addEventListener('DOMContentLoaded', () => {
  inputs.forEach(id => {
    const saved = localStorage.getItem('trader_' + id);
    if (saved) document.getElementById(id).value = saved;
  });
});

inputs.forEach(id => {
  document.getElementById(id).addEventListener('input', (e) => {
    localStorage.setItem('trader_' + id, e.target.value);
  });
});

document.getElementById('calc-btn').addEventListener('click', async () => {
  const itemName = document.getElementById('item-name').value;
  const wholesaleCost = document.getElementById('wholesale-cost').value;
  
  if(!itemName || !wholesaleCost) return showToast('Please fill in the item name and wholesale cost.');

  const btn = document.getElementById('calc-btn');
  btn.disabled = true; 
  btn.textContent = 'Calculating...';

  const payload = {
    itemName,
    wholesaleCost,
    transportPerTrip: document.getElementById('transport-trip').value,
    unitsPerTrip: document.getElementById('units-trip').value,
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

    // Save calculation state for the "Save Product" button
    currentCalculation = {
      name: itemName,
      sellingPrice: Number(data.sellingPrice),
      trueCost: Number(data.trueCost),
      sold: 0
    };

    // Populate Results
    document.getElementById('res-selling-price').textContent = `R${data.sellingPrice}`;
    document.getElementById('flyer-item-name').textContent = itemName;
    document.getElementById('flyer-single-price').textContent = `R${data.sellingPrice}`;
    document.getElementById('flyer-bulk-price').textContent = `Bulk (3+): R${data.bulkPrice} each`;
    
    const titleEl = document.getElementById('flyer-theme-title');
    if(payload.theme === 'blackfriday') titleEl.textContent = "🔥 BLACK FRIDAY DEAL 🔥";
    else if(payload.theme === 'festive') titleEl.textContent = "🎄 FESTIVE SPECIAL 🎄";
    else titleEl.textContent = "✦ PREMIUM STOCK ✦";

    const alertBox = document.getElementById('profit-leak-box');
    const alertText = document.getElementById('profit-leak-text');
    if (data.alertType !== 'none') {
      alertText.textContent = data.alertMessage;
      alertBox.style.display = 'block';
    } else {
      alertBox.style.display = 'none';
    }

    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('result-box').style.display = 'block';
    document.getElementById('save-product-btn').style.display = 'block';

    showToast('Price calculated!');

  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false; 
    btn.textContent = 'Calculate & Generate Flyer';
  }
});

document.getElementById('save-product-btn').addEventListener('click', () => {
  if (!currentCalculation) return;
  products.push(currentCalculation);
  localStorage.setItem('arabbika_products', JSON.stringify(products));
  showToast('Saved to My Products!');
  switchTab('products');
});

// --- SHARE FLYER ---
async function shareFlyerImage(btnElement) {
  const flyerTarget = document.getElementById('flyer-canvas-target');
  const originalText = btnElement.textContent;
  btnElement.textContent = 'Generating...';
  btnElement.disabled = true;

  try {
    const canvas = await html2canvas(flyerTarget, { backgroundColor: '#000', scale: 2 });
    
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'arabbika-flyer.png', { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'My Arabbika Flyer' });
        } catch (e) { console.log('Share cancelled'); }
      } else {
        const link = document.createElement('a');
        link.download = 'arabbika-flyer.png';
        link.href = canvas.toDataURL();
        link.click();
        showToast('Image downloaded!');
      }
      
      btnElement.textContent = originalText;
      btnElement.disabled = false;
    });
  } catch (err) {
    showToast('Failed to generate image.');
    btnElement.textContent = originalText;
    btnElement.disabled = false;
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// --- 1. IDENTITY & ATTRIBUTION ---
let userRef = localStorage.getItem('arabbika_user_id');
if (!userRef) {
  userRef = 'usr-' + Math.random().toString(36).substring(2, 8);
  localStorage.setItem('arabbika_user_id', userRef);
}

// --- 2. TOAST HELPER ---
function showToast(message) {
  const toast = document.getElementById('toast-container');
  document.getElementById('toast-message').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- 3. SAVE & LOAD DATA ---
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

// --- 4. CALCULATE LOGIC ---
document.getElementById('calc-btn').addEventListener('click', async () => {
  const itemName = document.getElementById('item-name').value;
  const wholesaleCost = document.getElementById('wholesale-cost').value;
  
  if(!itemName || !wholesaleCost) return showToast('Please fill in the item name and wholesale cost.');

  const btn = document.getElementById('calc-btn');
  btn.disabled = true; 
  btn.textContent = 'Calculating...';

  // SKELETON LOADER
  const resultBox = document.getElementById('result-box');
  const priceTag = document.getElementById('res-selling-price');
  const originalPrice = priceTag.textContent;
  
  resultBox.style.display = 'block';
  priceTag.textContent = 'R ---.--';
  priceTag.classList.add('skeleton');

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

    // Remove Skeleton
    priceTag.classList.remove('skeleton');
    priceTag.textContent = `R${data.sellingPrice}`;

    // Populate Flyer
    document.getElementById('flyer-item-name').textContent = itemName;
    document.getElementById('flyer-single-price').textContent = `R${data.sellingPrice}`;
    document.getElementById('flyer-bulk-price').textContent = `Bulk (3+): R${data.bulkPrice} each`;
    
    const titleEl = document.getElementById('flyer-theme-title');
    if(payload.theme === 'blackfriday') titleEl.textContent = "🔥 BLACK FRIDAY DEAL 🔥";
    else if(payload.theme === 'festive') titleEl.textContent = "🎄 FESTIVE SPECIAL 🎄";
    else titleEl.textContent = "✦ PREMIUM STOCK ✦";

    // Alert Box
    const alertBox = document.getElementById('profit-leak-box');
    const alertText = document.getElementById('profit-leak-text');
    if (data.alertType !== 'none') {
      alertText.textContent = data.alertMessage;
      alertBox.style.display = 'block';
    } else {
      alertBox.style.display = 'none';
    }

    document.getElementById('result-box').scrollIntoView({ behavior: 'smooth', block: 'end' });
    showToast('Price calculated!');

  } catch (err) {
    priceTag.classList.remove('skeleton');
    priceTag.textContent = originalPrice;
    showToast(err.message);
  } finally {
    btn.disabled = false; 
    btn.textContent = 'Calculate & Generate Flyer';
  }
});

// --- 5. SHARE LOGIC ---
async function shareFlyerImage() {
  const flyerTarget = document.getElementById('flyer-canvas-target');
  const btn = document.querySelector('.copy-btn');
  const originalText = btn.innerHTML;
  
  btn.innerHTML = 'Generating Image...';
  btn.disabled = true;

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
      
      btn.innerHTML = originalText;
      btn.disabled = false;
    });
  } catch (err) {
    showToast('Failed to generate image.');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

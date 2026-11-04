function switchTab(tabId) {
  // Since we only have one tab right now, this just handles the active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
}

function showToast(message) {
  const toast = document.getElementById('toast-container');
  document.getElementById('toast-message').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Save & Load Data
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

// Calculate Logic
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

    // Populate Results
    document.getElementById('res-selling-price').textContent = `R${data.sellingPrice}`;
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

    // Show Result, hide empty state
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('result-box').style.display = 'block';

    showToast('Price calculated!');

  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false; 
    btn.textContent = 'Calculate & Generate Flyer';
  }
});

// Share Flyer Logic
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

require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);

// 🔴 FIX: Raise limit to 5kb to prevent HTML error pages on long product names
app.use(express.json({ limit: '5kb' })); 
app.use(express.static('public'));

// Rate Limiters
const calcLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 50, 
  message: { error: "Too many calculations. Please try again in 15 minutes." }
});
app.use('/api/calculate', calcLimiter);

const eventLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, 
  message: { error: "Too many events." }
});

const ALLOWED_EVENTS = ['new_user', 'return_visit', 'price_calculated', 'product_saved', 'product_updated', 'sale_logged', 'flyer_shared'];

app.post('/api/event', eventLimiter, (req, res) => {
  const { event, userRef, metadata } = req.body;
  
  if (!ALLOWED_EVENTS.includes(event)) {
    return res.status(400).json({ error: 'Invalid event type.' });
  }

  // 🔴 FIX: Clip event data on the server to prevent log pollution
  let safeMeta = {};
  if (metadata && typeof metadata === 'object') {
    Object.keys(metadata).slice(0, 4).forEach(key => {
      const shortKey = String(key).substring(0, 15);
      const val = metadata[key];
      if (typeof val === 'number' || typeof val === 'string') {
        safeMeta[shortKey] = String(val).substring(0, 30); // Cap value length
      }
    });
  }

  // Cap userRef length
  const safeRef = String(userRef || 'organic').substring(0, 25);

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: event,
    userRef: safeRef,
    metadata: safeMeta
  }));

  res.status(200).json({ success: true });
});

app.post('/api/calculate', async (req, res) => {
  try {
    let { 
      itemName, wholesaleCost, transportPerTrip, unitsPerTrip, 
      dataPerWeek, weeklySales, shrinkage, desiredMargin, currentPrice, weeklyVolume 
    } = req.body;

    const parseNum = (val, defaultVal = 0) => {
      if (val === undefined || val === null || val === "") return defaultVal;
      const num = Number(val);
      return (isNaN(num) || num < 0) ? defaultVal : num;
    };

    wholesaleCost = parseNum(wholesaleCost);
    transportPerTrip = parseNum(transportPerTrip);
    unitsPerTrip = parseNum(unitsPerTrip);
    dataPerWeek = parseNum(dataPerWeek);
    weeklySales = parseNum(weeklySales);
    shrinkage = parseNum(shrinkage);
    desiredMargin = parseNum(desiredMargin);
    currentPrice = parseNum(currentPrice);
    weeklyVolume = parseNum(weeklyVolume); 

    if (wholesaleCost <= 0) return res.status(400).json({ error: "Wholesale cost must be > 0." });
    
    // 🔴 FIX: Cap margin at 95%
    if (desiredMargin >= 95) return res.status(400).json({ error: "Margin cannot be 95% or more." });
    if (shrinkage >= 90) shrinkage = 90;

    if (transportPerTrip > 0 && unitsPerTrip <= 0) {
      return res.status(400).json({ error: "Please enter the number of units per trip." });
    }
    if (dataPerWeek > 0 && weeklySales <= 0) {
      return res.status(400).json({ error: "Please enter sales per week." });
    }

    const validUnits = unitsPerTrip > 0 ? unitsPerTrip : 1;
    const validSales = weeklySales > 0 ? weeklySales : 1;

    const transportPerUnit = transportPerTrip / validUnits;
    const dataPerUnit = dataPerWeek / validSales;
    const baseCost = wholesaleCost + transportPerUnit + dataPerUnit;
    
    const shrinkDecimal = shrinkage / 100;
    const trueCost = baseCost / (1 - shrinkDecimal);
    
    const marginDecimal = desiredMargin / 100;
    const sellingPrice = trueCost / (1 - marginDecimal);
    
    let bulkPrice = sellingPrice * 0.9;
    if (bulkPrice < trueCost) bulkPrice = Math.min(trueCost * 1.05, sellingPrice);

    let alertMessage = "";
    let alertType = "none"; 

    if (currentPrice > 0) {
      const tolerance = sellingPrice * 0.03;
      const thresholdForUnderTarget = sellingPrice - tolerance;

      if (currentPrice < trueCost) {
        const lostPerUnit = trueCost - currentPrice;
        alertMessage = `CRITICAL LOSS: At R${currentPrice.toFixed(2)}, you are losing R${lostPerUnit.toFixed(2)} per item.`;
        if (weeklyVolume > 0) {
          alertMessage += ` That's R${(lostPerUnit * weeklyVolume).toFixed(2)} lost every week.`;
        }
        alertType = "loss";
      } else if (currentPrice < thresholdForUnderTarget) {
        const missedPerUnit = sellingPrice - currentPrice;
        alertMessage = `UNDER TARGET: You are making a profit, but leaving R${missedPerUnit.toFixed(2)} on the table per item.`;
        if (weeklyVolume > 0) {
          alertMessage += ` That's R${(missedPerUnit * weeklyVolume).toFixed(2)} missed every week.`;
        }
        alertType = "under_target";
      }
    }
    
    res.json({ 
      sellingPrice: Number(sellingPrice.toFixed(2)),
      bulkPrice: Number(bulkPrice.toFixed(2)),
      trueCost: Number(trueCost.toFixed(2)),
      alertMessage,
      alertType
    });

  } catch (err) {
    console.error('Calculation Error:', err);
    res.status(500).json({ error: 'Calculation failed.' });
  }
});

// 🔴 FIX: Catch-all error handler for malformed/oversized JSON requests
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large.' });
  }
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

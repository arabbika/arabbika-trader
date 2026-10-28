require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static('public'));

// Rate Limiter (Prevents abuse)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 50, 
  message: { error: "Too many calculations. Please try again in 15 minutes." }
});
app.use('/api/calculate', limiter);

// --- 1. TRACKING & ANALYTICS ENDPOINT ---
app.post('/api/event', (req, res) => {
  const { event, userRef, metadata } = req.body;
  
  // Log to Render console (This is your pitch deck data!)
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: event,
    userRef: userRef || 'organic',
    metadata: metadata || {}
  }));

  res.status(200).json({ success: true });
});

// --- 2. CALCULATOR ENDPOINT ---
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
    if (desiredMargin >= 100) return res.status(400).json({ error: "Margin cannot be 100% or more." });
    if (shrinkage >= 90) shrinkage = 90;

    // Strict validation for Transport and Data costs
    if (transportPerTrip > 0 && unitsPerTrip <= 0) {
      return res.status(400).json({ error: "Please enter the number of units per trip to calculate transport cost." });
    }
    if (dataPerWeek > 0 && weeklySales <= 0) {
      return res.status(400).json({ error: "Please enter sales per week to calculate data cost." });
    }

    const validUnits = unitsPerTrip > 0 ? unitsPerTrip : 1;
    const validSales = weeklySales > 0 ? weeklySales : 1;

    // Core Math
    const transportPerUnit = transportPerTrip / validUnits;
    const dataPerUnit = dataPerWeek / validSales;
    const baseCost = wholesaleCost + transportPerUnit + dataPerUnit;
    
    const shrinkDecimal = shrinkage / 100;
    const trueCost = baseCost / (1 - shrinkDecimal);
    
    const marginDecimal = desiredMargin / 100;
    const sellingPrice = trueCost / (1 - marginDecimal);
    
    let bulkPrice = sellingPrice * 0.9;
    if (bulkPrice < trueCost) bulkPrice = Math.min(trueCost * 1.05, sellingPrice);

    // Profit Leak Alerts
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

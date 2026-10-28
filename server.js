require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
// Trust the Render proxy for accurate rate-limiting per user
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static('public'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 30, 
  message: { error: "Too many calculations. Please try again in 15 minutes." }
});
app.use('/api/calculate', limiter);

app.post('/api/calculate', async (req, res) => {
  try {
    let { 
      itemName, wholesaleCost, transportPerTrip, unitsPerTrip, 
      dataPerWeek, weeklySales, shrinkage, desiredMargin, currentPrice, weeklyVolume, theme 
    } = req.body;

    // 🔴 FIX 1: Bulletproof input parsing
    const parseNum = (val, defaultVal = 0) => {
      if (val === undefined || val === null || val === "") return defaultVal;
      const num = Number(val);
      return (isNaN(num) || num < 0) ? defaultVal : num;
    };

    wholesaleCost = parseNum(wholesaleCost);
    transportPerTrip = parseNum(transportPerTrip);
    unitsPerTrip = parseNum(unitsPerTrip, 1); // Defaults to 1 if empty
    dataPerWeek = parseNum(dataPerWeek);
    weeklySales = parseNum(weeklySales, 1); // Defaults to 1 if empty
    shrinkage = parseNum(shrinkage);
    desiredMargin = parseNum(desiredMargin);
    currentPrice = parseNum(currentPrice);
    weeklyVolume = parseNum(weeklyVolume, 1); // Defaults to 1 if empty

    // 🔴 FIX 2: Validate and Cap inputs
    if (wholesaleCost <= 0) return res.status(400).json({ error: "Wholesale cost must be greater than 0." });
    if (desiredMargin >= 100) return res.status(400).json({ error: "Margin cannot be 100% or more." });
    if (shrinkage >= 90) shrinkage = 90; // Cap shrinkage at 90% to prevent divide-by-zero or infinite loops

    // 1. Math: Real Cost Model
    const transportPerUnit = transportPerTrip / unitsPerTrip;
    const dataPerUnit = dataPerWeek / weeklySales;
    const baseCost = wholesaleCost + transportPerUnit + dataPerUnit;
    
    // Correct shrinkage formula
    const shrinkDecimal = shrinkage / 100;
    const totalCostWithLoss = baseCost / (1 - shrinkDecimal);
    
    // 2. Math: True Margin
    const marginDecimal = desiredMargin / 100;
    const sellingPrice = totalCostWithLoss / (1 - marginDecimal);
    
    // 🔴 FIX 3: Bulk price logic
    let bulkPrice = sellingPrice * 0.9;
    // Ensure bulk price doesn't drop below cost AND doesn't exceed single price
    if (bulkPrice < totalCostWithLoss) {
      bulkPrice = Math.min(totalCostWithLoss * 1.05, sellingPrice); 
    }

    // 3. Profit Leak / Target Warning Calculator
    let alertMessage = "";
    let alertType = "none"; 

    if (currentPrice > 0) {
      // 🔴 FIX 4: 3% Tolerance to prevent rounding false-positives
      const tolerance = sellingPrice * 0.03;
      const thresholdForUnderTarget = sellingPrice - tolerance;

      if (currentPrice < totalCostWithLoss) {
        const lostPerUnit = totalCostWithLoss - currentPrice;
        const weeklyLoss = lostPerUnit * weeklyVolume;
        alertMessage = `CRITICAL LOSS: At R${currentPrice.toFixed(2)}, you are paying R${lostPerUnit.toFixed(2)} out of your own pocket per item. You are losing R${weeklyLoss.toFixed(2)} every week.`;
        alertType = "loss";
      } else if (currentPrice < thresholdForUnderTarget) {
        const missedPerUnit = sellingPrice - currentPrice;
        const weeklyMissed = missedPerUnit * weeklyVolume;
        alertMessage = `UNDER TARGET: You are making a profit, but you are leaving R${missedPerUnit.toFixed(2)} on the table per item. That's R${weeklyMissed.toFixed(2)} missed every week.`;
        alertType = "under_target";
      }
    }
    
    res.json({ 
      sellingPrice: sellingPrice.toFixed(2),
      bulkPrice: bulkPrice.toFixed(2),
      alertMessage: alertMessage,
      alertType: alertType
    });

  } catch (err) {
    console.error('Calculation Error:', err);
    res.status(500).json({ error: 'Failed to calculate pricing. Please try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Trader App running on port ${PORT}`));

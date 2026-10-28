require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
// 🔴 CRITICAL FIX: Trust the Render proxy so the rate limiter works per-user, not globally
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static('public'));

// 🛡️ Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 30, // Increased slightly, but safe
  message: { error: "Too many calculations. Please try again in 15 minutes." }
});
app.use('/api/calculate', limiter);

app.post('/api/calculate', async (req, res) => {
  try {
    let { 
      itemName, wholesaleCost, transportPerTrip, unitsPerTrip, 
      dataPerWeek, weeklySales, shrinkage, desiredMargin, currentPrice, weeklyVolume, theme 
    } = req.body;

    // 🛡️ Input Validation (Prevent NaN and negative values)
    const parseNum = (val, defaultVal = 0) => {
      const num = Number(val);
      return (isNaN(num) || num < 0) ? defaultVal : num;
    };

    wholesaleCost = parseNum(wholesaleCost);
    transportPerTrip = parseNum(transportPerTrip);
    unitsPerTrip = parseNum(unitsPerTrip, 1);
    dataPerWeek = parseNum(dataPerWeek);
    weeklySales = parseNum(weeklySales, 1);
    shrinkage = parseNum(shrinkage);
    desiredMargin = parseNum(desiredMargin);
    currentPrice = parseNum(currentPrice);
    weeklyVolume = parseNum(weeklyVolume, 1); // Default to 1 if empty to avoid huge errors

    if (wholesaleCost <= 0) return res.status(400).json({ error: "Wholesale cost must be greater than 0." });
    if (desiredMargin >= 100) return res.status(400).json({ error: "Margin cannot be 100% or more." });

    // 1. Math: Real Cost Model
    const transportPerUnit = transportPerTrip / unitsPerTrip;
    const dataPerUnit = dataPerWeek / weeklySales;
    const baseCost = wholesaleCost + transportPerUnit + dataPerUnit;
    
    // 🔴 FIX: Correct shrinkage formula (Divide by remaining units, not multiply)
    const shrinkDecimal = shrinkage / 100;
    const totalCostWithLoss = baseCost / (1 - shrinkDecimal);
    
    // 2. Math: True Margin
    const marginDecimal = desiredMargin / 100;
    const sellingPrice = totalCostWithLoss / (1 - marginDecimal);
    
    // 🔴 FIX: Bulk Price should never drop below true cost
    let bulkPrice = sellingPrice * 0.9;
    if (bulkPrice < totalCostWithLoss) bulkPrice = totalCostWithLoss * 1.05; // Ensure at least 5% profit on bulk

    // 3. Profit Leak / Target Warning Calculator
    let alertMessage = "";
    let alertType = "none"; // 'loss', 'under_target', or 'none'

    if (currentPrice > 0) {
      if (currentPrice < totalCostWithLoss) {
        // They are actually losing money
        const lostPerUnit = totalCostWithLoss - currentPrice;
        const weeklyLoss = lostPerUnit * weeklyVolume;
        alertMessage = `CRITICAL LOSS: At R${currentPrice.toFixed(2)}, you are paying R${lostPerUnit.toFixed(2)} out of your own pocket per item. You are losing R${weeklyLoss.toFixed(2)} every week.`;
        alertType = "loss";
      } else if (currentPrice < sellingPrice) {
        // They are profitable, but missing their target
        const missedPerUnit = sellingPrice - currentPrice;
        const weeklyMissed = missedPerUnit * weeklyVolume;
        alertMessage = `UNDER TARGET: You are making a profit, but you are leaving R${missedPerUnit.toFixed(2)} on the table per item. That's R${weeklyMissed.toFixed(2)} missed every week.`;
        alertType = "under_target";
      }
    }

    // 🔴 FIX: We removed the AI call here. The frontend builds the flyer visually, 
    // so we don't need to pay xAI to generate text that is hidden from the user.
    
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

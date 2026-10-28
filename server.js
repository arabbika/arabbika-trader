require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 🛡️ PROTECT YOUR WALLET: Rate Limiting (Max 20 requests per 15 mins per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: "Too many calculations. Please try again in 15 minutes." }
});
app.use('/api/calculate', limiter);

// xAI Configuration
const openai = new OpenAI({ 
  apiKey: process.env.XAI_API_KEY, 
  baseURL: "https://api.x.ai/v1" 
});

app.post('/api/calculate', async (req, res) => {
  try {
    const { 
      itemName, wholesaleCost, transportPerTrip, unitsPerTrip, 
      dataPerWeek, weeklySales, shrinkage, desiredMargin, currentPrice, weeklyVolume, theme 
    } = req.body;

    // 1. Math: Real Cost Model
    const wholesale = Number(wholesaleCost);
    const transportPerUnit = Number(transportPerTrip) / Number(unitsPerTrip || 1);
    const dataPerUnit = Number(dataPerWeek) / Number(weeklySales || 1);
    const baseCost = wholesale + transportPerUnit + dataPerUnit;
    
    // Add shrinkage
    const totalCostWithLoss = baseCost * (1 + (Number(shrinkage || 0) / 100));
    
    // 2. Math: True Margin (not markup)
    // Formula: Cost / (1 - Margin%)
    const marginDecimal = Number(desiredMargin) / 100;
    if (marginDecimal >= 1) return res.status(400).json({ error: "Margin cannot be 100% or more." });
    
    const sellingPrice = totalCostWithLoss / (1 - marginDecimal);
    const bulkPrice = sellingPrice * 0.9;

    // 3. Profit Leak Calculator
    let profitLeakMessage = "";
    if (currentPrice && Number(currentPrice) > 0) {
      const lostPerUnit = sellingPrice - Number(currentPrice);
      if (lostPerUnit > 0) {
        const weeklyLoss = lostPerUnit * Number(weeklyVolume || 1);
        profitLeakMessage = `At R${Number(currentPrice).toFixed(2)}, you are losing R${lostPerUnit.toFixed(2)} per item. That's R${weeklyLoss.toFixed(2)} lost every week.`;
      }
    }

    // 4. AI Generation with Themes
    let themeInstruction = "Standard everyday retail.";
    if (theme === 'blackfriday') themeInstruction = "Use urgent Black Friday language (e.g., DOORBUSTER DEAL, Limited Stock).";
    if (theme === 'festive') themeInstruction = "Use festive December language (e.g., Perfect for gifting, Holiday Special).";

    const completion = await openai.chat.completions.create({
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content: `You write clean, professional retail catalog updates for WhatsApp.
          Theme: ${themeInstruction}
          Do NOT use cheap emojis. Use minimalist formatting.
          Format it exactly like this:
          
          ✦ SPECIAL OFFER ✦
          [Item Name]
          
          ▪️ Single Item: R${sellingPrice.toFixed(2)}
          ▪️ Bulk Order (3+): R${bulkPrice.toFixed(2)} each
          
          📍 DM to order.
          
          Priced with Arabbika Trader.`
        },
        { role: 'user', content: `Item: ${itemName}.` }
      ],
      temperature: 0.5 
    });

    // Log the event for later metrics
    console.log(`[EVENT] flyer_generated | Item: ${itemName} | Margin: ${desiredMargin}% | Theme: ${theme}`);

    res.json({ 
      sellingPrice: sellingPrice.toFixed(2),
      bulkPrice: bulkPrice.toFixed(2),
      whatsappMessage: completion.choices[0].message.content,
      profitLeakMessage: profitLeakMessage
    });

  } catch (err) {
    console.error('Calculation Error:', err);
    res.status(500).json({ error: 'Failed to calculate pricing. Please try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Trader App running on port ${PORT}`));

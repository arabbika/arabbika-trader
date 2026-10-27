require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// xAI Configuration
const openai = new OpenAI({ 
  apiKey: process.env.XAI_API_KEY, 
  baseURL: "https://api.x.ai/v1" 
});

// The Trader Pricing Route
app.post('/api/calculate', async (req, res) => {
  try {
    const { itemName, wholesaleCost, transportPerTrip, unitsPerTrip, dataPerWeek, weeklySales, shrinkage, desiredMargin } = req.body;

    // 1. Math based on the Real Cost Model
    const wholesale = Number(wholesaleCost);
    const transportPerUnit = Number(transportPerTrip) / Number(unitsPerTrip || 1);
    const dataPerUnit = Number(dataPerWeek) / Number(weeklySales || 1);
    
    // Base cost includes wholesale + allocated transport + allocated data
    const baseCost = wholesale + transportPerUnit + dataPerUnit;
    
    // Add shrinkage (broken/lost items)
    const totalCostWithLoss = baseCost * (1 + (Number(shrinkage || 0) / 100));
    
    // Calculate final price based on desired margin
    const profitAmount = totalCostWithLoss * (Number(desiredMargin) / 100);
    const sellingPrice = totalCostWithLoss + profitAmount;
    const bulkPrice = sellingPrice * 0.9; // 10% discount for bulk

    // 2. Generate Professional Flyer with Watermark
    const completion = await openai.chat.completions.create({
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content: `You write clean, professional retail catalog updates for WhatsApp Status. 
          Do NOT use cheap, spammy emojis. Use minimalist formatting.
          Format it exactly like this:
          
          ✦ NEW ARRIVAL ✦
          [Item Name]
          
          ▪️ Single Item: R[sellingPrice]
          ▪️ Bulk Order (3+): R[bulkPrice] each
          
          📍 DM to order.
          
          Priced with Arabbika Trader.`
        },
        { 
          role: 'user', 
          content: `Item: ${itemName}. Single Price: R${sellingPrice.toFixed(2)}. Bulk Price: R${bulkPrice.toFixed(2)}.` 
        }
      ],
      temperature: 0.5 
    });

    // Event Tracking
    console.log(`[EVENT] flyer_generated | Item: ${itemName} | Margin: ${desiredMargin}%`);

    res.json({ 
      sellingPrice: sellingPrice.toFixed(2),
      bulkPrice: bulkPrice.toFixed(2),
      whatsappMessage: completion.choices[0].message.content
    });

  } catch (err) {
    console.error('Trader Calculator error:', err);
    res.status(500).json({ error: 'Failed to calculate pricing.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Trader App running on port ${PORT}`));
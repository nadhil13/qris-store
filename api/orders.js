// Serverless endpoint for order status sync across devices on Vercel

let ordersMemory = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ ok: true, orders: ordersMemory });
    return;
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      if (body && body.order) {
        const existingIndex = ordersMemory.findIndex(o => o.id === body.order.id);
        if (existingIndex >= 0) {
          ordersMemory[existingIndex] = { ...ordersMemory[existingIndex], ...body.order, updatedAt: Date.now() };
        } else {
          ordersMemory.unshift({ ...body.order, updatedAt: Date.now() });
          ordersMemory = ordersMemory.slice(0, 50);
        }
      }
      res.status(200).json({ ok: true, orders: ordersMemory });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}

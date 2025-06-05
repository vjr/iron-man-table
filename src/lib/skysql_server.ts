import express from 'express';
import cors from 'cors';
import skysql from './skysql';

const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());

// POST /query { sql: string, params?: any[] }
app.post('/query', async (req, res) => {
  const { sql, params } = req.body;
  if (!sql) {
    return res.status(400).json({ error: 'Missing SQL statement' });
  }
  try {
    const result = await skysql.query(sql, params);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`SkySQL REST API listening at http://localhost:${port}`);
});

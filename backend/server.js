const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const { seedAdmin } = require('./utils/seed');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Umeed-e-Sahar RDMS backend is running.' });
});

app.get('/health', async (req, res) => {
  try {
    await testConnection();
    res.json({ success: true, status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use('/api/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found.' });
});

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await testConnection();
    await seedAdmin();
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

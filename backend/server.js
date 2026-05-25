const dotenv  = require('dotenv');
const express = require('express');
const cors    = require('cors');
const { testConnection } = require('./config/db');
const { seedAdmin, seedDummyData } = require('./utils/seed');

dotenv.config();

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) =>
  res.json({ success: true, message: 'Umeed-e-Sahar RDMS API is running.' })
);
app.get('/health', async (req, res) => {
  try {
    await testConnection();
    res.json({ success: true, status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/dashboard',     require('./routes/dashboard.routes'));
app.use('/api/beneficiaries', require('./routes/beneficiary.routes'));
app.use('/api/donors',        require('./routes/donor.routes'));
app.use('/api/donations',     require('./routes/donation.routes'));
app.use('/api/projects',      require('./routes/project.routes'));
app.use('/api/volunteers',    require('./routes/volunteer.routes'));
app.use('/api/inventory',     require('./routes/inventory.routes'));
app.use('/api/distributions', require('./routes/distribution.routes'));
app.use('/api/reports',       require('./routes/report.routes'));

// ── Debug (development only) ──────────────────────────────────────────────────
app.get('/api/debug/headers', (req, res) =>
  res.json({ success: true, headers: req.headers })
);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` })
);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await testConnection();
    await seedAdmin();
    await seedDummyData();
    app.listen(PORT, () => console.log(`✅ Server listening on http://localhost:${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

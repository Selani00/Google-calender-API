const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const eventRoutes = require('./routes/eventRoutes');

const app = express();
app.use(bodyParser.json());
app.use(cors({
  credentials: true,
  origin: ['http://localhost:5173'],
}));

app.use('/api', eventRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

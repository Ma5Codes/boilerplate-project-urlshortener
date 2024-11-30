require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const dns = require('dns');
const urlparser = require('url');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
const client = new MongoClient(process.env.DB_URL);
let db, urls;
client.connect()
  .then(() => {
    db = client.db("urlShortener");
    urls = db.collection("urls");
    console.log("Connected to MongoDB");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(`${process.cwd()}/public`));

// Serve HTML
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// API Endpoint
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;

  // Parse hostname for DNS lookup
  const hostname = urlparser.parse(originalUrl).hostname;

  dns.lookup(hostname, async (err, address) => {
    if (!address) {
      res.json({ error: 'Invalid URL' });
    } else {
      try {
        // Check if URL already exists in the database
        const existingUrl = await urls.findOne({ url: originalUrl });
        if (existingUrl) {
          return res.json({
            original_url: originalUrl,
            short_url: existingUrl.short_url
          });
        }

        // Create a new short URL entry
        const urlCount = await urls.countDocuments({});
        const newUrlDoc = {
          url: originalUrl,
          short_url: urlCount + 1
        };
        await urls.insertOne(newUrlDoc);

        res.json({
          original_url: originalUrl,
          short_url: newUrlDoc.short_url
        });
      } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

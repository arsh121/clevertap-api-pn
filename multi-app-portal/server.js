const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const CLEVERTAP_API_URL = 'https://api.clevertap.com/1/targets/create.json';
const CLEVERTAP_ACCOUNT_ID = process.env.CLEVERTAP_ACCOUNT_ID;
const CLEVERTAP_PASSCODE = process.env.CLEVERTAP_PASSCODE;

app.post('/api/create-campaigns', async (req, res) => {
  const { campaigns } = req.body;
  if (!Array.isArray(campaigns)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const results = await Promise.all(campaigns.map(async (c, idx) => {
    // Build payload for CleverTap
    const payload = {
      name: c.campaignName,
      target_mode: 'push',
      segment: Number(c.segmentID),
      respect_frequency_caps: false,
      conversion_goal: {
        event_name: 'LoanKhataOfferGenerationSuccess',
        conversion_time: '1H',
      },
      content: {
        title: c.title,
        body: c.body,
        platform_specific: {
          android: {
            enable_rendermax: true,
            wzrk_cid: 'clevertap',
            default_sound: true,
            background_image: c.backgroundImageLink,
            wzrk_dl: c.deeplink,
          },
        },
      },
      devices: ['android', 'ios'],
      when: {
        type: 'later',
        delivery_date_time: [c.deliveryDateTime],
        delivery_timezone: 'account',
      },
    };

    try {
      const response = await axios.post(CLEVERTAP_API_URL, payload, {
        headers: {
          'X-CleverTap-Account-Id': CLEVERTAP_ACCOUNT_ID,
          'X-CleverTap-Passcode': CLEVERTAP_PASSCODE,
          'Content-Type': 'application/json',
        },
      });
      return { idx, status: 'Completed', data: response.data };
    } catch (error) {
      return {
        idx,
        status: 'Failure',
        reason: error.response?.data || error.message,
      };
    }
  }));

  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
}); 
LaneHook driver portal

DEPLOY
1. Create a new Netlify site from this folder (suggested address: app.lanehook.com).
   Publish directory is the folder itself. Functions folder is netlify/functions (already set in netlify.toml).
2. In Netlify > Site settings > Environment variables, add:
   FMCSA_WEBKEY      free key from FMCSA (QCMobile). Turns on the live broker check.
   ANTHROPIC_API_KEY your Anthropic API key. Turns on rate confirmation reading.
   RATECON_MODEL     optional. Defaults to claude-haiku-5-5.
3. Redeploy. Without the keys the app still works; broker check and scanning show a plain "not connected" message.

NOTES
- Data is stored on the device (IndexedDB). There is no account or sync yet. Settings > Back up saves everything to a file.
- The rate confirmation function is public to the site. Add rate limits or sign-in before wide release, since each scan costs API usage.

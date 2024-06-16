const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.send'
];

const TOKEN_PATH = path.join(process.cwd(), 'tokens');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist(userEmail) {
  try {
    const tokenPath = path.join(TOKEN_PATH, `${userEmail}.json`);
    const content = await fs.readFile(tokenPath);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.log(`No saved credentials for ${userEmail}`);
    return null;
  }
}

async function saveCredentials(client, userEmail) {
  if (!fsSync.existsSync(TOKEN_PATH)) {
    fsSync.mkdirSync(TOKEN_PATH);
  }
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  const tokenPath = path.join(TOKEN_PATH, `${userEmail}.json`);
  await fs.writeFile(tokenPath, payload);
}

async function authorize(userEmail) {
  let client = await loadSavedCredentialsIfExist(userEmail);
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client, userEmail);
  }
  return client;
}

module.exports = {
  authorize
};

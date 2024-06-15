const fs = require('fs').promises;
const fsSync = require('fs'); // for synchronous operations
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

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

async function createEvent(auth, eventData) {
  const calendar = google.calendar({ version: 'v3', auth });
  const event = {
    summary: eventData.title,
    description: `${eventData.content}`,
    start: {
      dateTime: eventData.startTime,
      timeZone: 'UTC',
    },
    end: {
      dateTime: eventData.endTime,
      timeZone: 'UTC',
    },
    attendees: eventData.participants.map(email => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: "sample123",
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 10 },
      ],
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
    });
    console.log('Event created: %s', response.data.htmlLink);
    return response.data;
  } catch (err) {
    console.error('There was an error contacting the Calendar service: ' + err);
    throw err;
  }
}

async function sendEmail(auth, fromEmailAddress, toEmailAddress, subject, bodyText) {
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = createEmail(fromEmailAddress, toEmailAddress, subject, bodyText);

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: raw,
      },
    });
    console.log('Message sent successfully: ', res.data.id);
  } catch (error) {
    console.error('Error sending email: ', error);
  }
}

function createEmail(from, to, subject, message) {
  const str = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    '',
    message,
  ].join('\n');

  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

app.post('/create-event', async (req, res) => {
  try {
    const userEmail = req.body.userEmail;
    if (!userEmail) {
      res.status(400).send({ message: 'userEmail is required in the request body' });
      return;
    }

    const auth = await authorize(userEmail);
    const eventData = req.body;
    const eventResponse = await createEvent(auth, eventData);
    const meetUrl = eventResponse.hangoutLink;
    const eventLink = eventResponse.htmlLink;

    // Send email to all participants
    const subject = `Invitation: ${eventData.title}`;
    const bodyText = `You have been invited to the event "${eventData.title}".\n\nEvent Details:\n${eventData.content}\n\nGoogle Meet Link: ${meetUrl}\n\nEvent Link: ${eventLink}`;

    for (const participant of eventData.participants) {
      await sendEmail(auth, userEmail, participant, subject, bodyText);
    }

    res.status(200).send({ message: 'Event created and emails sent successfully', eventLink, meetUrl });
  } catch (error) {
    res.status(500).send({ message: 'Error creating event', error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

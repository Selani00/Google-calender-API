const { google } = require('googleapis');
const authService = require('./authService');

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
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    '',
    message,
  ].join('\n');

  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

module.exports = { createEvent, sendEmail, createEmail };

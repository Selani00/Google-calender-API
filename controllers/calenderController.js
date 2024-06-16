const { google } = require("googleapis");
const { authorize } = require("../models/googleApi");

async function createEvent(auth, eventData) {
  const calendar = google.calendar({ version: "v3", auth });
  const event = {
    summary: eventData.title,
    description: `${eventData.content}`,
    start: {
      dateTime: eventData.startTime,
      timeZone: "UTC",
    },
    end: {
      dateTime: eventData.endTime,
      timeZone: "UTC",
    },
    attendees: eventData.participants.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: "sample123",
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 10 },
      ],
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      conferenceDataVersion: 1,
    });
    console.log("Event created: %s", response.data.htmlLink);
    return response.data;
  } catch (err) {
    console.error("There was an error contacting the Calendar service: " + err);
    throw err;
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
  ].join("\n");

  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendEmail(
  auth,
  fromEmailAddress,
  toEmailAddress,
  subject,
  bodyText
) {
  const gmail = google.gmail({ version: "v1", auth });

  const raw = createEmail(fromEmailAddress, toEmailAddress, subject, bodyText);

  try {
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: raw,
      },
    });
    console.log("Message sent successfully: ", res.data.id);
  } catch (error) {
    console.error("Error sending email: ", error);
  }
}

async function createEventAndSendEmails(req, res) {
  try {
    const userEmail = req.body.userEmail;
    if (!userEmail) {
      return res
        .status(400)
        .send({ message: "userEmail is required in the request body" });
    }

    const auth = await authorize(userEmail);
    const eventData = req.body;
    const eventResponse = await createEvent(auth, eventData);
    const meetUrl = eventResponse.hangoutLink;
    const eventLink = eventResponse.htmlLink;

    const subject = `${eventData.title}`;
    const bodyText = `
  <p>You have been invited to the event <strong>${eventData.title}</strong>.</p>
  <p><strong>Event Details:</strong><br>${eventData.content}</p>
  <p>Please be join to the meeitng on <strong>${eventData.startTime}</strong></p>
  <p><strong>Google Meet Link:</strong> <a href="${meetUrl}">${meetUrl}</a></p>
  <p><strong>Event Link:</strong> <a href="${eventLink}">${eventLink}</a></p>`;

    for (const participant of eventData.participants) {
      await sendEmail(auth, userEmail, participant, subject, bodyText);
    }

    res
      .status(200)
      .send({
        message: "Event created and emails sent successfully",
        eventLink,
        meetUrl,
      });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error creating event", error: error.message });
  }
}

module.exports = {
  createEventAndSendEmails,
};

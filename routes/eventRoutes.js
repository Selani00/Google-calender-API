const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const eventService = require('../services/eventService');

router.post('/create-event', async (req, res) => {
  try {
    const userEmail = req.body.userEmail;
    if (!userEmail) {
      res.status(400).send({ message: 'userEmail is required in the request body' });
      return;
    }

    const auth = await authService.authorize(userEmail);
    const eventData = req.body;
    const eventResponse = await eventService.createEvent(auth, eventData);
    const meetUrl = eventResponse.hangoutLink;
    const eventLink = eventResponse.htmlLink;

    // Send email to all participants
    const subject = `Invitation: ${eventData.title}`;
    const bodyText = `
    <p>You have been invited to the event "<strong>${eventData.title}</strong>".</p>
    <p><strong>Event Details:</strong><br>${eventData.content}</p>
    <p><strong>Google Meet Link:</strong> <a href="${meetUrl}">${meetUrl}</a></p>
    <p><strong>Event Link:</strong> <a href="${eventLink}">${eventLink}</a></p>
  `;
  
    for (const participant of eventData.participants) {
      await eventService.sendEmail(auth, userEmail, participant, subject, bodyText);
    }

    res.status(200).send({ message: 'Event created and emails sent successfully', eventLink, meetUrl });
  } catch (error) {
    res.status(500).send({ message: 'Error creating event', error: error.message });
  }
});

module.exports = router;

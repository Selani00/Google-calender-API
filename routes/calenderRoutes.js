const express = require('express');
const { createEventAndSendEmails } = require('../controllers/calenderController');

const router = express.Router();

router.post('/create-event', createEventAndSendEmails);

module.exports = router;

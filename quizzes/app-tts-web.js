const express = require('express');
const router = express.Router();
const asyncMiddleware = require('../async');
const ssmlResponder = require('./ssmlResponder');
//const { DataAccessor, Rounds } = require('./data-accessor');

router.get('/', (_, res) => {
    res.status(200).json({ message: "TEST API" });
});
router.post('/ping', (req, res) => {
    res.status(200).json({ message: "PING-OK" });
});

router.post('/welcome', (req, res) => {
    const conv = req.body.conv;
    const returning = conv.user.last.seen;
    const welcomeResponse = ssmlResponder.getWelcomeResponse(returning);
    res.status(200).json(welcomeResponse);
});
router.post('/start', (req, res) => {

});
router.post('/next', (req, res) => {

});
router.post('/response', (req, res) => {

});
router.post('/result', (req, res) => {

});

module.exports = router;
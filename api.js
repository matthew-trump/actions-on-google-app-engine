const express = require('express');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const fs = require('fs');
const router = express.Router();

const { DataAccessor } = require('./data-accessor');

const ADMIN_SESSION_EXPIRY_IN_SECONDS = process.env.ADMIN_SESSION_EXPIRY_IN_SECONDS || 3600 * 24 * 30;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const RSA_PRIVATE_KEY_PATH = process.env.RSA_PRIVATE_KEY_PATH || './keys/jwtRS256.key';
const RSA_PUBLIC_KEY_PATH = process.env.RSA_PUBLC_KEY_PATH || './keys/jwtRS256.key.pub';

const RSA_PRIVATE_KEY = fs.readFileSync(RSA_PRIVATE_KEY_PATH);
const RSA_PUBLIC_KEY = fs.readFileSync(RSA_PUBLIC_KEY_PATH);

const JWT_ALGORITHM = "RS256";
const HTTP_UNAUTHORIZED = 401;

const handleUnauthorizedError = (err, _, res, next) => {
    if (err.status == HTTP_UNAUTHORIZED) {
        return res.status(HTTP_UNAUTHORIZED).json({ error: "Invalid or missing Authorization key" });
    }
    next();
}

const checkIfAuthenticated = expressJwt({
    secret: RSA_PUBLIC_KEY,
    errorOnFailedAuth: false
});


router.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    if (validateUsernameAndPassword(username, password)) {
        const userId = getUserId(username);
        const jwtBearerToken = jwt.sign({}, RSA_PRIVATE_KEY, {
            algorithm: JWT_ALGORITHM,
            expiresIn: ADMIN_SESSION_EXPIRY_IN_SECONDS,
            subject: userId
        });
        res.status(200).json({
            idToken: jwtBearerToken,
            expiresIn: ADMIN_SESSION_EXPIRY_IN_SECONDS,
            subject: userId,
            username: username
        });
    } else {
        res.status(401).json({ message: "LOGIN UNSUCCESSFUL" });
    }

});

/** 
 * demo has a single admin user and password
 * for multiple admins, hook this up to database or use third-party service
*/
const validateUsernameAndPassword = function (username, password) {
    return (username === ADMIN_USERNAME && password === ADMIN_PASSWORD);
}
/**
 *  demo has static value for single admin user.
 **/
const getUserId = function (_) {
    return "" + 1001; //must return a string value for jwt
}

router.get('/', (_, res) => {
    res.status(200).json({ message: "TEST API" });
});
router.get('/ping', (_, res) => {
    res.status(200).json({ message: "OK", value: new Date() });
});
router.get('/protected',
    checkIfAuthenticated,
    handleUnauthorizedError,
    function (_, res) {
        res.status(200).json({ message: "OK" });
    });
router.post('/database/ping',
    checkIfAuthenticated,
    handleUnauthorizedError,
    (req, res) => {
        DataAccessor.database.insertPing(req.body.key).then(
            (result) => {
                console.log(result);
                res.status(200).json({ message: "OK" });
            },
            (err) => {
                console.log(err);
                res.status(400).json({ error: err });
            }
        );
    });
router.get('/database/ping',
    checkIfAuthenticated,
    handleUnauthorizedError,
    (req, res) => {
        DataAccessor.database.getPings(req.body.key).then(
            (result) => {
                console.log(result);
                res.status(200).json({ result: result });
            },
            (err) => {
                cosole.log(err);
                res.status(400).json({ error: err });
            }
        );
    })


module.exports = router;
const express = require('express');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const fs = require('fs');
const router = express.Router();

const { DataAccessor } = require('./data-accessor');

const CONFIG_SCHEMA_PATH = process.env.CONFIG_SCHEMA_PATH;
const ADMIN_SESSION_EXPIRY_IN_SECONDS = process.env.ADMIN_SESSION_EXPIRY_IN_SECONDS || 3600 * 24 * 30;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const RSA_PRIVATE_KEY_PATH = process.env.RSA_PRIVATE_KEY_PATH || './keys/jwtRS256.key';
const RSA_PUBLIC_KEY_PATH = process.env.RSA_PUBLC_KEY_PATH || './keys/jwtRS256.key.pub';

const RSA_PRIVATE_KEY = fs.readFileSync(RSA_PRIVATE_KEY_PATH);
const RSA_PUBLIC_KEY = fs.readFileSync(RSA_PUBLIC_KEY_PATH);

const SCHEMA = require(CONFIG_SCHEMA_PATH);

console.log(SCHEMA);

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
        res.status(200).json({ message: "OK-protected" });
    });
router.post('/database/ping',
    checkIfAuthenticated,
    handleUnauthorizedError,
    (req, res) => {
        DataAccessor.database.insertPing(req.body.key).then(
            (result) => {
                console.log(result);
                res.status(200).json({ message: "Inserted Ping into Database: " + req.body.key });
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
                //console.log(result);
                res.status(200).json({ result: result });
            },
            (err) => {
                cosole.log(err);
                res.status(400).json({ error: err });
            }
        );
    })

router.get('/config/schema',
    checkIfAuthenticated,
    handleUnauthorizedError,
    function (_, res) {
        res.status(200).json(SCHEMA);
    });

router.get('/entities/:plural',
    checkIfAuthenticated,
    handleUnauthorizedError,
    (req, res) => {
        let config = SCHEMA.entities.filter(e => { return e.plural === req.params.plural });
        if (config.length > 0) {
            const entityConfig = config[0];
            DataAccessor.database.getEntities(entityConfig.table, req.query).then(
                (result) => {
                    //console.log(result);
                    res.status(200).json({ result: result });
                },
                (err) => {
                    console.log(err);
                    res.status(400).json({ error: err });
                }
            );
        } else {
            res.status(400).json({ error: { message: "Entity " + req.params.plural + " not found." } })
        }

    });

router.put('/entities/:plural/:id',
    checkIfAuthenticated,
    handleUnauthorizedError,
    (req, res) => {
        let config = SCHEMA.entities.filter(e => { return e.plural === req.params.plural });
        if (config.length > 0) {
            const entityConfig = config[0];
            DataAccessor.database.updateEntity(entityConfig.table,
                req.params.id,
                req.body.update).then(
                    _ => {
                        res.status(200).json({});
                    },
                    (err) => {
                        console.log(err);
                        res.status(400).json({ error: err });
                    }
                );
        } else {
            res.status(400).json({ error: { message: "Entity " + req.params.plural + " not found." } })
        }

    });



module.exports = router;
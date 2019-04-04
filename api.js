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

const asyncMiddleware = fn =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next))
            .catch(next);
    };

router.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const expiresIn = parseInt(ADMIN_SESSION_EXPIRY_IN_SECONDS);
    if (validateUsernameAndPassword(username, password)) {
        const userId = getUserId(username);
        const jwtBearerToken = jwt.sign({}, RSA_PRIVATE_KEY, {
            algorithm: JWT_ALGORITHM,
            expiresIn: expiresIn,
            subject: userId
        });
        res.status(200).json({
            idToken: jwtBearerToken,
            expiresIn: expiresIn,
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
        res.status(200).json(DataAccessor.getSchema());
    });

router.post('/schedule',
    checkIfAuthenticated,
    handleUnauthorizedError,
    asyncMiddleware(async (req, res) => {
        const items = req.body.items;
        const result = await DataAccessor.database.addScheduleItems(items);
        res.status(200).json({ result: result });
    }));



router.put('/schedule/:id',
    checkIfAuthenticated,
    handleUnauthorizedError,
    (req, res) => {
        const update = req.body.update;
        DataAccessor.database.updateScheduleItem(req.params.id, update
        ).then(
            _ => {
                res.status(200).json({});
            },
            (err) => {
                console.log(err);
                res.status(400).json({ error: err });
            }
        );


    });
router.delete("/schedule/:id",
    checkIfAuthenticated,
    handleUnauthorizedError,
    asyncMiddleware(async (req, res) => {
        await DataAccessor.database.deleteScheduledItem(parseInt(req.params.id));
        res.send({})
    }
    ));



router.get('/current',
    checkIfAuthenticated,
    handleUnauthorizedError,
    asyncMiddleware(async (_, res) => {
        const currentWithNext = await DataAccessor.database.getCurrentScheduleItem();
        res.status(200).json(currentWithNext);
    }));

router.get('/schedule',
    checkIfAuthenticated,
    handleUnauthorizedError,
    asyncMiddleware(async (req, res) => {
        const queryObj = {}
        if (req.query.limit) {
            queryObj.limit = parseInt(req.query.limit);
        }
        if (req.query.offset) {
            queryObj.offset = parseInt(req.query.offset);
        }
        const count = await DataAccessor.database.getScheduleCount();
        const result = await DataAccessor.database.getSchedule(queryObj);
        res.status(200).json({ query: queryObj, total: count[0].total, returned: result[0].length, items: result[0] });
    }));

router.get('/entities/:plural',
    checkIfAuthenticated,
    handleUnauthorizedError,
    asyncMiddleware(async (req, res) => {
        let entityConfig = DataAccessor.getEntityConfig(req.params.plural);
        if (entityConfig) {
            const queryObj = {}
            if (req.query.limit) {
                queryObj.limit = req.query.limit;
            }
            if (req.query.search && entityConfig.search) {
                queryObj.search = { field: entityConfig.search.field, value: '%' + req.query.search + '%' };
            }
            const fieldNames = entityConfig.fields.map(field => {
                return field.name;
            })
            Object.keys(req.query).map((key) => {
                if (fieldNames.indexOf(key) !== -1) {
                    queryObj.filter = queryObj.filter || {};
                    queryObj.filter[key] = req.query[key];
                }
            });
            const offset = parseInt(req.query.offset);
            const dbQuery = DataAccessor.database.getEntities(entityConfig.table, queryObj);
            const total = await dbQuery.clone().count();
            /**
             * must add offset condition AFTER getting total or else total returns empty array for nonzero offset
             */
            const entities = await (offset > 0 ? dbQuery.offset(offset) : dbQuery);
            queryObj.offset = offset;
            res.status(200).json({ query: queryObj, total: total[0]["count(*)"], returned: entities.length, entities: entities });
        } else {
            res.status(400).json({ error: { message: "Entity " + req.params.plural + " not found." } })
        }

    }));

router.put('/entities/:plural/:id',
    checkIfAuthenticated,
    handleUnauthorizedError,
    (req, res) => {
        let entityConfig = DataAccessor.getEntityConfig(req.params.plural);
        if (entityConfig) {
            const update = getEntityDatabaseObjectFromRequest(entityConfig, req.body.update);
            DataAccessor.database.updateEntity(entityConfig.table,
                req.params.id, update
            ).then(
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
const getEntityDatabaseObjectFromRequest = (entityConfig, update) => {
    const obj = Object.assign({}, update);
    if (entityConfig.search && entityConfig.search.compose) {
        obj[entityConfig.search.field] = entityConfig.search.compose.map((field => {
            return update[field]
        })).join(entityConfig.search.separator);
    }
    return obj;
}
router.post('/entities/:plural',
    checkIfAuthenticated,
    handleUnauthorizedError,
    asyncMiddleware(async (req, res) => {
        let entityConfig = DataAccessor.getEntityConfig(req.params.plural);
        if (entityConfig) {
            const entities = req.body.entities.map((entity) => {
                return getEntityDatabaseObjectFromRequest(entityConfig, entity);
            });
            const result = await DataAccessor.database.addEntities(entityConfig.table, entities);
            res.status(200).json({ result: result });
        } else {
            res.status(400).json({ error: { message: "Entity " + req.params.plural + " not found." } })
        }

    }));



module.exports = router;
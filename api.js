const express = require('express');
const router = express.Router();
const asyncMiddleware = require('./async');
const { DataAccessor, Rounds } = require('./data-accessor');

router.get('/', (_, res) => {
    res.status(200).json({ message: "TEST API" });
});

router.get('/protected',
    function (_, res) {
        res.status(200).json({ message: "OK-protected" });
    });
router.post('/database/ping',
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
    (req, res) => {
        DataAccessor.database.getPings(req.body.key).then(
            (result) => {
                res.status(200).json({ result: result });
            },
            (err) => {
                console.log(err);
                res.status(400).json({ error: err });
            }
        );
    })

router.get('/config/schema',
    function (_, res) {
        res.status(200).json(DataAccessor.getSchema());
    });

router.post('/schedule',
    asyncMiddleware(async (req, res) => {
        const items = req.body.items;
        const result = await DataAccessor.database.addScheduleItems(items);
        res.status(200).json({ result: result });
    }));



router.put('/schedule/:id',
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
    asyncMiddleware(async (req, res) => {
        await DataAccessor.database.deleteScheduledItem(parseInt(req.params.id));
        res.send({})
    }
    ));

router.get('/instance',
    asyncMiddleware(async (_, res) => {
        const conv = { data: {} };

        const items = await Rounds.startRound(conv, {});
        const round = conv.data.round;
        /**
         * test: if this works, then app probably actually works
         *  const nextitem = await Rounds.getNextItem(conv, {});
            console.log("NEXT ITEM", nextitem);
         */


        res.status(200).send(
            {
                round: round,
                items: items
            }
        );
    }));



router.get('/current',
    asyncMiddleware(async (_, res) => {
        const currentWithNext = await DataAccessor.database.getCurrentScheduleItem();
        res.status(200).json(currentWithNext);
    }));

router.get('/schedule',
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
    asyncMiddleware(async (req, res) => {
        let entityConfig = DataAccessor.getEntityConfig(req.params.plural);
        if (entityConfig) {
            const queryObj = {}
            if (req.query.limit) {
                queryObj.limit = parseInt(req.query.limit);
            }
            if (req.query.search && entityConfig.search) {
                if (entityConfig.search.field) {
                    queryObj.search = { field: entityConfig.search.field, value: '%' + req.query.search + '%' };
                } else {
                    console.log("WARNING: NO SEARCH AS entityConfig.search.field not found");
                }
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
            if (entityConfig.enablement && typeof req.query[entityConfig.enablement] !== 'undefined') {
                queryObj.filter = queryObj.filter || {};
                queryObj.filter[entityConfig.enablement] = parseInt(req.query[entityConfig.enablement])
            }

            const offset = parseInt(req.query.offset);
            const dbQuery = DataAccessor.database.getEntities(entityConfig.table, queryObj);
            const total = await dbQuery.clone().count();
            /**
             * must add offset condition AFTER getting total or else total returns empty array for nonzero offset
             */
            const dbObjects = await (offset > 0 ? dbQuery.offset(offset) : dbQuery);
            const entities = dbObjects.map((dbObject) => {
                return getEntityFromDatabaseObject(entityConfig, dbObject);
            })
            queryObj.offset = offset;
            res.status(200).json({ query: queryObj, total: total[0]["count(*)"], returned: entities.length, entities: entities });
        } else {
            res.status(400).json({ error: { message: "Entity " + req.params.plural + " not found." } })
        }

    }));

router.put('/entities/:plural/:id',
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
const getEntityFromDatabaseObject = (entityConfig, object) => {
    const entity = Object.assign({}, object);

    entityConfig.fields.map((config) => {
        const name = config.name;
        const value = object[name];

        if (config.multiple && !Array.isArray(value)) {
            const amalgamateOn = config.amalgamateOn || ":";
            const aLength = amalgamateOn.length;
            try {
                if (value[0] === amalgamateOn) {

                    entity[name] = value.substring(aLength, value.length - (aLength)).split(amalgamateOn)
                } else {
                    entity[name] = [object[name]]
                }
            } catch (err) { }
        }
    });

    return entity;
}
const getEntityDatabaseObjectFromRequest = (entityConfig, update) => {
    const obj = Object.assign({}, update);
    if (entityConfig.search && entityConfig.search.compose) {
        obj[entityConfig.search.field] = entityConfig.search.compose.map((field => {
            return update[field]
        })).join(entityConfig.search.separator);
    }
    entityConfig.fields.map((config) => {
        const name = config.name;

        if (config.multiple && Array.isArray(update[name])) {

            if (update[name].length > 0) {
                const amalgamateOn = config.amalgamateOn || ":";

                obj[name] = amalgamateOn + (update[name]).join(amalgamateOn) + amalgamateOn;
            } else {
                obj[name] = null;
            }

        }

    })
    return obj;
}
router.post('/entities/:plural',
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
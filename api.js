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
                    queryObj.search = { field: entityConfig.table + "." + entityConfig.search.field, value: '%' + req.query.search + '%' };
                } else {
                    console.log("WARNING: NO SEARCH AS entityConfig.search.field not found");
                }
            }

            if (entityConfig.filter) {
                Object.keys(req.query).map((key) => {

                    const filterConfig = entityConfig.filter.find(field => { return field.field === key });
                    if (filterConfig) {
                        const fieldEntityConfig = entityConfig.fields.find(field => { return field.name === key });

                        if (fieldEntityConfig.multiple) {

                            const fkEntityConfig = DataAccessor.getEntityConfig(fieldEntityConfig.foreignKey);
                            const intersection = fieldEntityConfig.intersection;
                            queryObj.join = queryObj.join || [];
                            queryObj.join.push([intersection.table, {
                                [intersection.table + "." + intersection.primaryKey]: entityConfig.table + ".id"
                            }])
                            queryObj.filter = queryObj.filter || {};
                            queryObj.filter[intersection.table + "." + intersection.foreignKey] = req.query[key];
                        } else {
                            queryObj.filter = queryObj.filter || {};
                            queryObj.filter[entityConfig.table + "." + key] = req.query[key];
                        }
                    }

                });
            }


            if (entityConfig.enablement && typeof req.query[entityConfig.enablement] !== 'undefined') {
                queryObj.filter = queryObj.filter || {};
                queryObj.filter[entityConfig.table + "." + entityConfig.enablement] = parseInt(req.query[entityConfig.enablement])
            }

            const offset = parseInt(req.query.offset);
            /**
             * Had to use this method to get query to work with both inner join and count
             * https://stackoverflow.com/questions/23921117/disable-only-full-group-by
             * 
             * Original query using this.db(table) in getEntities method in database object
             * was returning the id not of the Questions entry but of QuestionCategories
             * To fix this, used this.db.select("*").from(table)
             * but this brought the error from ONLY_FULL_GROUP_BY
             * Fixed this issue using groupBy('Questions.id') at end of query
             * but this resulted in the count() operation (on cloned query) bringing back 1 for all queries
             * which messed up the pagination in the frontend UI.
             * 
             * The only way to get around all this was to
             * disable ONLY_FULL_GROUP_BY sql option
             * which can be done both using /etc/my.cnf like this:
             * 
             * [mysqld]  
             *  sql_mode = "STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION"
             * 
             * can check using mysql> SELECT (@@sql_mode); to make sure ONLY_FULL_GROUP_BY not present
             * 
             * edit: PROBLEM SOLVED!
             * The whole issue was caused by the presence of the QuestionCategories.id field which was
             * overriding the Questions.id field in in the result of the inner join query.
             * This id field is not necessary in an intersection table. Deleting it solved the entire issue
             * and query (both inner join and count) work now without tweaking the server options
             * to removee ONLY_FULL_GROUP_BY
             */
            const dbQuery = DataAccessor.database.getEntities(entityConfig.table, queryObj);
            const total = await dbQuery.clone().count();
            console.log("COUNT", dbQuery.clone().count().toSQL());
            console.log("TOTAL", total);
            /**
             * must add offset condition AFTER getting total or else total returns empty array for nonzero offset
             */
            const dbObjects = await (offset > 0 ? dbQuery.offset(offset) : dbQuery);
            let entities = dbObjects.map((dbObject) => {
                return getEntityFromDatabaseObject(entityConfig, dbObject);
            });
            /**
             * now need to join on multiple foreign keys
             */
            const entityIds = entities.map(entity => entity.id);
            //console.log("ENTITY IDS", entityIds);
            const multipleFKConfigs = entityConfig.fields.filter(config => config.multiple);
            if (multipleFKConfigs.length > 0) {
                const multipleFKMap = {};
                for (i = 0, len = multipleFKConfigs.length; i < len; i++) {
                    const multipleFKConfig = multipleFKConfigs[i];
                    //console.log("multipleFKConfig", multipleFKConfig);
                    const intersection = await DataAccessor.database.getIntersection(entityIds, multipleFKConfig.intersection);
                    //console.log("intersection", intersection);
                    intersection.map((entry) => {
                        multipleFKMap[entry.pk] = multipleFKMap[entry.pk] || {};
                        multipleFKMap[entry.pk][multipleFKConfig.name] = multipleFKMap[entry.pk][multipleFKConfig.name] || [];
                        multipleFKMap[entry.pk][multipleFKConfig.name].push(entry.fk);

                    }, {});
                    //console.log("multipleFKMap", multipleFKMap);
                };
                entities = entities.map(entity => {
                    //const entityId = entity.id;
                    const multipleFKEntityMap = multipleFKMap[entity.id];
                    //console.log("multipleFKEntityMap", entityId, multipleFKEntityMap);
                    return Object.assign({}, entity, multipleFKEntityMap);
                })
            }



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

        if (config.multiple) {
            const intersection_table = config.intersection_table;

            /**
             * 
             */
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
                const amalgamateOn = config.amalgamateOn || "c";
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
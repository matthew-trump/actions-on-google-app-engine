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
        DataAccessor.getEntities(req.params.plural, req.query)
            .then((result => {
                res.status(200).json(result);
            }))
            .catch((err) => {
                res.status(400).json(err);
            })
    }));

router.put('/entities/:plural/:id',
    asyncMiddleware(async (req, res) => {
        DataAccessor.updateEntity(req.params.plural, req.params.id, req.body.update)
            .then((result) => {
                res.status(200).json(result)
            })
            .catch((err) => {
                res.status(400).json(err)
            })

    }));

router.post('/entities/:plural',
    asyncMiddleware(async (req, res) => {
        DataAccessor.addEntities(req.params.plural, req.body.entities)
            .then((result) => {
                res.status(200).json(result);
            })
            .catch((err) => {
                res.status(400).json(err);
            })
    }));

module.exports = router;
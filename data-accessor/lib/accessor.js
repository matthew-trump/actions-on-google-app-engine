const { Database } = require('./database');

const CONFIG_SCHEMA_PATH = process.env.CONFIG_SCHEMA_PATH;


const SCHEDULE_KEY_SEPARATOR = process.env.SCHEDULE_KEY_SEPARTOR || ":";
const SCHEDULE_KEY_PREFIX = process.env.SCHEDULE_KEY_PREFIX || "SKEY::";
const LOADER_TIMER_INTERVAL_SECONDS = process.env.LOADER_TIMER_INTERVAL_SECONDS;

const DEFAULT_ORDERING_FIELD = process.env.DEFAULT_ORDERING_FIELD;
const DEFAULT_ORDERING_DIRECTION = process.env.DEFAULT_ORDERING_DIRECTION || 1;



const SCHEMA = require(CONFIG_SCHEMA_PATH);


const accessor = class {
    constructor() {
        this.database = Database;
        if (process.env.SQL_DB_USERNAME) {
            this.database.initialize(SCHEMA);
            this.foreignKeyEntityCache = {};
            this.entityCacheMap = {};
            this.scheduleItemCache = {};
            this.poolEntryCache = {};
            if (LOADER_TIMER_INTERVAL_SECONDS > 0) {
                this.loadCurrentScheduled();
                this.resetLoaderTimer()
            } else {
                console.log("NO SCHEDULE TIME CONFIGURED");
            }
        } else {
            console.log("NO DATABASE CONNECTION CONFIGURED");
        }
    }
    async loadCurrentScheduled() {
        this.loadScheduledEntityPool(0, {}, null);
    }

    resetLoaderTimer() {
        if (this.loaderTimer) {
            clearInterval(this.loaderTimer);
        }
        if (LOADER_TIMER_INTERVAL_SECONDS && LOADER_TIMER_INTERVAL_SECONDS > 0) {
            const timeout = LOADER_TIMER_INTERVAL_SECONDS * 1000;
            console.log("LOADER_TIMER_INTERVAL_SECONDS", timeout);
            this.loaderTimer = setInterval(() => {
                this.loadCurrentScheduled()
            }, timeout);
        }
    }
    getSchema() {
        return SCHEMA;
    }
    getScheduleFieldConfig(name) {
        const field = SCHEMA.schedule.fields.filter(field => field.name === name);
        return field ? field[0] : null;
    }
    getEntityConfig(plural) {

        const config = SCHEMA.entities.filter(e => { return e.plural === plural });

        return config ? config[0] : null;
    }
    getScheduleForeignKeyConfigs() {
        const fields = SCHEMA.schedule.fields.filter(field => {
            return typeof field.foreignKey !== 'undefined'
        });
        return fields;
    }

    parseScheduleKey(key) {
        const obj = {}
        const elems = key.substring(SCHEDULE_KEY_PREFIX.length).split(SCHEDULE_KEY_SEPARATOR);
        obj.number = parseInt(elems.pop());
        const fkeys = elems.split(SCHEDULE_KEY_SEPARATOR);
        this.getScheduleForeignKeyConfigs().map((entityConfig, i) => {
            obj[entityConfig.name] = i < fkeys.length ? parseInt(fkeys[i]) : entityConfig.default;
        })
        return obj;
    }
    getScheduleKey(item) {
        console.log(item)
        return SCHEDULE_KEY_PREFIX + (this.getScheduleForeignKeyConfigs().map(entityConfig => {
            return item[entityConfig.name]
        }).join(SCHEDULE_KEY_SEPARATOR)) + SCHEDULE_KEY_SEPARATOR + item.number;
    }
    getPoolObject(item, key) {
        const entity = this.getSchema().schedule.entity;
        const pObj = {
            key: key,
            entity: entity,
            id: item.id || 0, //0 value for non-scheduled
            number: item.number,
            pool: item.pool,
            foreignKeys: this.getScheduleForeignKeyConfigs().reduce((obj, fkConfig) => {
                if (typeof item[fkConfig.name] !== 'undefined') {
                    obj[fkConfig.foreignKey] = item[fkConfig.name];
                    /** {
                        id: item[fkConfig.name],
                        name: this.entityCacheMap[fkConfig.plural][item[fkConfig.name]][fkConfig.label]
                    }*/
                }
                return obj;
            }, {})
        }
        console.log(pObj);
        return pObj;
    }
    async loadScheduledEntityPool(id, options, callback) {
        if (options.forceReload) {
            console.log("FORCE RELOAD");
        }
        if (!this.database.db) {
            console.log("BYPASS LOAD SCHEDULED ITEM", id ? id : 'CURRENT');
            return;
        } else {
            console.log("LOADING SCHEDULED ITEM", id ? id : 'CURRENT');
        }
        const itemObj = id ? await this.database.getScheduleItem(id) : await this.database.getCurrentScheduleItem();
        if (itemObj) {
            const item = itemObj.item;
            const key = this.getScheduleKey(item);
            this.currentKey = key;
            if (options.forceReload || !this.scheduleItemCache[key]) {
                const pObj = this.getPoolObject(item, key);
                this.scheduleItemCache[key] = pObj;
                await this.loadScheduledEntities(pObj, options)
                if (callback) {
                    callback();
                }
                console.log("LOADED", key)
            } else {
                console.log("RETAINED", key)
            }
        } else {
            console.log("ERROR Current Scheduled Item not found");
        }
    }
    async loadForeignKeyEntities(pObj) {
        console.log("LOADING FOREIGN KEY ENTITIES INTO CACHE");
        const cache = {};
        if (pObj.foreignKeys) {
            const keys = Object.keys(pObj.foreignKeys);
            for (let i = 0, len = keys.length; i < len; i++) {
                const plural = keys[i];
                const config = this.getEntityConfig(plural);
                const fkEntities = await this.database.getEntities(config.table, {});;
                cache[plural] = fkEntities.reduce((obj, entity) => {
                    obj[entity.id] = entity;
                    return obj
                }, {});
            }
        }
        this.foreignKeyEntityCache = cache;
    }
    async loadPoolEntities(pObj, options) {
        const entity = this.getSchema().schedule.entity;
        this.entityCacheMap[entity] = this.entityCacheMap[entity] || {};
        const map = this.entityCacheMap[entity];
        console.log("LOADING POOL ENTITIES INTO CACHE", entity, pObj.key);
        const config = this.getEntityConfig(entity);
        const query = {};
        if (pObj.foreignKeys) {
            const keys = Object.keys(pObj.foreignKeys);
            for (let i = 0, len = keys.length; i < len; i++) {
                const plural = keys[i];
                const eConfig = this.getEntityConfig(plural);
                const name = eConfig.name;

                if (pObj.foreignKeys[plural]) {
                    query.filter = query.filter || {};
                    query.filter[name] = pObj.foreignKeys[plural];
                }
            }
        }
        if (pObj.pool) {
            query.limit = pObj.pool
        }
        const entities = await this.database.getEntities(config.table, query);

        entities.map(entity => {
            if (options.forceReload || !map[entity.id]) {
                map[entity.id] = {
                    item: Object.assign({}, entity),
                    schedule: pObj.id,
                    key: pObj.key,
                    date: new Date()
                }
            }
        })


        this.poolEntryCache[pObj.key] = entities.reduce((obj, entity) => {
            obj.ids.push(entity.id);
            return obj;
        }, {
                ids: [],
                date: new Date()
            })

    }
    async loadScheduledEntities(pObj, options) {
        await this.loadForeignKeyEntities(pObj, options);
        await this.loadPoolEntities(pObj, options);
    }


    selectPoolEntries(pObj, excluded) {

        const map = this.entityCacheMap[this.getSchema().schedule.entity];

        const entries = this.poolEntryCache[pObj.key];

        const available = excluded ? entries.ids.filter(id => {
            return excluded.indexOf(id) == -1;
        }) : entries.ids;


        const numAvailble = available.length;
        let numEntries = pObj.number;

        const indices = new Set();
        if (numEntries > numAvailble) {
            numEntries = numAvailble;
        }
        for (let i = 0; i < numEntries; i++) {
            const index = Math.floor(Math.random() * numAvailble);
            if (indices.has(index)) {
                i--;
                continue;
            }
            indices.add(index);
        }


        let selected = available.filter((_, i) => {
            return indices.has(i);
        });

        const orderingField = SCHEMA.schedule.ordering;
        if (orderingField) {
            const orderingDirection = SCHEMA.schedule.direction;
            selected.sort((qa, qb) => {
                if (qa[forderingField] > qb[orderingField])
                    return orderingDirection > 0 ? -1 : 1;
                if (qa[orderingField] < qb[orderingField])
                    return orderingDirection > 0 ? 1 : -1;
                let randomized = (.5 - Math.random()) > 0 ? 1 : -1;
                return randomized;
            });
        }

        return selected;
    }

    generateRound(pObj, selected) {
        const round = {};
        round.entity = pObj.entity;
        round.key = pObj.key;
        round.index = 0;
        round.items = selected;



        if (pObj.foreignKeys) {
            Object.keys(pObj.foreignKeys).map((plural) => { //categories
                const id = pObj.foreignKeys[plural];
                const entityConfig = this.getEntityConfig(pObj.entity);
                const fkConfig = this.getEntityConfig(plural);
                const field = entityConfig.fields.filter(field => field.name === fkConfig.name)[0]
                const name = field.name; //category
                const entity = this.foreignKeyEntityCache[plural][id];
                //the category
                //console.log("XYZ", name, entity, field)
                round[name] = {
                    id: id,
                    name: entity ? entity[field.label] : field.none
                }
            })
        }

        return round;
    }
    getEntityFromDatabaseObject(entityConfig, object) {
        return object;
    }
    getEntityDatabaseObjectFromRequest(entityConfig, update, deleteFields) {
        const objRaw = Object.assign({}, update);
        const obj = Object.keys(objRaw).reduce((o, name) => {
            if (deleteFields.indexOf(name) === -1) {
                o[name] = objRaw[name];
            }
            return o;
        }, {});
        if (entityConfig.search && entityConfig.search.compose) {
            obj[entityConfig.search.field] = entityConfig.search.compose.map((field => {
                return update[field]
            })).join(entityConfig.search.separator);
        }
        return obj;
    }
    async addEntities(plural, entities) {
        return new Promise(async (resolve, reject) => {
            let entityConfig = this.getEntityConfig(plural);
            if (entityConfig) {
                const ids = [];
                for (let j = 0, len = entities.length; j < len; j++) {
                    const update = entities[j];
                    const { deleteFields, addenda } = await this.getIntersectionUpdates(entityConfig, null, update);
                    //console.log("getIntersectionUpdates", deleteFields, addenda);

                    const foreignKeysOf = entityConfig.fields.filter(field => field.foreignKeyOf).map(field => field.name);
                    console.log("FOREIGN KEYS OF", foreignKeysOf);

                    const dbObject = this.getEntityDatabaseObjectFromRequest(entityConfig, update, deleteFields.concat(foreignKeysOf))
                    //console.log("dbObjects", dbObjects);
                    const result = await this.database.addEntities(entityConfig.table, [dbObject]);
                    //console.log("result", result);
                    ids.push(result[0]);
                    await this.updateIntersections(entityConfig, result[0], deleteFields, addenda, {});
                }
                resolve({ result: ids })
            } else {
                reject({
                    error: { message: "Entity " + plural + " not found." }
                })
            }
        })
    }



    async getIntersectionUpdates(entityConfig, id, update) {
        const deleteFields = [];
        const addenda = {};
        const delenda = {};
        const multipleFKConfigs = entityConfig.fields.filter(field => {
            return field.foreignKey && field.multiple;
        })
        for (let i = 0, len = multipleFKConfigs.length; i < len; i++) {
            const multipleFKConfig = multipleFKConfigs[i];
            const multipleFKname = multipleFKConfig.name;
            deleteFields.push(multipleFKname);
            const intersection = multipleFKConfig.intersection;
            if (intersection) {
                if (id) {
                    const currentRows = await this.database.getIntersection([id], intersection, 0);
                    const current = currentRows.map(row => row.fk);
                    if (current && update[multipleFKname]) {
                        addenda[multipleFKname] = update[multipleFKname].filter(item => {
                            return current.indexOf(item) === -1;
                        })
                        delenda[multipleFKname] = current.filter(item => {
                            return update[multipleFKname].indexOf(item) === -1;
                        })
                    }

                } else {
                    addenda[multipleFKname] = update[multipleFKname];
                    delenda[multipleFKname] = [];
                }


            }
        }
        return { deleteFields, addenda, delenda };
    }
    async updateIntersections(entityConfig, id, fields, addenda, delenda) {
        for (let i = 0, len = fields.length; i < len; i++) {
            const fieldName = fields[i];

            const intersection = entityConfig.fields.find(field => field.name === fieldName).intersection;
            const fieldAddenda = addenda[fieldName];
            const fieldDelenda = delenda[fieldName];
            if (fieldAddenda && fieldAddenda.length > 0) {
                await this.database.addIntersectionItems(id, fieldAddenda, intersection);
            }
            if (fieldDelenda && fieldDelenda.length > 0) {
                await this.database.deleteIntersectionItems(id, fieldDelenda, intersection);
            }
        }
    }
    async updateEntity(plural, id, update) {
        return new Promise(async (resolve, reject) => {

            let entityConfig = this.getEntityConfig(plural);
            if (entityConfig) {
                const { deleteFields, addenda, delenda } = await this.getIntersectionUpdates(entityConfig, id, update);
                await this.updateIntersections(entityConfig, id, deleteFields, addenda, delenda);
                const foreignKeysOf = entityConfig.fields.filter(field => field.foreignKeyOf).map(field => field.name);
                console.log("FOREIGN KEYS OF", foreignKeysOf);
                const updateObj = this.getEntityDatabaseObjectFromRequest(entityConfig, update, deleteFields.concat(foreignKeysOf));
                this.database.updateEntity(entityConfig.table, id, updateObj
                ).then(
                    _ => {
                        resolve({ id: id })
                    },
                    (err) => {
                        reject(err);
                    }
                );
            } else {
                reject({ error: { message: "Entity " + plural + " not found." } })
            }
        })
    }
    async getEntities(plural, query) {
        //console.log("GET ENTITIES", plural, query);
        return new Promise(async (resolve, reject) => {
            let entityConfig = this.getEntityConfig(plural);
            if (entityConfig) {
                const queryObj = {}
                if (query.limit) {
                    queryObj.limit = parseInt(query.limit);
                }
                if (query.search && entityConfig.search) {
                    if (entityConfig.search.field) {
                        queryObj.search = { field: entityConfig.table + "." + entityConfig.search.field, value: '%' + query.search + '%' };
                    } else {
                        console.log("WARNING: NO SEARCH AS entityConfig.search.field not found");
                    }
                }

                if (entityConfig.filter) {
                    const qKeys = Object.keys(query);
                    for (let i = 0, len = qKeys.length; i < len; i++) {
                        const key = qKeys[i];
                        const filterConfig = entityConfig.filter.find(field => { return field.field === key });
                        if (filterConfig) {
                            const fieldEntityConfig = entityConfig.fields.find(field => { return field.name === key });
                            if (fieldEntityConfig.multiple) {
                                if (query[key]) {
                                    const intersection = fieldEntityConfig.intersection;
                                    const mode = 1;
                                    const keyArray = query[key].split(',');
                                    if (mode === 0) {
                                        //UNION of categories
                                        queryObj.join = queryObj.join || [];
                                        queryObj.join.push([intersection.table, {
                                            [intersection.table + "." + intersection.primaryKey]: entityConfig.table + ".id"
                                        }]);


                                        if (keyArray.length === 1) {
                                            queryObj.filter = queryObj.filter || {};
                                            queryObj.filter[intersection.table + "." + intersection.foreignKey] = keyArray[0];
                                        } else {
                                            queryObj.filterIn = queryObj.filterIn || [];
                                            queryObj.filterIn.push([intersection.table + "." + intersection.foreignKey, keyArray]);
                                        }
                                    } else if (mode === 1) {
                                        const iresults = await this.database.getIntersection(keyArray, intersection, 1);
                                        const iresultsMap = iresults.reduce((obj, iresult) => {
                                            const pk = iresult.pk;
                                            obj[pk] = obj[pk] || [];
                                            obj[pk].push(iresult.fk);
                                            return obj;
                                        }, {});
                                        const intersectionSet = Object.keys(iresultsMap).reduce((array, key, index) => {
                                            return index === 0 ? iresultsMap[key]
                                                : array.filter(e => iresultsMap[key].indexOf(e) !== -1);
                                        }, []);
                                        queryObj.filterIn = queryObj.filterIn || [];
                                        queryObj.filterIn.push(["id", intersectionSet]);
                                    }
                                }


                            } else {
                                queryObj.filter = queryObj.filter || {};
                                queryObj.filter[entityConfig.table + "." + key] = query[key];
                            }
                        }

                    };
                }


                if (entityConfig.enablement && typeof query[entityConfig.enablement] !== 'undefined') {
                    queryObj.filter = queryObj.filter || {};
                    queryObj.filter[entityConfig.table + "." + entityConfig.enablement] = parseInt(query[entityConfig.enablement])
                }

                const offset = parseInt(query.offset);
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
                 *  [mysqld]  
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
                const dbQuery = this.database.getEntities(entityConfig.table, queryObj);
                const total = await dbQuery.clone().count();

                const groupBy = true;
                /**
                 * must add offset condition AFTER getting total or else total returns empty array for nonzero offset
                 * the groupBy here will allow the UNION of multiple fk (e.g. categories[see mode 0 above])to select
                 * only the unique ones BUT the incorrect total will be returned from the count() function above.
                 * 'group by' must come AFTER this cloning for the count.
                 * Cannot figure out a declarative SQL way around this yet. Best thing is to not allow multiple select criteria in filtering for now.
                 */
                const dbObjects = await (offset > 0 ? (groupBy ? dbQuery.groupBy('id') : dbQuery).offset(offset) : (groupBy ? dbQuery.groupBy('id') : dbQuery));
                let entities = dbObjects.map((dbObject) => {
                    return this.getEntityFromDatabaseObject(entityConfig, dbObject);
                });
                /**
                 * now need to join on multiple foreign keys to create array
                 * Perhaps this can be done another way declaratively but this way works here
                 */
                const entityIds = entities.map(entity => entity.id);
                const multipleFKConfigs = entityConfig.fields.filter(config => config.multiple);
                if (multipleFKConfigs.length > 0) {
                    const multipleFKMap = {};
                    for (let i = 0, len = multipleFKConfigs.length; i < len; i++) {
                        const multipleFKConfig = multipleFKConfigs[i];
                        const intersection = await this.database.getIntersection(entityIds, multipleFKConfig.intersection);
                        intersection.map((entry) => {
                            multipleFKMap[entry.pk] = multipleFKMap[entry.pk] || {};
                            multipleFKMap[entry.pk][multipleFKConfig.name] = multipleFKMap[entry.pk][multipleFKConfig.name] || [];
                            multipleFKMap[entry.pk][multipleFKConfig.name].push(entry.fk);

                        }, {});
                    };
                    entities = entities.map(entity => {
                        const multipleFKEntityMap = multipleFKMap[entity.id];
                        return Object.assign({}, entity, multipleFKEntityMap);
                    })
                }

                const joinForeignKeyFields = entityConfig.fields.filter(config => config.foreignKeyOf);

                for (let k = 0, len = joinForeignKeyFields.length; k < len; k++) {

                    const joinForeignKeyField = joinForeignKeyFields[k];
                    const fieldName = joinForeignKeyField.name; //e.g. author
                    const fieldNameEntity = joinForeignKeyField.foreignKey; //e.g authors
                    const foreignKeyOf = joinForeignKeyField.foreignKeyOf; //e.g. work
                    const foreignKeyField = entityConfig.fields.find(field => field.name === foreignKeyOf); //work field of quotes Entity

                    const foreignKeyOfEntityConfig = this.getEntityConfig(foreignKeyField.foreignKey); //Works entity
                    const fieldEntityConfig = this.getEntityConfig(fieldNameEntity); //Authors entity;

                    const foreignKeyIds = [];
                    entities.forEach(entity => {
                        const fk = entity[foreignKeyOf];
                        if (Array.isArray(fk)) {
                            foreignKeyIds.concat(fk);
                        } else {
                            foreignKeyIds.push(fk);
                        }
                    })

                    //console.log("fieldName (author?)", fieldName);
                    //console.log("fieldNameEntity (authors?)", fieldNameEntity);
                    //console.log("foreignKeyOf (work?)", foreignKeyOf);
                    //console.log("foreignKeyField (work field obj)", foreignKeyField);
                    //console.log("foreignKeyOfEntityConfig (works entity)", foreignKeyOfEntityConfig);
                    //console.log("foreignKeyOfEntityConfig.table (Works)", foreignKeyOfEntityConfig.table);
                    //console.log("fieldEntityConfig (authors entity)", fieldEntityConfig);
                    //console.log("fieldEntityConfig.table (Authors)", fieldEntityConfig.table);
                    //console.log("foreignKeyIds (array of work ids [1,9,7])", foreignKeyIds.filter(Boolean));

                    const fkJoinResult = await this.database.getForeignKeyJoinMapping(joinForeignKeyField, foreignKeyOfEntityConfig, fieldEntityConfig, foreignKeyIds.filter(Boolean));
                    console.log("FK mapping", fkJoinResult);

                    const fkMapping = fkJoinResult.reduce((obj, row) => {
                        const valLeft = row[foreignKeyOf];
                        const valRight = row[fieldName];
                        obj[valLeft] = valRight;
                        return obj;
                    }, {});
                    console.log("FK mapping", fkMapping);

                    entities.map(entity => {
                        entity[fieldName] = fkMapping['' + entity[foreignKeyOf]];
                    })


                }


                queryObj.offset = offset;
                resolve({ query: queryObj, total: total[0]["count(*)"], returned: entities.length, entities: entities })
            } else {
                reject({ error: { message: "Entity " + plural + " not found." } })
            }
        })
    }

}
const DataAccessor = new accessor();
module.exports = DataAccessor;
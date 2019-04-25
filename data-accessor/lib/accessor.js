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
                console.log("XYZ", name, entity, field)
                round[name] = {
                    id: id,
                    name: entity ? entity[field.label] : field.none
                }
            })
        }

        return round;
    }


}
const DataAccessor = new accessor();
module.exports = DataAccessor;
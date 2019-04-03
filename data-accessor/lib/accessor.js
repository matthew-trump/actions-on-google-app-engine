const { Database } = require('./database');
const CONFIG_SCHEMA_PATH = process.env.CONFIG_SCHEMA_PATH;
const SCHEMA = require(CONFIG_SCHEMA_PATH);
const SCHEDULE_KEY_SEPARATOR = process.env.SCHEDULE_KEY_SEPARTOR || ":";
const SCHEDULE_KEY_PREFIX = process.env.SCHEDULE_KEY_SEPARTOR || "SKEY";
const DEFAULT_NUMBER_FIELD = "number";
const DEFAULT_POOL_FIELD = "pool";
const DEFAULT_START_FIELD = "start";

const accessor = class {
    constructor() {
        this.database = Database;
        if (process.env.SQL_DB_USERNAME) {
            this.database.initialize(SCHEMA);
            this.foreignKeyEntityCache = {};
            this.entityCacheMap = {};
            this.scheduleItemCache = {};
            this.loadScheduledEntityPool(0, {}, null);
        } else {
            console.log("NO DATABASE CONNECTION CONFIGURED");
        }
    }
    getSchema() {
        return SCHEMA;
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
    getScheduleNumberField() {
        return SCHEMA.schedule.number || DEFAULT_NUMBER_FIELD;
    }
    getSchedulePoolField() {
        return SCHEMA.schedule.pool || DEFAULT_POOL_FIELD;
    }
    getScheduleStartField() {
        return SCHEMA.schedule.start || DEFAULT_START_FIELD;
    }
    getScheduleKey(item) {
        return SCHEDULE_KEY_PREFIX + SCHEDULE_KEY_SEPARATOR + (this.getScheduleForeignKeyConfigs().map(entityConfig => {
            return item[entityConfig.name]
        }).join(SCHEDULE_KEY_SEPARATOR)) + SCHEDULE_KEY_SEPARATOR + item[this.getScheduleNumberField()];
    }
    getPoolObject(item, key) {
        const pObj = {
            key: key,
            id: item.id || 0, //0 value for non-scheduled
            number: item[this.getScheduleNumberField()],
            pool: item[this.getSchedulePoolField()],
            foreignKeys: this.getScheduleForeignKeyConfigs().reduce((obj, fkConfig) => {
                if (typeof item[fkConfig.name] !== 'undefined') {
                    obj[fkConfig.foreignKey] = item[fkConfig.name]
                }
                return obj;
            }, {})
        }
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
                    entity: entity,
                    schedule: pObj.id,
                    key: pObj.key,
                    date: new Date()
                }
            }
        })

    }
    async loadScheduledEntities(pObj, options) {
        await this.loadForeignKeyEntities(pObj, options);
        await this.loadPoolEntities(pObj, options);
    }

}
const DataAccessor = new accessor();
module.exports = DataAccessor;
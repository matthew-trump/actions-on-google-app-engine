const { Database } = require('./database');
const { ORM } = require('./orm');

const ALLOW_USER_STORAGE_ACCESS = process.env.ALLOW_USER_STORAGE_ACCESS || 0;
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
            this.scheduleItemCache = {};
            this.loadScheduledEntityPool(0, {}, null);
        } else {
            console.log("NO DATABASE CONNECTION CONFIGURED");
        }
    }
    getSchema() {
        return SCHEMA;
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
    getEntityConfig(plural) {
        const config = SCHEMA.entities.filter(e => { return e.plural === plural });
        return config ? config[0] : null;
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
                const pObj = Object.assign({}, item);
                this.scheduleItemCache[key] = pObj;
                //this.loadScheduledEntities(pObj)
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

}
const DataAccessor = new accessor();
module.exports = DataAccessor;
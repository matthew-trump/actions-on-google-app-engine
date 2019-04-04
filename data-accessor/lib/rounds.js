const { DataAccessor } = require('./data-accessor');

const schema = DataAccessor.getSchema();
const ROUND_FIELD = schema.round && schema.round.name ? schema.round.name : 'round';  //quiz
const SHOWN_FIELD = schema.round && schema.round.shown ? schema.round.shown : 'shown';  //asked

const ALLOW_USER_STORAGE_ACCESS = process.env.ALLOW_USER_STORAGE_ACCESS || 0;
const SESSION_NO_REPEAT_ENTRIES = process.env.SESSION_NO_REPEAT_ENTRIES > 0;

const Rounds = class {
    constructor() {
    }
    async startRound(conv, options = {}) {
        let excluded = null;
        let cacheInstance = null;
        if (options.accessUserStorage && ALLOW_USER_STORAGE_ACCESS) {
            if (conv.user && conv.user.storage[SHOWN_FIELD]) {
                excluded = conv.user.storage[SHOWN_FIELD];
            }
        } else if (SESSION_NO_REPEAT_ENTRIES) {
            excluded = conv.data[ROUND_FIELD] ? conv.data[ROUND_FIELD][SHOWN_FIELD] : [];
        }
        let key;
        let loadOptions;
        if (conv.data[ROUND_FIELD]
            && conv.data[ROUND_FIELD].load
            && conv.data[ROUND_FIELD].load.options) {


            loadOptions = DataAccessor.getScheduleForeignKeyConfigs().reduce((obj, entityConfig) => {
                const name = entityConfig.name;
                if (conv.data[ROUND_FIELD].load.options[name]) {
                    obj[name] = parseInt(conv.data[ROUND_FIELD].load.options[name]);
                } else {
                    obj[name] = entityConfig.default;
                }
                return obj;
            }, {
                    number: conv.data[ROUND_FIELD].load.options.number || DataAccessor.getScheduleFieldConfig('number').default,
                    pool: conv.data[ROUND_FIELD].load.options.pool || DataAccessor.getScheduleFieldConfig('pool').default
                });

            key = DataAccessor.getScheduleKey(loadOptions);
            delete conv.data[ROUND_FIELD].load;

        } else {
            cacheInstance =
                key = DataAccessor.currentKey;
        }

        await this.ensureLoaded({
            data: { [ROUND_FIELD]: { key: key } }
        });
        const pObj = DataAccessor.scheduleItemCache[key];

        if (pObj) {
            const selected = DataAccessor.selectPoolEntries(pObj, excluded);
            conv.data[ROUND_FIELD] = DataAccessor.generateRound(pObj, selected);
            conv.data[ROUND_FIELD].key = key;
            return Promise.resolve(selected);
        } else {
            //bad key: unable to parse load options from key
            console.log("ERROR BAD KEY", key);
            return Promise.reject("ERROR BAD KEY");
        }
    }
    async getNextItem(conv, options = {}) {

        const index = typeof options.index !== 'undefined' ? options.index : conv.data[ROUND_ENTRY].index;
        const plural = conv.data[ROUND_ENTRY].entity;
        const id = conv.data[ROUND_ENTRY].items[index];
        let entry = DataAccessor.entityCacheMap[entity][id];
        if (!entry) {
            //might occur in edge case of load distributed schedule rollover
            let pObj = scheduleItemCache[conv.data[ROUND_ENTRY].key];
            await DataAccessor.loadPoolEntities(pObj, {});
            entry = DataAccessor.entityCacheMap[plural][id];
            if (entry) {
                return entry.item;
            } else {
                //this should never happen.
                console.log("ERROR unable to load ENTRY #354-B. RETURNINNG EMPTY ITEM", id, index);
                return {};
            }
        }
    }
    async recordResponse(conv, data = {}) {
        return;
    }
    async saveResults(conv, options = {}) {
        return
    }
    async setLatest(conv) {
        conv.data[ROUND_FIELD].latest = latest;
    }
    async getNumEntries(conv) {

        if (conv.data[ROUND_FIELD]) {
            return conv.data[ROUND_FIELD].items.length;
        } else {
            return null;
        }
    }
    async ensureLoaded(conv) {
        const key = conv.data[ROUND_FIELD].key;
        let pObj = DataAccessor.scheduleItemCache[key];
        if (pObj) {
            return Promise.resolve(pObj);
        } else {
            const item = Object.assign({}, DataAccessor.parseScheduleKey(key),
                {
                    id: 0
                }
            );
            pObj = DataAccessor.getPoolObject(item, key);
            await this.loadPoolEnties(pObj);
            DataAccessor.scheduleItemCache[key] = pObj;
            return Promise.resolve(pObj);
        }
    }
}
module.exports = Rounds;
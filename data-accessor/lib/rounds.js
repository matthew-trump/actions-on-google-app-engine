const DataAccessor = require('./accessor');

const ALLOW_USER_STORAGE_ACCESS = process.env.ALLOW_USER_STORAGE_ACCESS || 0;
const SESSION_NO_REPEAT_ENTRIES = process.env.SESSION_NO_REPEAT_ENTRIES > 0;



const rounds = class {
    constructor() { }

    async startRound(conv, options = {}) {
        let excluded = null;
        if (options.accessUserStorage && ALLOW_USER_STORAGE_ACCESS) {
            if (conv.user && conv.user.storage.shown) {
                excluded = conv.user.storage.shown;
            }
        } else if (SESSION_NO_REPEAT_ENTRIES) {
            excluded = conv.data.round ? conv.data.round.shown : [];
            console.log("EXCLUDED", excluded)
        }
        let key;
        let loadOptions;
        if (conv.data.round
            && conv.data.round.load
            && conv.data.round.load.options) {


            loadOptions = DataAccessor.getScheduleForeignKeyConfigs().reduce((obj, entityConfig) => {
                const name = entityConfig.name;
                if (conv.data.round.load.options[name]) {
                    obj[name] = parseInt(conv.data.round.load.options[name]);
                } else {
                    obj[name] = entityConfig.default;
                }
                return obj;
            }, {
                    number: conv.data.round.load.options.number || DataAccessor.getScheduleFieldConfig('number').default,
                    pool: conv.data.round.load.options.pool || DataAccessor.getScheduleFieldConfig('pool').default
                });


            key = DataAccessor.getScheduleKey(loadOptions);
            delete conv.data.round.load;

        } else {

            key = DataAccessor.currentKey;
        }

        await this.ensureLoaded({
            data: { round: { key: key } }
        });
        const pObj = DataAccessor.scheduleItemCache[key];

        if (pObj) {

            conv.data.round = DataAccessor.generateRound(pObj, excluded);
            //conv.data.round.key = key;
            //return all of the items here, up front
            //conv.data.round.items = ordered;//items.map(item => item.id);

            return Promise.resolve(conv.data.round.items);
        } else {
            //bad key: unable to parse load options from key
            console.log("ERROR BAD KEY", key);
            return Promise.reject("ERROR BAD KEY");
        }

    }


    async getItem(conv, options = {}) {
        const index = typeof options.index !== 'undefined' ? options.index : conv.data.round.index;

        const id = conv.data.round.items[index];
        let pObj = DataAccessor.scheduleItemCache[conv.data.round.key];
        let entity = DataAccessor.entityCacheMap[pObj.entity][id];

        if (!entity) {
            //might occur in edge case of load distributed schedule rollover
            //scheduleItemCache should have been instantiated at initial startup
            pObj = DataAccessor.scheduleItemCache[conv.data.round.key];
            await DataAccessor.loadPoolEntities(pObj, {});
            entity = DataAccessor.entityCacheMap[pObj.entity][id];
            if (!entity) {
                //this should never happen.
                console.log("ERROR unable to load ENTRY #354-B. RETURNINNG EMPTY ITEM", id, index);
                return {};
            }
        }
        console.log("ENTITY 1", entity);
        return DataAccessor.getItemFromEntity(pObj, entity);
    }
    async recordResponse(conv, data = {}) {
        if (!conv.data.round.shown) {
            conv.data.round.shown = [];
        }
        console.log("SHOWN", conv.data.round.shown);
    }
    async saveResults(conv, options = {}) {
        return;
    }
    async setLatest(conv, latest) {
        conv.data.round.latest = latest;
    }
    async getNumEntries(conv) {

        if (conv.data.round) {
            return conv.data.round.items.length;
        } else {
            return null;
        }
    }
    async ensureLoaded(conv) {
        const key = conv.data.round.key;
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
Rounds = new rounds();
module.exports = Rounds;
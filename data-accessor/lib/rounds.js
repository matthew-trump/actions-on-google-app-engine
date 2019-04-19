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
            const selected = DataAccessor.selectPoolEntries(pObj, excluded);
            conv.data.round = DataAccessor.generateRound(pObj, selected);
            conv.data.round.key = key;

            const items = selected.map((id) => {
                return DataAccessor.entityCacheMap[pObj.entity]["" + id + ""]
            }).map((obj) => {
                return this.getItemFromEntity(pObj, obj);
            });
            //return all of the items here, up front
            conv.data.round.items = items.map(item => item.id);
            return Promise.resolve(items);
        } else {
            //bad key: unable to parse load options from key
            console.log("ERROR BAD KEY", key);
            return Promise.reject("ERROR BAD KEY");
        }

    }
    getItemFromEntity(pObj, entity) {
        const item = Object.assign({}, entity.item);
        Object.keys(pObj.foreignKeys).map(plural => {

            const fkEntityConfig = DataAccessor.getEntityConfig(plural);

            const value = item[fkEntityConfig.name];

            const fkObj = {
                id: value,
                name: DataAccessor.foreignKeyEntityCache[plural][value].name
            }
            item[fkEntityConfig.name] = fkObj;

        })
        return item;
    }
    async getItem(conv, options = {}) {
        const index = typeof options.index !== 'undefined' ? options.index : conv.data.round.index;

        const id = conv.data.round.items[index];
        const pObj = DataAccessor.scheduleItemCache[conv.data.round.key];
        let entity = DataAccessor.entityCacheMap[pObj.entity][id];

        if (!entity) {
            //might occur in edge case of load distributed schedule rollover
            //scheduleItemCache should have been instantiated at initial startup
            let pObj = DataAccessor.scheduleItemCache[conv.data.round.key];
            await DataAccessor.loadPoolEntities(pObj, {});
            entity = DataAccessor.entityCacheMap[pObj.entity][id];
            if (!entity) {
                //this should never happen.
                console.log("ERROR unable to load ENTRY #354-B. RETURNINNG EMPTY ITEM", id, index);
                return {};
            }
        }
        return this.getItemFromEntity(pObj, entity);
    }
    async recordResponse(conv, data = {}) {
        return;
    }
    async saveResults(conv, options = {}) {
        return
    }
    async setLatest(conv) {
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
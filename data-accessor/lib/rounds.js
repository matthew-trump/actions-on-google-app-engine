const { DataAccessor } = require('./data-accessor');
const ENTRY_INDEX = process.env.ROUND_ENTRY_INDEX || 'entryIndex';

const Rounds = class {
    constructor() {
    }
    async startRound(conv, options = {}) {
        return Promise.resolve(true);
    }
    async getNextEntry(conv, options = {}) {
        const index =
            typeof options[ENTRY_INDEX] !== "undefined"
                ? options[ENTRY_INDEX]
                : conv.data[ENTRY_INDEX]
        return Promise.resolve(entries[index]);
    }
    async recordResponse(conv, data = {}) {
        return
    }
    async saveResults(conv, options = {}) {
        return
    }
    async setLatest(conv) {
        return
    }
    async getNumEntries(conv) {
        return entries.length
    }
    async ensureLoaded(conv) {
        return Promise.resolve(true);
    }
}
module.exports = Rounds;
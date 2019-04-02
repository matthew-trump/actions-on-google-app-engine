const Knex = require('knex');

const SQL_DB_TIMEZONE = process.env.SQL_DB_TIMEZONE || 'UTC';
const SQL_DB_PLATFORM = process.env.SQL_DB_PLATFORM || 'mysql';
const SQL_DB_USERNAME = process.env.SQL_DB_USERNAME;
const SQL_DB_PASSWORD = process.env.SQL_DB_PASSWORD;
const SQL_DB_DATABASE = process.env.SQL_DB_DATABASE;
const CLOUD_SQL_INSTANCE_IDENTIFIER = process.env.CLOUD_SQL_INSTANCE_IDENTIFIER;

const ENTRY_TABLE = process.env.SQL_ENTRY_TABLE || 'entry';
const CATEGORY_TABLE = process.env.SQL_CATEGORY_TABLE || 'category';
const SCHEDULED_TABLE = process.env.SQL_SCHEDULED_TABLE || 'scheduled';
const THEME_TABLE = process.env.SQL_THEME_TABLE || 'theme';
const PING_TABLE = process.env.SQL_PING_TABLE || 'ping';

const database = class {

    constructor() {
        this.marker = 1;
    }
    initialize() {
        this.db = this.connect();
    }
    connect() {
        console.log("CONNECTING TO DATABASE " + SQL_DB_DATABASE + " " + SQL_DB_TIMEZONE);
        const connection = {
            timezone: SQL_DB_TIMEZONE,
            user: SQL_DB_USERNAME,
            password: SQL_DB_PASSWORD,
            database: SQL_DB_DATABASE
        };
        if (CLOUD_SQL_INSTANCE_IDENTIFIER) {
            const socketPath = `/cloudsql/${CLOUD_SQL_INSTANCE_IDENTIFIER}`;

            console.log("Knex.connection.socketPath: " + socketPath);
            connection.socketPath = socketPath;
        }
        return Knex({
            client: SQL_DB_PLATFORM,
            connection: connection
        });
    }
    insertPing(key) {
        return this.db(PING_TABLE).insert({ key: key });
    }
    getPings() {
        return this.db(PING_TABLE);
    }
    getEntities(table, queryObj) {
        let dbQuery = this.db(table);
        if (queryObj.filter) {
            dbQuery = dbQuery.where(queryObj.filter)
        }
        if (queryObj.search) {
            dbQuery = dbQuery.where(queryObj.search.field, 'like', queryObj.search.value);
        }
        if (queryObj.limit) {
            dbQuery = dbQuery.limit(parseInt(queryObj.limit));
        }
        return dbQuery;
    }
    updateEntity(table, id, update) {
        return this.db(table).where({ id: id }).update(update);
    }
    addEntities(table, entities) {
        if (!entities || entities.length == 0) {
            return Promise.resolve(0);
        }
        return this.db(table).insert(entities);
    }

    addScheduleItems(table, item) {
        if (!item) {
            return Promise.resolve(0);
        }
        return this.db(table).insert(item);
    }
    getSchedule(table) {
        return this.db(table);
    }
    updateScheduleItem(table, id, update) {
        return this.db(table).where({ id: id }).update(update);
    }
    deleteScheduledItem(table, id) {
        return this.db(table).where({ id: id }).del();
    }





    getCategories() {
        return this.db(CATEGORY_TABLE);
    }
    getCategoryIds() {
        return this.db(ENTRY_TABLE).pluck(CATEGORY_TABLE);
    }
    getCategory(id) {
        if (id > 0) {
            return this.db(CATEGORY_TABLE).where({ id: id });
        } else {
            return Promise.resolve([{ id: 0, name: 'General' }]);
        }
    }
    insertCategory(category) {
        //const datetimeNow = new Date().toISOString().slice(0, 19).replace('T', ' ');
        //category.datetime = datetimeNow;
        return this.db(CATEGORY_TABLE).insert(category);
    }
    deleteCategory(id) {
        return this.db(CATEGORY_TABLE).where({ id: id }).del();
    }
    insertCategories(categoryNames) {
        if (!categoryNames || categoryNames.length == 0) {
            return Promise.resolve(0);
        }
        //const datetimeNow = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const categories = categoryNames.map(name => {
            return { name: name }
            //, datetime: datetimeNow }
        })
        return this.db(CATEGORY_TABLE).insert(categories);
    }


    countEntries(id) {
        return this.db(ENTRY_TABLE)
            .where({ category: id })
            .count('id as CNT')
    }
    getEntry(categoryId, enabled, limit) {
        const obj = {};
        if (categoryId > 0) {
            obj.category = categoryId;
        }
        if (enabled) {
            obj.status = 1;
        }
        if (limit > 0) {
            return this.db(ENTRY_TABLE)
                .where(obj).limit(limit)
        } else {
            return this.db(ENTRY_TABLE)
                .where(obj)
        }
    }
    updateEntry(id, update) {
        return this.db(ENTRY_TABLE).where({ id: id }).update(update);
    }
    updateEntry(id, update) {
        return this.db(ENTRY_TABLE).where({ id: id }).update(update);
    }
    updateEntry(id, update) {
        return this.db(CATEGORY_TABLE).where({ id: id }).update(update);
    }

    countEntries(categoryId) {
        return this.db(ENTRY_TABLE)
            .where({ category: categoryId })
            .count('id as CNT')
    }
    insertEntries(entries) {
        if (!entries || entries.length == 0) {
            return Promise.resolve(0);
        }
        return this.db(ENTRY_TABLE).insert(entries);
    }
    insertScheduled(scheduled) {

        return this.db(SCHEDULED_TABLE).insert(scheduled);
    }
    getScheduled() {
        return this.db(SCHEDULED_TABLE);
    }
    getScheduled(id) {
        if (typeof id === 'undefined' || id === null) {
            return this.getCurrentScheduled();
        } else {
            return this.db(SCHEDULED_TABLE).where({ id: id });
        }
    }
    getCurrentScheduled() {
        const datetimeNow = (new Date()).toISOString().slice(0, 19).replace('T', ' ');
        return this.db(SCHEDULED_TABLE).where('start', '<', datetimeNow).orderBy('start', 'DESC').limit(1);
    }
    updateScheduled(id, update) {
        return this.db(SCHEDULED_TABLE).where({ id: id }).update(update);
    }
    deleteScheduled(id) {
        return this.db(SCHEDULED_TABLE).where({ id: id }).delete();
    }
    insertTheme(obj) {
        return this.db(THEME_TABLE).insert(obj);
    }
    getThemes() {
        return this.db(THEME_TABLE);
    }
    getTheme(id) {
        return this.db(THEME_TABLE).where({ id: id });
    }
    updateTheme(id, update) {
        return this.db(THEME_TABLE).where({ id: id }).update(update);
    }
    deleteTheme(id, json) {
        return this.db(THEME_TABLE).where({ id: id }).delete();
    }


    convertUTCDateToLocalDate(date) {
        var newDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);

        var offset = date.getTimezoneOffset() / 60;
        var hours = date.getHours();

        newDate.setHours(hours - offset);

        return newDate;
    }

}

module.exports = { Database: new database() }
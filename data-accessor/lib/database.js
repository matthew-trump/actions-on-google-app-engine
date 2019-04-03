const Knex = require('knex');

const SQL_DB_TIMEZONE = process.env.SQL_DB_TIMEZONE || 'UTC';
const SQL_DB_PLATFORM = process.env.SQL_DB_PLATFORM || 'mysql';
const SQL_DB_USERNAME = process.env.SQL_DB_USERNAME;
const SQL_DB_PASSWORD = process.env.SQL_DB_PASSWORD;
const SQL_DB_DATABASE = process.env.SQL_DB_DATABASE;
const CLOUD_SQL_INSTANCE_IDENTIFIER = process.env.CLOUD_SQL_INSTANCE_IDENTIFIER;

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
    getSchedule(table, queryObj) {
        let dbQuery = this.db(table)
        if (queryObj.limit) {
            dbQuery = dbQuery.limit(parseInt(queryObj.limit));
        }
        return dbQuery;
    }
    updateScheduleItem(table, id, update) {
        return this.db(table).where({ id: id }).update(update);
    }
    deleteScheduledItem(table, id) {
        return this.db(table).where({ id: id }).del();
    }
    async getCurrentScheduleItem(table, ) {
        const datetimeNow = (new Date()).toISOString().slice(0, 19).replace('T', ' ');
        const current = await this.db(table).where('start', '<', datetimeNow).orderBy('start', 'DESC').limit(1);
        const nextone = await this.db(table).where('start', '>', datetimeNow).orderBy('start', 'ASC').limit(1);
        return Promise.resolve({
            current: current ? current[0] : null,
            next: nextone ? nextone[0] : null
        });
    }

}

module.exports = { Database: new database() }
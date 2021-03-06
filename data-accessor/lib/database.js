const Knex = require('knex');

const SQL_DB_TIMEZONE = process.env.SQL_DB_TIMEZONE || 'UTC';
const SQL_DB_PLATFORM = process.env.SQL_DB_PLATFORM || 'mysql';
const SQL_DB_USERNAME = process.env.SQL_DB_USERNAME;
const SQL_DB_PASSWORD = process.env.SQL_DB_PASSWORD;
const SQL_DB_DATABASE = process.env.SQL_DB_DATABASE;
const CLOUD_SQL_INSTANCE_IDENTIFIER = process.env.CLOUD_SQL_INSTANCE_IDENTIFIER;

const PING_TABLE = process.env.SQL_PING_TABLE || 'ping';

const DEFAULT_NUMBER_FIELD = "number";
const DEFAULT_POOL_FIELD = "pool";
const DEFAULT_START_FIELD = "start";


const database = class {

    constructor() {
        this.marker = 1;
    }
    initialize(schema) {
        this.schema = schema;
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
            connection: connection,
            pool: {
                min: 2,
                max: 10,
                afterCreate: function (conn, cb) {
                    conn.query('SET sql_mode="";', function (err) {
                        cb(err, conn);
                    });
                }
            }
        });
    }
    insertPing(key) {
        return this.db(PING_TABLE).insert({ key: key });
    }
    getPings() {
        return this.db(PING_TABLE);
    }
    getEntities(table, queryObj) {
        //console.log("DataAccessor.getEntities", table, queryObj);
        let dbQuery = this.db(table);

        let useAnd = false;

        if (queryObj.join) {
            queryObj.join.map(join => {
                dbQuery = dbQuery.join(join[0], join[1]);
            })
        }
        if (queryObj.filterIn) {
            queryObj.filterIn.forEach((filterIn) => {
                dbQuery = dbQuery.whereIn(...filterIn);
            })
            useAnd = true;
        }

        if (queryObj.filter) {
            dbQuery = dbQuery.where(queryObj.filter);
            useAnd = true;
        }

        if (queryObj.search) {
            if (useAnd) {
                dbQuery = dbQuery.andWhere(queryObj.search.field, 'like', queryObj.search.value);
            } else {
                dbQuery = dbQuery.where(queryObj.search.field, 'like', queryObj.search.value);
            }
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
    getForeignKeyIntersectionJoinMapping(joinForeignKeyField, fromEntity, intersection, ids) {
        const query = this.db(fromEntity.table)
            .select(
                fromEntity.table + ".id as " + joinForeignKeyField.foreignKeyOf,
                intersection.table + "." + intersection.foreignKey + " as " + joinForeignKeyField.name)
            .join(intersection.table, { [fromEntity.table + ".id"]: intersection.table + "." + intersection.primaryKey })
            .whereIn(fromEntity.table + ".id", ids);

        //console.log(query.toSQL());
        return query;
    }
    getForeignKeyJoinMapping(joinForeignKeyField, fromEntity, toEntity, ids) {
        console.log("joinForeignKeyField", joinForeignKeyField);
        console.log("fromEntity", fromEntity);
        console.log("toEntity", toEntity);
        console.log("ids", ids);

        const query = this.db(fromEntity.table)
            .select(
                fromEntity.table + ".id as " + joinForeignKeyField.foreignKeyOf,
                toEntity.table + ".id as " + joinForeignKeyField.name)
            .join(toEntity.table, { [fromEntity.table + "." + joinForeignKeyField.name]: toEntity.table + ".id" })
            .whereIn(fromEntity.table + ".id", ids);

        //console.log(query.toSQL());
        return query;
    }
    getIntersection(entityIds, intersection, mode = 0) {
        const args = mode === 0 ? { pk: intersection.primaryKey, fk: intersection.foreignKey } : { pk: intersection.foreignKey, fk: intersection.primaryKey }
        const query = this.db(intersection.table)
            .select(args.pk + " AS pk", args.fk + " AS fk")
            .whereIn(args.pk, entityIds);
        return query;
    }
    addIntersectionItems(entityId, foreignKeyIds, intersection) {
        return this.db(intersection.table)
            .insert(foreignKeyIds.map(fk => {
                return {
                    [intersection.primaryKey]: entityId,
                    [intersection.foreignKey]: fk
                }
            }));
    }
    deleteIntersectionItems(entityId, foreignKeyIds, intersection) {
        return this.db(intersection.table)
            .where({ [intersection.primaryKey]: entityId })
            .whereIn(intersection.foreignKey, foreignKeyIds).del();
    }
    addScheduleItems(items) {
        const table = this.schema.schedule.table;
        if (!items) {
            return Promise.resolve(0);
        }
        return this.db(table).insert(items.map(item => this.getScheduleItemDatabaseObjectFromRequest(item)));
    }
    async getScheduleCount() {
        const table = this.schema.schedule.table;
        return this.db(table).count('id as total');
    }
    async getSchedule(queryObj) {
        const table = this.schema.schedule.table;


        let querys = "SELECT *"

        const poolField = this.getSchedulePoolField();
        const numberField = this.getScheduleNumberField();
        const startField = this.getScheduleStartField();
        if (poolField !== DEFAULT_POOL_FIELD) {
            querys = querys + "," + poolField + ' AS ' + DEFAULT_POOL_FIELD;
        }
        if (numberField !== DEFAULT_NUMBER_FIELD) {
            querys = querys + "," + numberField + ' AS ' + DEFAULT_NUMBER_FIELD;
        }
        querys = querys + " FROM " + table;
        querys = querys + " ORDER BY " + startField + " DESC"
        if (queryObj.limit) {
            querys = querys + " LIMIT " + queryObj.limit;
        }
        if (typeof queryObj.offset !== undefined) {
            querys = querys + " OFFSET " + queryObj.offset;
        }
        return this.db.raw(querys);

    }
    async getScheduleItem(id) {
        const table = this.schema.schedule.table;
        const items = await this.db(table).where({ id: id });
        if (items) {
            const item = items[0];
            return { item: getScheduleItemFromDatabaseObject(item) };
        }
        return { item: null };
    }
    updateScheduleItem(id, update) {
        const table = this.schema.schedule.table;
        //console.log("RECEIVED", update);
        const obj = this.getScheduleItemDatabaseObjectFromRequest(update);
        //console.log("TRANSFORMED", obj);
        return this.db(table).where({ id: id }).update(obj);
    }
    deleteScheduledItem(id) {
        const table = this.schema.schedule.table;
        return this.db(table).where({ id: id }).del();
    }
    async getCurrentScheduleItem() {
        const table = this.schema.schedule.table;
        const datetimeNow = (new Date()).toISOString().slice(0, 19).replace('T', ' ');
        const current = await this.db(table).where('start', '<', datetimeNow).orderBy('start', 'DESC').limit(1);
        const nextone = await this.db(table).where('start', '>', datetimeNow).orderBy('start', 'ASC').limit(1);
        const obj = {
            item: current ? this.getScheduleItemFromDatabaseObject(current[0]) : null,
            next: nextone ? this.getScheduleItemFromDatabaseObject(nextone[0]) : null
        };
        return obj;
    }
    getScheduleNumberField() {
        return this.schema.schedule.number || DEFAULT_NUMBER_FIELD;
    }
    getSchedulePoolField() {
        return this.schema.schedule.pool || DEFAULT_POOL_FIELD;
    }
    getScheduleStartField() {
        return this.schema.schedule.start || DEFAULT_START_FIELD;
    }
    getScheduleItemDatabaseObjectFromRequest(update) {

        const obj = Object.assign({}, update);

        const poolField = this.getSchedulePoolField();
        if (poolField && poolField !== 'pool') {
            obj[poolField] = update.pool;
            delete obj.pool;
        }

        const numberField = this.getScheduleNumberField();
        if (numberField && numberField !== 'number') {
            obj[numberField] = update.number;
            delete obj.number;
        }

        return obj;
    }

    getScheduleItemFromDatabaseObject(obj) {
        if (!obj) return null;
        const item = Object.assign({}, obj);
        const poolField = this.getSchedulePoolField();
        if (poolField && poolField !== 'pool') {
            item.pool = obj[poolField];
            delete item[poolField];
        }
        const numberField = this.getScheduleNumberField();
        if (numberField && numberField !== 'number') {
            item.number = obj[numberField];
            delete item[numberField];
        }
        return item;
    }

}

module.exports = { Database: new database() }
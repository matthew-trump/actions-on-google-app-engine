const { Database } = require('./database');
const { ORM } = require('./orm');

const ALLOW_USER_STORAGE_ACCESS = process.env.ALLOW_USER_STORAGE_ACCESS || 0;

const accessor = class {
    constructor() {
        this.database = Database;
        if (process.env.SQL_DB_USERNAME) {
            this.database.initialize();
        } else {
            console.log("NO DATABASE CONNECTION CONFIGURED");
        }
    }

}
const DataAccessor = new accessor();
module.exports = DataAccessor;
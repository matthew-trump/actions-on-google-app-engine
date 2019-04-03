const { Database } = require('./database');
const { ORM } = require('./orm');

const ALLOW_USER_STORAGE_ACCESS = process.env.ALLOW_USER_STORAGE_ACCESS || 0;
const CONFIG_SCHEMA_PATH = process.env.CONFIG_SCHEMA_PATH;
const SCHEMA = require(CONFIG_SCHEMA_PATH);

const accessor = class {
    constructor() {
        this.database = Database;
        if (process.env.SQL_DB_USERNAME) {
            this.database.initialize(SCHEMA);
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

    loadScheduledPool(id, options, callback) {
        const c = this;
        if (options.forceReload) {
            console.log("FORCE RELOAD");
        }
        if (!this.database.db) {
            console.log("BYPASS LOAD SCHEDULED QUIZ ", id ? id : 'CURRENT');
            return;
        } else {
            console.log("LOADING SCHEDULED QUIZ ", id ? id : 'CURRENT');
        }
        this.database.getScheduledQuiz(id)
            .then((result) => {
                const scheduledQuiz = result[0];
                if (scheduledQuiz) {

                    const categoryId = scheduledQuiz.category;
                    const themeId = scheduledQuiz.theme;
                    const numQuestions = scheduledQuiz.number;
                    const key = this.getQuizKey(scheduledQuiz);



                    this.currentQuizKey = key;

                    //only load if not loaded previously;
                    if (forceReload || !this.quizBank[key]) {





                        const qObj = {};

                        qObj.options = {
                            selectBy: scheduledQuiz.randomize_user,
                            orderBy: scheduledQuiz.question_order,
                            numQuestions: scheduledQuiz.number,
                            categoryId: categoryId,
                            themeId: themeId
                        }
                        this.quizBank[key] = qObj;
                        c.loadQuizObjects(qObj)
                        if (callback) {
                            callback();
                        }



                        console.log("LOADED ", key)
                    } else {
                        console.log("RETAINED ", key)
                    }
                } else {
                    console.log("ERROR Current Scheduled Quiz not found");
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }

}
const DataAccessor = new accessor();
module.exports = DataAccessor;
const { Database } = require('./database');
const { ORM } = require('./orm');

const ALLOW_USER_STORAGE_ACCESS = process.env.ALLOW_USER_STORAGE_ACCESS || 0;

const accessor = class {

    constructor() {
        //this.marker = 1;
        this.database = Database;
        if (process.env.SQL_USER) {
            this.database.initialize();
        } else {
            console.log("NO DATABASE CONNECTION CONFIGURED");
        }
        /**
        this.loadCurrent(this);
        this.resetResults(this);

        this.orm = ORM;
        this.resetQuizLoadTimer();
        this.resetResultsWriterTimer();

        this.questionCacheMap = {};
        this.quizBank = {};
        this.currentQuizKey = null;
         */
    }
    /**
    resetQuizLoadTimer() {
        if (this.quizLoadTimer) {
            clearInterval(this.quizLoadTimer);
        }
        const interval_seconds = process.env.QUIZ_LOADER_TIMER_INTERVAL_SECONDS;
        if (interval_seconds && interval_seconds > 0) {
            const timeout = interval_seconds * 1000;
            console.log("QUIZ_LOADER_TIMER_INTERVAL_SECONDS " + timeout);
            this.quizLoadTimer = setInterval(() => { this.loadCurrentScheduledQuiz(this) }, timeout);
        }
    }

    resetResultsWriterTimer() {
        if (this.resultsWriterTimer) {
            clearInterval(this.resultsWriterTimer);
        }
        const interval_seconds = process.env.RESULTS_WRITER_TIMER_INTERVAL_SECONDS;
        if (interval_seconds && interval_seconds > 0) {
            const timeout = interval_seconds * 1000;
            console.log("RESULTS_WRITER_TIMER_INTERVAL_SECONDS " + timeout);
            this.resultsWriterTimer = setInterval(() => { this.writeCumulativeResultsToDatabase(this) }, timeout);
        }
    }
    resetResults(c) {
        const results = c.results;
        c.results = {};
        return results;
    }
    getCumulativeResultsUpdate(c) {
        const results = c.resetResults(c);
        const update = {};
        Object.keys(results).map(questionId => {
            const qResults = results[questionId];
            qResults.map((count, answerIndex) => {
                if (!update[answerIndex]) {
                    update[answerIndex] = {};
                }
                if (count > 0) {
                    if (!update[answerIndex][count]) {
                        update[answerIndex][count] = [];
                    }
                    update[answerIndex][count].push(questionId);
                }

            });
        });
        return update;
    }
    writeCumulativeResultsToDatabase(c) {
        const update = c.getCumulativeResultsUpdate(c);
        if (DEBUG_DATABASE_UPDATE) console.log("UPDATE", update);
        Object.keys(update).map(answerIndex => {

            Object.keys(update[answerIndex]).map(count => {
                Database.saveResults(update[answerIndex][count], {
                    test: DATABASE_RESULTS_TEST,
                    count: count,
                    answerIndex: answerIndex
                }).then(result => { });
            })
        })
    }
    getQuizKey(loadableQuiz) {
        const categoryId = loadableQuiz.category;
        const themeId = loadableQuiz.theme || 1;
        const numQuestions = loadableQuiz.number;
        const key = "QUIZ::" + categoryId + ":" + numQuestions + ":" + themeId;
        return key;
    }
    parseQuizKey(key) {
        if (!key || key.length < 6) {
            return null;
        }
        const text = key.substring(6);
        const segs = text.split(":");

        const loadOptions = {};
        if (segs.length > 0) {
            loadOptions.categoryId = parseInt(segs[0]);
            if (segs.length > 1) {
                loadOptions.numQuestions = parseInt(segs[1]);
                if (segs.length > 2) {
                    loadOptions.themeId = parseInt(segs[2]);
                }
            }
        }
        return loadOptions;
    }

    getCurrent() {
        return this.quizBank[this.currentQuizKey];
    }
    getLoadQuizFunction() {
        return () => { this.loadScheduledQuiz(this, null, true, null); }
    }
    loadCurrentScheduledQuiz(c) {
        this.loadScheduledQuiz(c, null, false, null)
    }
    loadScheduledQuiz(c, id, forceReload, callback) {
        if (forceReload) {
            console.log("FORCE RELOAD");
        }

        if (!Database.db) {
            console.log("BYPASS LOAD SCHEDULED QUIZ ", id ? id : 'CURRENT');
            return;
        } else {
            console.log("LOADING SCHEDULED QUIZ ", id ? id : 'CURRENT');
        }

        Database.getScheduledQuiz(id)
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
    getNumQuestions(conv) {
        if (conv.data.quiz) {
            return conv.data.quiz.questionIds.length;
        } else {
            return null;
        }
    }
    async loadQuizObjects(qObj) {
        const categoryId = qObj.options.categoryId;
        const themeId = qObj.options.themeId;

        console.log("LOADING QUIZ OBJECTS", categoryId, themeId);
        const c = this;
        await new Promise((resolve, reject) => {
            Database.getCategory(categoryId)
                .then(result => {
                    qObj.category = result[0];
                    const limit = categoryId > 0 ? 0 : 200;
                    Database.getQuestions(categoryId, true, limit)
                        .then(result => {

                            const questions = ORM.parseQuestions(result);

                            questions.map(q => {
                                if (!c.questionCacheMap[q.id]) {
                                    c.questionCacheMap[q.id] = {
                                        quiz: qObj.id || 0,
                                        date: new Date(),
                                        question: q
                                    }

                                }
                            });
                            qObj.questions = questions;
                            if (themeId) {
                                Database.getTheme(themeId)
                                    .then(result => {
                                        qObj.theme = result[0];

                                        resolve(qObj);

                                    })
                                    .catch(err => {
                                        console.log(err);
                                        reject(err);

                                    })
                            } else {
                                console.log("RETURNING RESOLVED PROMISE 2");

                                resolve(qObj);
                            }

                        })
                        .catch(err => {
                            console.log(err);
                            reject(err);
                        })

                })
                .catch(err => {

                    console.log(err);
                    reject(err);
                })
        });
        return;
    }



    selectQuestions(current, options, excluded) {
        const available = excluded ? current.questions.filter(q => {
            return excluded.indexOf(q.id) == -1;
        }) : current.questions;

        const length = available.length;
        let numQuestions = options.numQuestions || current.options.numQuestions || DEFAULT_NUM_QUESTIONS;

        const indices = new Set();
        if (numQuestions > length) {
            numQuestions = length;
        }
        for (let i = 0; i < numQuestions; i++) {
            const index = Math.floor(Math.random() * length);
            if (indices.has(index)) {
                i--;
                continue;
            }
            indices.add(index);
        }


        let selected = available.filter((q, i) => {
            return indices.has(i);
        });


        const field = "percentage_correct";
        selected.sort((qa, qb) => {
            if (qa[field] > qb[field])
                return -1;
            if (qa[field] < qb[field])
                return 1;
            let randomized = (.5 - Math.random()) > 0 ? 1 : -1;

            return randomized;
        });
        selected.map(q => this.shuffleAnswers(q));
        return selected;
    }

    generateQuiz(loaded, selected) {
        const quiz = {};
        quiz.id = loaded.id;
        quiz.questionIds = selected.map(q => q.id);
        quiz.questionIndex = 0;

        quiz.category = {
            id: loaded.category.id,
            name: loaded.category.name
        }
        if (loaded.theme) {
            quiz.theme = {
                id: loaded.theme.id,
                name: loaded.theme.name
            }
        }


        quiz.responses = [];
        quiz.score = [0, 0];
        return quiz;
    }

    async ensureLoaded(conv) {
        const key = conv.data.quiz.key;
        let qObj = this.quizBank[key];
        if (qObj) {
            return Promise.resolve(qObj);
        } else {
            qObj = {};
            qObj.options = this.parseQuizKey(key);

            await this.loadQuizObjects(qObj);
            this.quizBank[key] = qObj;
            return Promise.resolve(qObj);
        }
    }

    async startQuiz(conv, options) {

        let excluded = null;
        let cacheInstance = null;
        if (options.accessUserStorage && ALLOW_USER_STORAGE_ACCESS) {
            if (conv.user && conv.user.storage.asked) {
                excluded = conv.user.storage.asked;
            }
        } else if (SESSION_NO_REPEAT_QUESTIONS) {
            excluded = conv.data.quiz ? conv.data.quiz.asked : [];
        }
        let key;
        let loadOptions;
        if (conv.data.quiz
            && conv.data.quiz.load
            && conv.data.quiz.load.options) {

            loadOptions = {
                categoryId: parseInt(conv.data.quiz.load.options.categoryId),
                numQuestions: conv.data.quiz.load.options.numQuestions || DEFAULT_NUM_QUESTIONS,
                themeId: conv.data.quiz.load.options.themeId ? parseInt(conv.data.quiz.load.options.themeId) : 1
            }

            key = this.getQuizKey({
                category: loadOptions.categoryId,
                number: loadOptions.numQuestions,
                theme: loadOptions.themeId
            });
            delete conv.data.quiz.load;

        } else {
            cacheInstance =
                key = this.currentQuizKey;
        }

        await this.ensureLoaded({
            data: { quiz: { key: key } }
        });
        const qObj = this.quizBank[key];

        if (qObj) {
            const selected = this.selectQuestions(qObj, options, excluded);
            conv.data.quiz = this.generateQuiz(qObj, selected);
            conv.data.quiz.key = key;
            return Promise.resolve(selected);
        } else {
            //bad key: unable to parse load options from key
            console.log("ERROR XXXX-1");
            return Promise.reject("ERROR XXXX-1");
        }
    }


    getFormattedQuestionFromQEntry(qEntry, conv, options) {
        if (options.flattenedForm) {
            if (!qEntry.flattened) {
                qEntry.flattened = this.getFlattenedForm(qEntry.question, conv.data.quiz.category);
            }
            return qEntry.flattened;
        } else {
            return qEntry.question;
        }
    }
     */
    async getQuestion(conv, options = {}) {

        const qIndex = typeof options.questionIndex !== 'undefined' ? options.questionIndex : conv.data.questionIndex;
        const categoryId = conv.data.quiz.category.id;
        const qId = conv.data.quiz.questionIds[qIndex];

        let qEntry = this.questionCacheMap[qId];
        if (!qEntry) {
            //might occur in edge case of load distributed quiz rollover
            //or in customized quiz
            await this.loadQuizObjects({ options: { categoryId: categoryId } })

            qEntry = this.questionCacheMap[qId];

            if (qEntry) {
                return this.getFormattedQuestionFromQEntry(qEntry, conv, options);
            } else {
                //this should never happen.
                console.log("ERROR unable to load QENTRY #354-B. RETURNINNG EMPTY QUESTION", qId, categoryId);
                return {};
            }

        } else {
            return this.getFormattedQuestionFromQEntry(qEntry, conv, options);
        }
        /**
        if(qEntry){
           
              
        }else{ 
            

            //should only happen in edge case:
            //if user is in midst of quiz during a rollover to a new scheduled quiz
            //AND there is heavy load such that user's quiz's questions are not in question map of a new spun up app engine instance
            this.loadScheduledQuiz(this,conv.data.quiz.id,()=>{
                qEntry      = this.questionCacheMap[qId];
                if(qEntry){
                    //const question = this.shuffleAnswers(qEntry.question,options);
                    if(options.flattenedForm){
                        return this.getFlattenedForm(question,conv.data.quiz.category)
                    }else{
                        return question;
                    }
                }
            })   
        }
         */
    }
    /**
    shuffleAnswers(question) {
        //shuffle answers
        question.answers = question.answers
            .map((a) => ({ sort: Math.random(), value: a }))
            .sort((a, b) => a.sort - b.sort)
            .map((a) => a.value);
    }
    //conversion to object form usable by Parker's component (hq-node-app) and Canvas app
    getFlattenedForm(question, category) {
        return {
            id: question.id,
            text: question.text,
            category: category.name,
            followup: "",
            answers: question.answers.map(answer => {
                return {
                    isCorrect: answer.isCorrect,
                    index: answer.index,
                    text: answer.text,
                    stat: answer.responses,
                    synonyms: answer.synonyms.map(s => s.text)
                }
            })
        }
    }

    async matchAnswer(conv) {
        this.setLatest(conv, null);
        let query = conv.query;

        let questionIndex = -1;
        let answerIndex = -1;
        let answered;

        const quiz = conv.data.quiz;

        questionIndex = typeof conv.data.questionIndex !== 'undefined' ? conv.data.questionIndex : quiz.questionIndex;

        const question = await this.getQuestion(conv, { questionIndex: questionIndex })
        if (question) {
            answered = question.answers.filter(a => a.text === query);
            if (answered && answered.length > 0) {
                answerIndex = answered[0].index;
            }
        }
        this.setLatest(conv, { questionIndex: questionIndex, answerIndex: answerIndex });

        return answerIndex;

    }
    recordResponse(conv) {

        const quiz = conv.data.quiz;
        const latest = quiz.latest;

        if (latest) {
            const questionIndex = latest.questionIndex;
            const answerIndex = latest.answerIndex;

            const questionId = quiz.questionIds[questionIndex];
            const score = quiz.score;
            score[0] = score[0] + 1;
            if (answerIndex == 0) {
                score[1] = score[1] + 1;
            }

            quiz.responses.push([questionId, answerIndex]);

            quiz.questionIndex = questionIndex + 1;


            if (!conv.data.quiz.asked) {
                conv.data.quiz.asked = [];
            }
            conv.data.quiz.asked.push(questionId);

            return {
                total: score[0],
                correct: score[1]
            }
        } else {
            return {
                total: -1,
                correct: -1
            }
        }
    }
    setLatest(conv, latest) {
        conv.data.quiz.latest = latest;
    }
    saveResults(conv, options = {}) {

        const quiz = conv.data.quiz;
        const responses = quiz.responses;

        if (responses) {

            responses.map(r => {
                const questionId = r[0];
                const answerIndex = r[1];

                if (!this.results[questionId]) {
                    this.results[questionId] = [0, 0, 0];
                }
                const results = this.results[questionId];

                results[answerIndex] = results[answerIndex] + 1;

            });



            if (options.accessUserStorage && ALLOW_USER_STORAGE_ACCESS) {
                if (!conv.user.storage.asked) {
                    conv.user.storage.asked = [];
                }
                conv.user.storage.asked.concat(asked);

            }
        }


    }
     */
}

module.exports = new accessor()
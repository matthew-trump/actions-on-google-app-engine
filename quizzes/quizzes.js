const { Rounds } = require('../data-accessor');
const { Question, QUESTION_TYPES } = require('./question');


const QUESTION_TYPE = process.env.QUESTION_TYPE;

class Quizzes {

    constructor() { }
    async ensureLoaded(conv) {
        return Rounds.ensureLoaded(conv);
    }
    async startQuiz(conv, options) {
        const items = await Rounds.startRound(conv, options);
        conv.data.round.score = 0;

        if (typeof conv.data.taken === 'undefined') {
            //console.log("conv.data.round.taken undefined")
            conv.data.taken = 0
        } else {
            //console.log("conv.data.round.taken defined", conv.data.round.taken)
            conv.data.taken += 1;
        }
        //console.log("set to", conv.data.taken);

        return items;
    }
    async getQuestion(conv, options) {
        const item = await Rounds.getItem(conv, options);
        const question = Question.getQuestion(item, QUESTION_TYPE);

        if (options.shuffle) {
            question.answers = question.getShuffledAnswers();
            const indices = question.answers.map(a => a.index);

            conv.data.round.indices = indices;

        } else if (options.keepLastOrder && conv.data.round.indices) {
            question.answers = conv.data.round.indices.map((index) => {
                return question.answers.filter(a => { return a.index === index })[0]
            });
        }
        return question;
    }
    setLatest(conv, latest) {
        Rounds.setLatest(conv, latest);
        console.log("conv.data.round.latest", conv.data.round.latest);
    }
    recordResponse(conv) {
        Rounds.recordResponse(conv);
        conv.data.round.shown.push(conv.data.round.items[conv.data.round.latest.questionIndex]);
        console.log("SHOWN", conv.data.round.shown);
    }
    saveResults(conv, options) {

    }
    numQuestions(conv) {
        return conv.data.round.items.length;
    }



}

module.exports = new Quizzes();
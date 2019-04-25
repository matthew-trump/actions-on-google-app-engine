const { Rounds } = require('../data-accessor');
const shuffleArray = require('shuffle-array');
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
        const question = this.parseQuestion(item);
        //console.log("GET QUESTION shuffle", options.questionIndex, options.shuffle);
        if (options.shuffle) {
            //console.log("SHUFFLE ARRAY", shuffleArray([0, 1, 2]));
            question.answers = shuffleArray(question.answers);
            const indices = question.answers.map(a => a.index);

            conv.data.round.indices = indices;
            //console.log("INDICES SET", conv.data.round.indices);

        } else if (options.keepLastOrder && conv.data.round.indices) {
            question.answers = conv.data.round.indices.map((index) => {
                return question.answers.filter(a => { return a.index === index })[0]
            });
        }
        return question;
    }
    setLatest(conv, latest) {
        console.log("LATEST", latest);
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
    parseSynonyms(synonyms) {

        if (!synonyms) {
            return [];
        }
        return synonyms.split(":").map(s => {
            return { text: s }
        })
    }
    parseQuestion(q) {
        let total_responses = q.answer_correct_responses
            + q.answer_incorrect_1_responses
            + q.answer_incorrect_2_responses;
        let percentage_correct = total_responses != 0 ? (q.answer_correct_responses / total_responses) : 0.0;
        return {
            id: q.id,
            text: q.text,
            category: q.category,
            status: q.status,
            order: q.order,

            type: q.type,
            source: q.source,
            datetime: q.datetime,

            answers: [
                {
                    index: 0,
                    isCorrect: true,
                    text: q.answer_correct,
                    responses: q.answer_correct_responses,
                    synonyms: this.parseSynonyms(q.answer_correct_synonyms)
                },
                {
                    index: 1,
                    isCorrect: false,
                    text: q.answer_incorrect_1,
                    responses: q.answer_incorrect_1_responses,
                    synonyms: this.parseSynonyms(q.answer_incorrect_1_synonyms)
                },
                {
                    index: 2,
                    isCorrect: false,
                    text: q.answer_incorrect_2,
                    responses: q.answer_incorrect_2_responses,
                    synonyms: this.parseSynonyms(q.answer_incorrect_2_synonyms)
                }
            ],
            total_responses: total_responses,
            percentage_correct: percentage_correct
        }
    }


}

module.exports = new Quizzes();
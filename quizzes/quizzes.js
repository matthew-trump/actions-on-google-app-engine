const { Rounds } = require('../data-accessor');

class Quizzes {

    constructor() { }
    async ensureLoaded(conv) {
        return Rounds.ensureLoaded(conv);
    }
    async startQuiz(conv, options) {
        const items = await Rounds.startRound(conv, options);
        conv.data.round.score = 0;
        return items;
    }
    async getQuestion(conv, options) {
        const item = await Rounds.getItem(conv, options);
        return this.parseQuestion(item);
    }
    setLatest(conv, options) {

    }
    recordResponse(conv) {

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
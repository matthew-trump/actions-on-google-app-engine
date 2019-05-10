const QUESTION_TYPES = {
    SIMPLE: "simple",
    DELUXE: "deluxe"
}
const ANSWER_SET_TYPES = {
    STANDARD: 1,
    NUMERIC: 2,
    ORDINAL: 3,
    ALPHABETIC: 4,
    TRUE_FALSE: 5

}
const shuffleArray = require('shuffle-array');

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

class Question {
    constructor() {
        const results = [0, 0, 0];
        for (let i = 0; i < 10000; i++) {
            const random = getRandomArbitrary(0, 3);
            //console.log("random placement", random);
            const placement = Math.floor(random);
            results[placement] = results[placement] + 1;
        }
        console.log("RESULTS", results);
    }

    getQuestion(obj, type) {
        switch (type) {
            case QUESTION_TYPES.SIMPLE:
                return new QuestionSimple(obj);
            case QUESTION_TYPES.DELUXE:
                return new QuestionDeluxe(obj);
            default:
                return null;
        }
    }

}

class QuestionSimple {
    constructor(q) {
        let total_responses = q.answer_correct_responses
            + q.answer_incorrect_1_responses
            + q.answer_incorrect_2_responses;
        let percentage_correct = total_responses != 0 ? (q.answer_correct_responses / total_responses) : 0.0;


        this.id = q.id;
        this.text = q.text;
        this.category = q.category;
        this.status = q.status;
        this.order = q.order;

        this.type = q.type;
        this.source = q.source;
        this.datetime = q.datetime;

        this.answers = [
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
        ];
        this.total_responses = total_responses;
        this.percentage_correct = percentage_correct;
    }
    parseSynonyms(synonyms) {

        if (!synonyms) {
            return [];
        }
        return synonyms.split(":").map(s => {
            return { text: s }
        })
    }
    getShuffledAnswers() {
        return shuffleArray(this.answers);
    }
}

class QuestionDeluxe {

    constructor(q) {
        this.id = q.id;
        this.text = q.text;
        this.type = q.type;
        this.difficulty = q.difficulty;

        const useFalseKeys = this.selectFalse(q);
        console.log("useFalseKeys", useFalseKeys);
        this.answers = [
            {
                index: 0,
                isCorrect: true,
                text: q.answer
            },
            {
                index: 1,
                isCorrect: false,
                text: q[useFalseKeys[0]]

            },
            {
                index: 2,
                isCorrect: false,
                text: q[useFalseKeys[1]]

            }
        ];

    }
    selectFalse(q) {
        const falseKeys = [];
        for (let i = 0; i < 10; i++) {
            const key = 'false_' + i;
            const falseAnswer = q[key];
            if (falseAnswer) {
                falseKeys.push(key)
            }
        }

        const useKeys = [];
        if (q.type === ANSWER_SET_TYPES.NUMERIC) {
            const random = getRandomArbitrary(0, 3);
            console.log("random placement", random);
            const placement = Math.floor(random);
            console.log("placement", placement);
            const answer = q.answer;
            const smaller = falseKeys.filter(key => {
                return q[key] < answer;
            });
            const larger = falseKeys.filter(key => {
                return q[key] > answer;
            })
            shuffleArray(smaller);
            shuffleArray(larger);
            console.log("NUMERIC===");
            console.log("placement", placement);
            console.log("smaller", smaller);
            console.log("larger", larger);

            switch (placement) {
                case 0:
                    useKeys.push(smaller.pop());
                    useKeys.push(smaller.pop());
                    break;
                case 1:
                    useKeys.push(smaller.pop());
                    useKeys.push(larger.pop());
                case 2:
                    useKeys.push(larger.pop());
                    useKeys.push(larger.pop());
            }

        } else {
            shuffleArray(falseKeys);
            useKeys.push(falseKeys.pop());
            useKeys.push(falseKeys.pop());
        }
        return useKeys;

    }
    getShuffledAnswers() {
        if (this.type === ANSWER_SET_TYPES.NUMERIC) {
            this.answers.sort((a, b) => {
                if (a.text < b.text) return -1;
                if (b.text < a.text) return 1;
                return 0;
            });
            return this.answers;
        } else {
            return shuffleArray(this.answers);
        }

    }
}

module.exports = { Question: new Question(), QUESTION_TYPES: QUESTION_TYPES }
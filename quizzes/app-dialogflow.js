const express = require('express');
const router = express.Router();

const { dialogflow } = require('actions-on-google');
const app = dialogflow();

const { ACTIONS, INTENT, CONTEXT } = require('./actions-on-google-constants');
const IMMERSIVE_URL = process.env.IMMERSIVE_URL;

const GAME = INTENT.GAME;
const STATE = {
    INTRO: "intro",
    QUESTION: "question",
    SCORE: "score"
}

const ssmlResponder = require('./ssmlResponder');
const levenshtein = require("levenshtein");

const {
    BasicCard,
    Image,
    Suggestions,
    SimpleResponse
} = require("actions-on-google")

//const Quizzes = require("./quizzes");

const useImmersiveContent = conv => {
    return IMMERSIVE_URL && conv.surface.capabilities.has(ACTIONS.CAPABILITY_CUSTOM_STAGE);
}

const normalizeValue = (value) => {
    return (value + "")
        .toLocaleLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
        .replace(/ /g, "");
}

const getAnswerIndex = (answers, choice) => {
    const ctext = normalizeValue(choice);
    if (ctext.length > 0) {
        const result = answers
            .filter((answer) => {
                const atext = normalizeValue(answer.text);
                return (atext.length > 0 && new levenshtein(ctext, atext).distance <= 1);
            })
            .map((answer) => {
                return answer.index;
            });
        if (result.length > 0) {
            return result[0]
        }
    }
    return -1;
}


app.intent(GAME.START, async (conv) => {
    /** 
    await Quizzes.startQuiz(conv, { accessUserStorage: true });

    conv.data.questionIndex = 0;
    conv.data.score = 0
    conv.data.repeat = false;
    conv.data.questionsAnswered = []
    conv.data.answered = false;
    conv.data.quizL = Quizzes.getNumQuestions(conv);

    const question = await Quizzes.getQuestion(conv, { questionIndex: conv.data.questionIndex, flattenedForm: true });

    const welcomeReponse = ssmlResponder.getWelcomeResponse(conv.user.last.seen);
    const questionResponse = ssmlResponder.getQuestionResponse(question, conv.data.questionIndex, conv.data.repeat);

    if (useImmersiveContent(conv)) {
        conv.ask(
            {
                immersiveResponse: {
                    loadImmersiveUrl: IMMERSIVE_URL,
                    updatedState: {
                        view: STATE.INTRO,
                        returning: conv.user.last.seen ? true : false,
                        SSML: welcomeReponse.ssml,
                        questionSSML: questionResponse.ssml,
                        question: question,
                        questionIndex: conv.data.questionIndex,
                        quizLength: conv.data.quizL
                    }
                }
            }
        )
    } else {
        conv.ask(
            new SimpleResponse({
                speech: welcomeReponse.ssml,
                text: welcomeReponse.text
            }),
            questionResponse.ssml,
            new Suggestions(questionResponse.choices)
        )
    }
    conv.contexts.set(GAME.ANSWER, 1)
    */
})
app.intent(GAME.CHOICE_ANSWER, async (conv) => {
    /** 
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { questionIndex: conv.data.questionIndex, flattenedForm: true });
    const answerIndex = getAnswerIndex(question.answers, conv.query);
    const correct = answerIndex === 0;
    const recognized = answerIndex !== -1;

    console.log("answerIndex", answerIndex, question, conv.data.questionIndex);
    if (recognized) {
        Quizzes.setLatest(conv, { questionIndex: conv.questionIndex, answerIndex: answerIndex });
        Quizzes.recordResponse(conv);

        conv.data.repeat = false;
        conv.data.answered = true;
        conv.data.questionIndex += 1;
        if (correct) {
            conv.data.score += 1;
        }

        const answerResponse = correct ? ssmlResponder.getAnswerCorrectResponse() : ssmlResponder.getAnswerWrongResponse();

        const complete = conv.data.questionIndex === conv.data.quizL;
        if (complete) {
            Quizzes.saveResults(conv, { accessUserStorage: true })
        }
        if (useImmersiveContent(conv)) {
            if (!complete) {
                const nextQuestion = await Quizzes.getQuestion(conv, { questionIndex: conv.data.questionIndex, flattenedForm: true });
                const questionResponse = ssmlResponder.getQuestionResponse(nextQuestion, conv.data.questionIndex, conv.data.repeat);
                conv.ask({
                    immersiveResponse: {
                        updatedState: {
                            view: STATE.QUESTION,
                            answerIndex: answerIndex,
                            questionSSML: questionResponse.ssml,
                            checkSSML: answerResponse.ssml,
                            question: question,
                            questionIndex: conv.data.questionIndex,
                            repeat: conv.data.repeat,
                            score: conv.data.score
                        }
                    }
                })
            } else {

                const finalScoreResponse = ssmlResponder.getFinalScoreResponse(conv.data.score, conv.data.quizL);
                conv.ask({
                    immersiveResponse: {
                        updatedState: {
                            view: STATE.SCORE,
                            SSML: finalScoreResponse.ssml,
                            score: conv.data.score,
                            checkSSML: answerResponse.ssml,
                            answerIndex: answerIndex
                        }
                    }
                })
                conv.contexts.set(CONTEXT.GAME_RESTART, 1);
            }

        } else {
            if (!complete) {
                const nextQuestion = await Quizzes.getQuestion(conv, { questionIndex: conv.data.questionIndex, flattenedForm: true });
                const questionPrompt = ssmlResponder.getQuestionPrompt(nextQuestion, conv.data.questionIndex, conv.data.repeat);
                conv.ask(
                    answerResponse.ssml,
                    questionPrompt.ssml,
                    new Suggestions(questionPrompt.choices)
                )
            } else {
                const finalScoreResponse = ssmlResponder.getFinalScoreResponse(conv.data.score, conv.data.quizL);

                const finalScoreCard = new BasicCard({
                    title: `Your Final Score is ${score}`,
                    image: new Image({
                        url: `https://dummyimage.com/1024x576/36399A/ffffff&text=${score}!`,
                        alt: "Your Score "
                    }),
                    display: "CROPPED"
                })

                conv.ask(
                    finalScoreResponse.ssml,
                    finalScoreCard,
                    new Suggestions(["yes", "no"])
                )
                conv.contexts.set(CONTEXT.GAME_RESTART, 1);
            }
        }


    } else {
        conv.data.answered = false
        conv.data.repeat = true
        const answerResponse = ssmlResponder.getAnswerUnrecognizedResponse();
        const questionResponse = ssmlResponder.getQuestionResponse(question, conv.data.questionIndex, conv.data.repeat);
        if (useImmersiveContent(conv)) {
            conv.ask({
                immersiveResponse: {
                    updatedState: {
                        view: STATE.QUESTION,
                        answerIndex: answerIndex,
                        questionSSML: questionResponse.ssml,
                        checkSSML: answerResponse.ssml,
                        question: question,
                        questionIndex: conv.data.questionIndex,
                        repeat: conv.data.repeat,
                        score: conv.data.score
                    }
                }
            })
        } else {
            conv.ask(
                answerResponse.ssml,
                questionResponse.ssml,
                new Suggestions(questionResponse.choicess)
            )
        }

    }
    */
});


router.use(app);
module.exports = router;
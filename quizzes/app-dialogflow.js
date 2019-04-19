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

const Quizzes = require("./quizzes");

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
const getAnswerIndexOrdinal = (answers, ordinal) => {
    //console.log("getAnswerIndexOrdinal", answers, ordinal);
    if (ordinal < answers.length) {
        return answers[ordinal].index;
    } else {
        return -1;
    }

}


app.intent(GAME.START, async (conv) => {
    return startNewQuiz(conv, conv.user.last.seen)
});
app.intent(GAME.RESTART_YES, async (conv) => {
    return startNewQuiz(conv, true)
});
app.intent(GAME.RESTART_NO, async (conv) => {
    conv.close(
        new SimpleResponse(ssmlResponder.getGameEndResponse())
    );
})
app.intent(GAME.QUIT, async (conv) => {
    conv.close();
})

startNewQuiz = async (conv, returning) => {
    await Quizzes.startQuiz(conv, { accessUserStorage: true });

    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index, shuffle: true });

    const welcomeResponse = ssmlResponder.getWelcomeResponse(returning);
    const questionResponse = ssmlResponder.getQuestionResponse(question, conv.data.round.index, conv.data.round.items.length, false);

    useImmersiveContent(conv) ? conv.ask(
        {
            immersiveResponse: {
                loadImmersiveUrl: IMMERSIVE_URL,
                updatedState: {
                    view: STATE.INTRO,
                    taken: conv.data.taken,
                    length: conv.data.round.items.length,
                    questionIndex: conv.data.round.index,
                    welcome: welcomeResponse.ssml,
                    prompt: questionResponse.ssmlPrompt,
                    question: {
                        ssml: questionResponse.ssmlQuestion,
                        text: questionResponse.text,
                        choices: questionResponse.choices
                    }
                }
            }
        })
        : conv.ask(new SimpleResponse({
            speech: welcomeResponse.ssml,
            text: welcomeResponse.text
        }),
            questionResponse.ssmlPrompt,
            questionResponse.ssmlQuestion,
            new Suggestions(questionResponse.choices))

    conv.contexts.set(GAME.ANSWER, 1)
}
app.intent(GAME.QUESTION_REPEAT, async (conv, params) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index, keepLastOrder: true });
    if (useImmersiveContent(conv)) {

        const questionResponse = ssmlResponder.getQuestionResponse(question, conv.data.round.index, conv.data.round.items.length, true);
        conv.ask({
            immersiveResponse: {
                updatedState: {
                    view: STATE.QUESTION,
                    repeat: true,
                    questionIndex: conv.data.round.index,
                    prompt: questionResponse.ssmlPrompt,
                    question: {
                        ssml: questionResponse.ssmlQuestion,
                        text: questionResponse.text,
                        choices: questionResponse.choices
                    }
                }
            }
        })

    } else {
        /** 
        if (!complete) {
            const nextQuestion = await Quizzes.getQuestion(conv, { questionIndex: conv.data.round.index });
            const questionResponse = ssmlResponder.getQuestionResponse(nextQuestion, conv.data.round.index, false);
            conv.ask(
                answerResponse.ssml,
                questionResponse.ssmlPrompt,
                questionResponse.ssmlQuestion,
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
        */
    }

});

app.intent(GAME.CHOICE_ORDINAL, async (conv, params) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index });
    const answerIndex = getAnswerIndexOrdinal(question.answers, conv.data.round.indices[params.ordinal]);
    return handleAnswerChoice(conv, question, answerIndex);
});

app.intent(GAME.CHOICE_MIDDLE, async (conv) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index });
    const answerIndex = getAnswerIndexOrdinal(question.answers, conv.data.round.indices[1]);
    return handleAnswerChoice(conv, question, answerIndex);
});
app.intent(GAME.CHOICE_LAST, async (conv) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index });
    const answerIndex = getAnswerIndexOrdinal(question.answers, conv.data.round.indices[2]);
    return handleAnswerChoice(conv, question, answerIndex);
});

app.intent(GAME.CHOICE_ANSWER, async (conv) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index });
    const answerIndex = getAnswerIndex(question.answers, conv.query);
    return handleAnswerChoice(conv, question, answerIndex);
});

handleAnswerChoice = async (conv, question, answerIndex) => {

    const correct = answerIndex === 0;
    const recognized = answerIndex !== -1;

    if (recognized) {
        Quizzes.setLatest(conv, { questionIndex: conv.data.round.index, answerIndex: answerIndex });
        Quizzes.recordResponse(conv);

        conv.data.round.index += 1;
        if (correct) {
            conv.data.round.score += 1;
        }

        const answerResponse = correct ? ssmlResponder.getAnswerCorrectResponse() : ssmlResponder.getAnswerWrongResponse();

        const complete = conv.data.round.index === conv.data.round.items.length;

        if (complete) {
            Quizzes.saveResults(conv, { accessUserStorage: true })
        }
        if (useImmersiveContent(conv)) {
            if (!complete) {
                const nextQuestion = await Quizzes.getQuestion(conv, { index: conv.data.round.index, shuffle: true });
                const questionResponse = ssmlResponder.getQuestionResponse(nextQuestion, conv.data.round.index, conv.data.round.items.length, false);
                conv.ask({
                    immersiveResponse: {
                        updatedState: {
                            view: STATE.QUESTION,
                            answerIndex: answerIndex,
                            answer: answerResponse.ssml,
                            repeat: false,
                            questionIndex: conv.data.round.index,
                            score: conv.data.round.score,
                            prompt: questionResponse.ssmlPrompt,
                            question: {
                                ssml: questionResponse.ssmlQuestion,
                                text: questionResponse.text,
                                choices: questionResponse.choices
                            }
                        }
                    }
                })
            } else {

                const finalScoreResponse = ssmlResponder.getFinalScoreResponse(conv.data.round.score, conv.data.round.items.length);
                conv.ask({
                    immersiveResponse: {
                        updatedState: {
                            view: STATE.SCORE,
                            score: conv.data.round.score,
                            answer: answerResponse.ssml,
                            finalScore: finalScoreResponse.ssml,
                            answerIndex: answerIndex
                        }
                    }
                })
                conv.contexts.set(CONTEXT.GAME_RESTART, 1);
            }

        } else {
            /** 
            if (!complete) {
                const nextQuestion = await Quizzes.getQuestion(conv, { questionIndex: conv.data.round.index });
                const questionResponse = ssmlResponder.getQuestionResponse(nextQuestion, conv.data.round.index, false);
                conv.ask(
                    answerResponse.ssml,
                    questionResponse.ssmlPrompt,
                    questionResponse.ssmlQuestion,
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
            */
        }


    } else {

        const repeat = true
        const answerResponse = ssmlResponder.getAnswerUnrecognizedResponse();
        const questionResponse = ssmlResponder.getQuestionResponse(question, conv.data.round.index, conv.data.round.items.length, repeat);
        if (useImmersiveContent(conv)) {
            conv.ask({
                immersiveResponse: {
                    updatedState: {
                        view: STATE.QUESTION,
                        answerIndex: answerIndex,
                        answer: answerResponse.ssml,
                        prompt: questionResponse.ssmlPrompt,
                        question: {
                            ssml: questionResponse.ssmlQuestion,
                            text: questionResponse.text,
                            choices: questionResponse.choices
                        },
                        questionIndex: conv.data.questionIndex,
                        repeat: repeat,
                        score: conv.data.round.score
                    }
                }
            })
        } else {
            /** 
            conv.ask(
                answerResponse.ssml,
                questionResponse.ssml,
                new Suggestions(questionResponse.choicess)
            )
            */
        }

    }


};
app.intent(GAME.SCORE, async (conv) => {
    await Quizzes.ensureLoaded(conv);
    const complete = conv.data.round.index >= conv.data.round.items.length;
    if (complete) {

        const finalScoreResponse = ssmlResponder.getFinalScoreResponse(conv.data.round.score, conv.data.round.items.length);
        conv.ask({
            immersiveResponse: {
                updatedState: {
                    view: STATE.SCORE,
                    score: conv.data.round.score,
                    finalScore: finalScoreResponse.ssml
                }
            }
        })
        conv.contexts.set(CONTEXT.GAME_RESTART, 1);
    } else {
        const repeat = true;
        const scoreResponse = ssmlResponder.getScoreResponse(conv.data.round.score, conv.data.round.index + 1);
        const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index, keepLastOrder: true });
        const questionResponse = ssmlResponder.getQuestionResponse(question, conv.data.round.index, conv.data.round.items.length, repeat);
        conv.ask(scoreResponse.ssml, questionResponse.ssmlPrompt, questionResponse.ssmlQuestion);

    }

})


router.use(app);
module.exports = router;
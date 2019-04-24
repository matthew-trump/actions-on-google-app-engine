const express = require('express');
const router = express.Router();

const { dialogflow } = require('actions-on-google');
const app = dialogflow();

const { ACTIONS, INTENT, CONTEXT } = require('./actions-on-google-constants');
const IMMERSIVE_URL = process.env.IMMERSIVE_URL;

const GAME = INTENT.GAME;
const STATE = {
    WELCOME: "welcome",
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



app.intent(GAME.START, async (conv) => {
    return startNewQuiz(conv, conv.user.last.seen)
});
app.intent("moo", async (conv) => {
    conv.ask('moooo!');
});

app.intent(GAME.QUESTION_REPEAT, async (conv, params) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index, keepLastOrder: true });
    const questionResponse = ssmlResponder.getQuestionResponse(question, conv.data.round.index, conv.data.round.items.length, true);
    if (useImmersiveContent(conv)) {

        conv.ask({
            immersiveResponse: {
                updatedState: {
                    view: STATE.QUESTION,
                    question: {
                        repeat: true,
                        speech: questionResponse.ssml,
                        text: question.text,
                        answers: question.answers
                    }
                }
            }
        })

    } else {
        conv.ask(
            new SimpleResponse({
                speech: questionResponse.ssml,
                text: questionResponse.text,

            }),
            new Suggestions(questionResponse.choices)
        )

    }
    conv.contexts.set(GAME.ANSWER, 1);
});

app.intent(GAME.CHOICE_ORDINAL, async (conv, params) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index });
    const matchIndex = parseInt(params.ordinal);
    const answerIndex = getAnswerIndexFromOrdinal(question.answers, conv.data.round.indices[matchIndex]);
    return handleAnswerChoice(conv, question, matchIndex, answerIndex);
});

app.intent(GAME.CHOICE_MIDDLE, async (conv) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index });
    const matchIndex = 1;
    const answerIndex = getAnswerIndexFromOrdinal(question.answers, conv.data.round.indices[matchIndex]);
    return handleAnswerChoice(conv, question, matchIndex, answerIndex);
});
app.intent(GAME.CHOICE_LAST, async (conv) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index });
    const matchIndex = 2;
    const answerIndex = getAnswerIndexFromOrdinal(question.answers, conv.data.round.indices[matchIndex]);
    return handleAnswerChoice(conv, question, matchIndex, answerIndex);
});
app.intent(GAME.CHOICE_ANSWER, async (conv) => {
    await Quizzes.ensureLoaded(conv);
    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index });
    const answerIndex = getAnswerIndexFromQueryMatch(question.answers, conv.query);
    console.log("ANSWER INDEX", answerIndex, conv.data.round.indices);
    const matchIndex = conv.data.round.indices.indexOf(answerIndex);
    console.log("MATCH INDEX", matchIndex);
    return handleAnswerChoice(conv, question, matchIndex, answerIndex);
});
app.intent(GAME.SCORE, async (conv) => {
    await Quizzes.ensureLoaded(conv);
    const complete = conv.data.round.index >= conv.data.round.items.length;
    if (complete) {

        const finalScoreResponse = ssmlResponder.getFinalScoreResponse(conv.data.round.score, conv.data.round.items.length);
        conv.ask({
            immersiveResponse: {
                updatedState: {
                    view: STATE.SCORE,
                    score: {
                        speech: finalScoreResponse.ssml,
                        value: conv.data.round.score
                    }
                }
            }
        })
        conv.contexts.set(CONTEXT.GAME_RESTART, 1);
    } else {
        const scoreResponse = ssmlResponder.getScoreResponse(conv.data.round.score, conv.data.round.index + 1);
        //const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index, keepLastOrder: true });
        //const questionResponse = ssmlResponder.getQuestionResponse(question, conv.data.round.index, conv.data.round.items.length, repeat);

        conv.ask(
            new SimpleResponse(
                {
                    speech: scoreResponse.ssml,
                    text: scoreResponse.text
                })
        )
    }

})
app.intent(GAME.RESTART, async (conv) => {
    const query = conv.query;
    const restart = query.toLowerCase().split(" ").indexOf("yes") !== -1;
    console.log("GAME RESTART", query, restart);
    if (restart) {
        return startNewQuiz(conv, true)
    } else {
        conv.close();
    }
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



const useImmersiveContent = conv => {
    return IMMERSIVE_URL && conv.surface.capabilities.has(ACTIONS.CAPABILITY_CUSTOM_STAGE);
}

const normalizeValue = (value) => {
    return (value + "")
        .toLocaleLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
        .replace(/ /g, "");
}

const isMatched = (answer, ctext) => {
    const atext = normalizeValue(answer.text);
    return atext.length > 0 && new levenshtein(ctext, atext).distance <= 1;
}
const getAnswerIndexFromQueryMatch = (answers, choice) => {
    console.log("getAnswerIndexFromQueryMatch", answers, choice);
    const ctext = normalizeValue(choice);
    let match = -1;
    if (ctext.length > 0) {
        answers.forEach((answer, index) => {
            if (isMatched(answer, ctext) && match < 0) {
                console.log("FOUND MATCH AT", index);
                match = index;
            }
        });
    }
    return match;
}

const getAnswerIndexFromOrdinal = (answers, ordinal) => {
    if (ordinal < answers.length) {
        return answers[ordinal].index;
    } else {
        return -1;
    }

}
const startNewQuiz = async (conv, returning) => {
    await Quizzes.startQuiz(conv, { accessUserStorage: true });

    const question = await Quizzes.getQuestion(conv, { index: conv.data.round.index, shuffle: true });

    const welcomeResponse = conv.data.taken < 1 ? ssmlResponder.getWelcomeResponse(returning, conv.data.round.items.length, conv.data.round.category.name)
        : ssmlResponder.getAnotherRoundResponse(conv.data.round.items.length, conv.data.round.category.name);
    const questionResponse = ssmlResponder.getQuestionResponse(question, conv.data.round.index, conv.data.round.items.length, false, conv.data.round.category.name, conv.data.taken);

    useImmersiveContent(conv) ? conv.ask(
        {
            immersiveResponse: {
                loadImmersiveUrl: IMMERSIVE_URL,
                updatedState: {
                    view: STATE.WELCOME,
                    quiz: {
                        index: conv.data.taken,
                        length: conv.data.round.items.length,
                        category: conv.data.round.category.name
                    },
                    welcome: {
                        returning: !!returning,
                        speech: welcomeResponse.ssml
                    },
                    question: {
                        speech: questionResponse.ssml,
                        text: question.text,
                        answers: question.answers
                    }
                }
            }
        })
        : conv.ask(
            new SimpleResponse({
                speech: welcomeResponse.ssml,
                text: welcomeResponse.text
            }),
            new SimpleResponse({
                speech: questionResponse.ssml,
                text: questionResponse.text
            }),
            new Suggestions(questionResponse.choices))

    conv.contexts.set(GAME.ANSWER, 1);
}


handleAnswerChoice = async (conv, question, matchIndex, answerIndex) => {

    const correct = answerIndex === 0;
    const recognized = answerIndex !== -1;
    const correctIndex = conv.data.round.indices.indexOf(0);

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
                            answer: {
                                speech: answerResponse.ssml,
                                matchIndex: matchIndex,
                                correctIndex: correctIndex
                            },
                            question: {
                                repeat: false,
                                speech: questionResponse.ssml,
                                text: nextQuestion.text,
                                answers: nextQuestion.answers
                            }
                        }
                    }
                })
                conv.contexts.set(GAME.ANSWER, 1);
            } else {

                const finalScoreResponse = ssmlResponder.getFinalScoreResponse(conv.data.round.score, conv.data.round.items.length);
                conv.ask({
                    immersiveResponse: {
                        updatedState: {
                            view: STATE.SCORE,
                            answer: {
                                speech: answerResponse.ssml,
                                matchIndex: matchIndex,
                                correctIndex: correctIndex
                            },
                            score: {
                                speech: finalScoreResponse.ssml,
                                value: conv.data.round.score,
                                total: conv.data.round.items.length
                            }
                        }
                    }
                })
                conv.contexts.set(CONTEXT.GAME_RESTART, 1);
            }

        } else {

            if (!complete) {
                const nextQuestion = await Quizzes.getQuestion(conv, { questionIndex: conv.data.round.index, shuffle: true });
                const questionResponse = ssmlResponder.getQuestionResponse(nextQuestion, conv.data.round.index, conv.data.round.items.length, false);
                conv.ask(
                    new SimpleResponse({
                        speech: answerResponse.ssml,
                        text: answerResponse.text
                    }),
                    new SimpleResponse({
                        speech: questionResponse.ssml,
                        text: questionResponse.text
                    }),
                    new Suggestions(questionResponse.choices)
                )
                conv.contexts.set(GAME.ANSWER, 1);
            } else {
                const finalScoreResponse = ssmlResponder.getFinalScoreResponse(conv.data.round.score, conv.data.round.items.length);

                conv.ask(
                    new SimpleResponse({
                        speech: answerResponse.ssml,
                        text: answerResponse.text
                    }),
                    new BasicCard({
                        title: `Your Final Score is ${conv.data.round.score}`,
                        image: new Image({
                            url: `https://dummyimage.com/1024x576/36399A/ffffff&text=${conv.data.round.score}!`,
                            alt: "Your Score"
                        }),
                        display: "CROPPED"
                    }),
                    new SimpleResponse(
                        {
                            speech: finalScoreResponse.ssml,
                            text: finalScoreResponse.text
                        }),
                    new Suggestions(["yes", "no"])
                )
                conv.contexts.set(CONTEXT.GAME_RESTART, 1);
            }

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
            });
        } else {

            conv.ask(
                new SimpleResponse({
                    speech: answerResponse.ssml,
                    text: answerResponse.text
                })

            )

        }
        conv.contexts.set(GAME.ANSWER, 1);
    }


};



router.use(app);
module.exports = router;
const INTENT = {
    GAME: {
        START: "game.start",
        HELP: "game.help",
        QUESTION_REPEAT: "game.question.repeat",
        CHOICE_VALUE: "game.choice.value",
        CHOICE_ANSWER: "game.choice.answer",
        CHOICE_ORDINAL: "game.choice.ordinal",
        CHOICE_LAST: "game.choice.last",
        CHOICE_MIDDLE: "game.choice.middle",
        ANSWER: "game_answer",
        SCORE: "game.score",
        RESTART: "game.restart",
        RESTART_YES: "game.restart.yes",
        RESTART_NO: "game.restart.no",
        QUIT: "game.quit"
    }
}
const CONTEXT = {
    GAME_ANSWER: "game_answer",
    GAME_RESTART: "restart"
}
const ACTIONS = {
    CAPABILITY_CUSTOM_STAGE: "actions.capability.CUSTOM_STAGE"
}

module.exports = { ACTIONS, INTENT, CONTEXT };

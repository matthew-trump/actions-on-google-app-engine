const config = require("./app-config");
const { Utils, RANKING } = require('../data-accessor');


const SKIP_MEDIA_INTRO = process.env.SKIP_MEDIA_INTRO || false;
const AUDIO_STORAGE_URL = process.env.AUDIO_STORAGE_URL;

const ORDINALS = [
    "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth",
    "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth"
];
const PROMPTS = {
    [RANKING.FIRST]: [
        "Alright, let's do it. Question 1.",
        "First Question.",
        "Here it is, Question 1.",
        "Ready? Question 1.",
        "Starting off with Question 1."
    ],
    [RANKING.THIRD]: [
        "Remember. they get harder. here's Question 3.",
        "OK now they get a little tougher, Question 3.",
        "OK focus in. Here's Question 3.",
        "Question 3 coming in hot.",
        "and now, Question 3."
    ],
    [RANKING.GENERIC]: [
        "Next Question coming up.",
        "Moving on to the next question.",
        "And here it is, Question $NUMBER.",
        "Moving on to Question $NUMBER.",
        "Let's tee up Question $NUMBER.",
        "Here's Question $NUMBER.",
        "Question $NUMBER.",
        "Alright, Question $NUMBER.",
        "and now, Question $NUMBER.",
        "Keep it up! Here's Question $NUMBER.",
        "Stay alert, Here's question $NUMBER.",
        "And here it is, the $ORDINAL question.",
        "Moving on to the $ORDINAL question.",
        "Let's tee up the $ORDINAL question.",
        "Here's the $ORDINAL question.",
        "Keep it up! Here's the $ORDINAL question.",
        "$ORDINAL question.",
        "Alright, $ORDINAL question.",
        "and now, the $ORDINAL question."
    ],
    [RANKING.HALF_WAY]: [
        "Half way there. Question $NUMBER.",
        "Half way through the game. Let's hit you with Question $NUMBER.",
        "You've made it half way through! Question $NUMBER.",
        "Here we go Question $NUMBER.",
        "We're half way into the quiz. Here's Question $NUMBER."
    ],
    [RANKING.NEXT_TO_NEXT_TO_NEXT_TO_LAST]: [
        "You're almost there. Question $NUMBER.",
        "Here we go, question $NUMBER.",
        "You ready? Here's question $NUMBER coming now.",
        "Getting toward the end. Question $NUMBER.",
        "Just a couple more left, heres Question $NUMBER."
    ],
    [RANKING.NEXT_TO_NEXT_TO_LAST]: [
        "Wow we're getting close. Quetion $NUMBER.",
        "Don't give up now. Here's Question $NUMBER.",
        "So close to the end. Question $NUMBER.",
        "Oh boy, we're getting close. Question $NUMBER.",
        "Almost at the final round. Here's Question $NUMBER."
    ],
    [RANKING.NEXT_TO_LAST]: [
        "And now the next-to-last question.",
        "Here's the next-to-last question.",
        "OK get ready for the next-to-last question.",
        "question $NUMBER, the penultimate question.",
        "Heres the next-to-last question."
    ],
    [RANKING.LAST]: [
        "It all boils down to this. Question $NUMBER.",
        "This is it. The final question.",
        "Here we go Question $NUMBER.",
        "Ready for the final one? Question $NUMBER.",
        "This is for all the bananas. Question $NUMBER."
    ],
}


const ssmlResponder = class {

    constructor() { }

    getWelcomeResponse(returning) {
        const welcomeConfig = returning ? config.welcome.returning : config.welcome.new;


        const text = welcomeConfig.text;
        const audioBackgroundFile = welcomeConfig.audioBackground.file;
        const audioBackgroundSoundLevel = welcomeConfig.audioBackground.soundLevel;
        const audioInitialDelay = welcomeConfig.audio.initialDelay;
        const audioFile = welcomeConfig.audio.prefix
            + Utils.getRandomIndex(welcomeConfig.audio.randomIndex)
            + welcomeConfig.audio.suffix;

        const ssml = SKIP_MEDIA_INTRO ? `<speak>${Utils.escape(text)}</speak>` :
            `<speak>`
            + `<par>`
            + `<media begin="${audioInitialDelay}">`
            + `<audio src="${AUDIO_STORAGE_URL}${audioFile}"/>`
            + `</media>`
            + `<media soundLevel="${audioBackgroundSoundLevel}">`
            + `<audio src="${AUDIO_STORAGE_URL}${audioBackgroundFile}"/>`
            + `</media>`
            + `</par>`
            + `</speak>`;


        return { ssml, text };
    }
    getQuestionResponse(question, questionIndex, numQuestions, repeat) {
        const choices = question.answers.map(a => a.text);
        const spoken = choices.slice(0);
        spoken.splice(2, 0, "or");
        const tags = [];

        const prompts = PROMPTS[Utils.getItemRanking(questionIndex, numQuestions)];
        const prompt = prompts[Utils.getRandomIndex(prompts.length)]
            .replace(/\$NUMBER/g, "" + (questionIndex + 1) + "")
            .replace(/\$ORDINAL/g, questionIndex < ORDINALS.length ? ORDINALS[questionIndex] : 'next')

        let ssmlPrompt = '<speak>';
        if (!repeat) {
            ssmlPrompt += Utils.escape(prompt);
        } else {
            ssmlPrompt += Utils.escape("let's try that again");
        }
        ssmlPrompt += '</speak>';

        let ssmlQuestion = '<speak>';
        ssmlQuestion += `<break time='1000ms'/>`;
        ssmlQuestion += Utils.escape(question.text);
        ssmlQuestion += `<break time='800ms'/>`;
        ssmlQuestion += Utils.escape("your choices are");
        ssmlQuestion += `<break time='500ms'/>`;
        ssmlQuestion += Utils.escape(spoken.join(',<break time="400ms"/>'));
        ssmlQuestion += '</speak>';

        const text = question.text;
        return {
            ssmlPrompt,
            ssmlQuestion,
            text,
            choices,
        }
    }
    getAnswerCorrectResponse() {
        //const correct = this.getRandomItem(audioFiles.answers.correct);
        const random = 0;
        const text = "That's correct!";
        const ssml =
            `<speak>
                <par>
                <media>
                    <audio src="${AUDIO_STORAGE_URL}right.mp3"/>
                 </media>
                <media begin="0.2s">
                    <audio src="${AUDIO_STORAGE_URL}scott-correct-${random}.mp3"/>
                </media>
                </par>
                <desc>${Utils.escape(text)}</desc>
            </speak>`;

        return { ssml, text };
    }
    getAnswerWrongResponse() {
        //const wrong = this.getRandomItem(audioFiles.answers.wrong);
        const random = 0;
        const text = "Sorry That's wrong.";
        const ssml =
            `<speak>
               <par>
                <media>
                    <audio src="${AUDIO_STORAGE_URL}wrong.mp3"/>
                </media>
                <media begin="0.2s">
                    <audio src="${AUDIO_STORAGE_URL}scott-wrong-${random}.mp3"/>
                </media>
                </par>
                <desc>${Utils.escape(text)}</desc>
            </speak>`;

        return { ssml, text };
    }
    getAnswerUnrecognizedResponse() {
        const text = "sorry that answer is not one of the choices";
        const ssml = `<speak>${Utils.escape(text)}</speak>`;
        return { ssml, text };
    }
    getScoreResponse(score, numAsked) {
        let ssml;
        if (score === 0) {
            ssml = `<speak>You haven't gotten any questions right. keep trying.</speak>`
        } else if (score === 1) {
            ssml = `<speak>You've gotten ${score} question right of ${numAsked}</speak>`;
        } else {
            ssml = `<speak>You've gotten ${score} of ${numAsked} questions right.</speak>`;
        }
        return { ssml }
    }
    getFinalScoreResponse(score, numQuestions) {

        const low = Math.floor(numQuestions / 3);
        const mid = Math.floor(2 * numQuestions / 3);
        const random = 0;

        let ssml = `<speak>`
        ssml += `<audio src='${AUDIO_STORAGE_URL}score.mp3'/>`;
        ssml += Utils.escape(`You got ${score} of ${numQuestions} questions right.`);
        ssml += `<break time='200ms'/>`

        if (score < low) {
            ssml += `<audio src='${AUDIO_STORAGE_URL}scott-low-${random}.mp3'/>`;
        } else if (score < mid) {
            ssml += `<audio src='${AUDIO_STORAGE_URL}scott-mid-${random}.mp3'/>`;
        } else {
            ssml += `<audio src='${AUDIO_STORAGE_URL}scott-high-${random}.mp3'/>`;
        }

        ssml += `<break time='800ms'/>`
        ssml += `<desc>${Utils.escape("Do you want to try again?")}</desc>`;
        ssml += `${Utils.escape("Do you want to try again?")}`;




        return {
            ssml: ssml
        }

    }
    getGameEndResponse() {

        const random = 0;

        const ssml = `<audio src=${AUDIO_STORAGE_URL}scott-end-${random}.mp3'/>`;
        return {
            speech: ssml,
            text: `See you again soon!`
        }
    }
}

module.exports = new ssmlResponder();
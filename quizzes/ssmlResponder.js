const config = require("./app-config");
const shuffleArray = require('shuffle-array');
const SKIP_MEDIA_INTRO = process.env.SKIP_MEDIA_INTRO || false;
const AUDIO_STORAGE_URL = process.env.AUDIO_STORAGE_URL;

const escape = (value) => {
    if (value && typeof value === "string") {
        return value.replace(/&/g, "&amp;");
    }
    return value;
}
const getRandomIndex = (max) => {
    return Math.floor(Math.random() * max)
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
            + getRandomIndex(welcomeConfig.audio.randomIndex)
            + welcomeConfig.audio.suffix;

        const ssml = SKIP_MEDIA_INTRO ? `<speak>${escape(text)}</speak>` :
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
    getQuestionResponse(question, questionIndex, repeat) {

        const choices = shuffleArray(question.answers).map(a => a.text);
        const spoken = choices.slice(0);
        spoken.splice(2, 0, "or");
        const tags = [];

        if (!repeat) {
            //tags.push(escape(this.getRandomItem(questionIntro[questionIndex])))
            tags.push(escape("OK here's the question"))
        } else {
            tags.push(escape("let's try that again"));
        }
        tags.push(`<break time='1000ms'/>`);
        tags.push(escape(question.text));
        tags.push(`<break time='800ms'/>`);
        tags.push(escape("your choices are"));
        tags.push(`<break time='500ms'/>`);
        tags.push(escape(spoken.join(',<break time="400ms"/>')));

        const ssml = `<speak>${tags.join(" ")}</speak>`;

        return {
            ssml,
            choices,
        }
    }
}

module.exports = new ssmlResponder();
const config = require("./app-config");

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
}

module.exports = new ssmlResponder();
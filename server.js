const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const ping = require('./ping');
const secretKeyAuthorization = require('./secret-key-auth');
const { jwtAuthorization, jwtLogin, jwtUnauthorizedError } = require('./jwt-auth');
const api = require("./api");

const { quizzesTtsWeb, quizzesDialogflow } = require("./quizzes");

const app = express();
app.enable('trust proxy');
app.use(bodyParser.json());
app.use(cors());

app.use('/', express.static(path.join(__dirname, 'public')));
app.use("/ping", ping);

app.use("/quizzes/dialogflow",
    secretKeyAuthorization,
    quizzesDialogflow);
/** 
app.use("/quizzes/ttsweb",
    quizzesTtsWeb);
*/
app.use("/login", jwtLogin);
app.use("/api",
    jwtAuthorization,
    jwtUnauthorizedError,
    api);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log("");
    console.log("ACTIONS ON GOOGLE APP ENGINE");
    console.log(`listening on port ${PORT}`);
    console.log("ENVIRONMENT", process.env.ENVIRONMENT);

});

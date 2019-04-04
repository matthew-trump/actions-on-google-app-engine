const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const api = require("./api");

//this is the webhook login, which can be separately submodule if necessary
//directory directory reflects originally design strategy of using a git submodule for this
//part of the project
const fulfillmentWebhook = require("./fulfillment-webhook/src");

//this provides authorization for the secret key that is present in Dialogflow webhook calls
const secretKeyAuthorization = require('./auth');

process.env.DEBUG = "dialogflow:debug";

const app = express();
app.enable('trust proxy');
app.use(bodyParser.json());
app.use(cors());

app.use('/', express.static(path.join(__dirname, 'public')));

//this is the path that is configured as part of the webhook in Dialogflow (uses secret key auth)
app.use("/dialogflow", secretKeyAuthorization, fulfillmentWebhook);

//this is the path that is used by the backend admin api to adminster the database
app.use("/api", api);

const PORT = process.env.PORT || 8080;


app.listen(PORT, () => {
    console.log("");
    console.log("DIALOGFLOW FULFILLMENT APP ENGINE");
    console.log(`listening on port ${PORT}`);
    console.log("ENVIRONMENT", process.env.ENVIRONMENT);

});

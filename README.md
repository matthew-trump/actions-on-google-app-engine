# Actions on Google App Engine

This repository contains a stripped-down node express application for building the fulifillment component of a Dialogflow project to be deployed on Google Cloud App Engin and a Cloud SQL database.

The application was built so as to be modular so to allow the development of the webhook (i.e. the Actions-on-Google component) as a separate project (on Firebase specifically) without a database connection. The webhook can then be included into this app as a git submodule and the full app chain can be tested before being deployed to the cloud.

The framework also has a secure api interface for admin client to access and manage the database independent of the webhook functionality. 

A basic version of the admin client is found in a separate project.


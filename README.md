# Dialogflow App Engine Framework

This repository contains a framework for building the fulifillment component of a Dialogflow project that can be deployed on Google Cloud App Engine. Specifically it is meant for a project that requires the backing of a Cloud SQL database, and also data caching (so as to minimize database read/write calls).

It is a stripped down version of an application of this type that was successfully tested and deployed for a media client on Google Assistant. 

As part of the original development process, the framework was built so as to be modular so to allow local development and testing by multiple developers, and also simple to deploy to Google App Engine. As part of this strategy, the domain-specific webhook functions for the original project were decoupled as a separate project from the app engine framework itsef (in fact they were a git submodule, which is reflected in the directory structure.)

This last decoupling feature allowed the front end part of the webhook to be developed without the need of a database, using static data fixtures for testing. This proved to be a successful design strategy, allowing multiple developers to work on various parts of the project at the same time, and so it has been preserved here in the project. As such the framework technically allows for more than one webhook to be deployed out of the same app engine, provided each is configured with its own access path.

The framework also has an api interface for admin access to the database that is independent of the webhook functionality. A basic version of the admin client is found in a separate project.


const fs = require('fs');
const SECRET_KEY = process.env.SECRET_KEY;

const verifySecretKey = function (req) {

    const header = req.headers.authorization;
    if (header) {
        const token = header.split(" ")[1];
        return token === SECRET_KEY;
    }
    return false;
}
const auth = class {

    constructor() { }

    authorize(req, res, next) {
        if (!verifySecretKey(req)) {
            return res.status(401).json({ error: "Authorization failed." });
        }
        next();
    }
    isAuthorized(req) {
        return verifySecretKey(req);
    }
}

module.exports = (new auth()).authorize
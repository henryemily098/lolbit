const http = require("http");
const express = require("express");

class Server {
    /**
     * 
     * @param {number} port 
     */
    constructor(port) {
        const app = express();
        const server = http.createServer(app);

        server.listen(port);
        this.config = { server, app };
    }
    
    on(event, callback) {
        const { server } = this.config;
        server.on(event, callback);
    }

    get(path, callback) {
        const { app } = this.config;
        app.get(path, callback);
    }
}

module.exports = Server;
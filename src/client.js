const { Client, Collection, Partials } = require("discord.js");

module.exports = class extends Client {
    constructor() {
        super({
            partials: [
                Partials.Channel, Partials.GuildMember, Partials.GuildScheduledEvent, Partials.Message,
                Partials.Reaction, Partials.ThreadMember, Partials.User
            ],
            intents: [
                "AutoModerationConfiguration", "AutoModerationExecution", "DirectMessageReactions", "DirectMessageTyping", "DirectMessages", "GuildBans", "GuildEmojisAndStickers",
                "GuildIntegrations", "GuildInvites", "GuildMembers", "GuildMessageReactions", "GuildMessageTyping", "GuildMessages", "GuildPresences", "GuildScheduledEvents", "GuildVoiceStates", "GuildWebhooks",
                "Guilds", "MessageContent"
            ]
        });

        this.queue = new Map();
        this.commands = new Collection();
        this.app_commands = [];

        this.config = require("./config.json");
        this.permissions = [
            0x8, 0x4, 0x20, 0x2, 0x10000000, 0x10
        ];
    }

    /**
     * 
     * @param {import("discord.js").Guild} guild 
     */
    guildColor(guild) {
        const member = guild.members.cache.get(this.user.id);
        return member.displayHexColor;
    }

    /**
     * 
     * @param {string} token 
     */
    setToken(token) {
        this.login(token);
        return this;
    }

    /**
     * 
     * @param {number} full_duration 
     */
    parseTimeFormat(full_duration) {
        if(!full_duration) return "00:00:00";

        let seconds = Math.floor((full_duration / 1000) % 60);
        let minutes = Math.floor((full_duration / 1000 / 60) % 60);
        let hours = Math.floor((full_duration / 1000 / 60 / 60) % 24);
        return `${hours < 10 ? `0${hours}` : hours}:${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;

    }
}
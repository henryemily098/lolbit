const { queue:queueControl } = require("../src");

module.exports = {
    data: [
        {
            name: "queue",
            description: "Show list of queue of this server."
        },
        {
            name: "q",
            description: "Show list of queue of this server."
        }
    ],
    /**
     * 
     * @param {import("discord.js").CommandInteraction} interaction 
     * @param {import("../src").Client} client 
     */
    async run(interaction, client) {
        const queue = client.queue.get(interaction.guild.id);
        if(!queue || !queue.songs.length) return interaction.reply({ content: "No songs queue available at the moment!", ephemeral: true }).catch(console.log);
        await queueControl(interaction, client);
    }
}
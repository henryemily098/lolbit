const { EmbedBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

module.exports = {
    data: [
        {
            name: "disconnect",
            description: "Disconnect from voice channel!"
        },
        {
            name: "leave",
            description: "Disconnect from voice channel!"
        },
        {
            name: "dc",
            description: "Disconnect from voice channel!"
        }
    ],
    /**
     * 
     * @param {import("discord.js").CommandInteraction} interaction 
     * @param {import("../src").Client} client 
     */
    async run(interaction, client) {

        const queue = client.queue.get(interaction.guild.id);
        const connection = getVoiceConnection(interaction.guild.id);
        const { channel } = interaction.member.voice;

        if(!connection) {
            if(queue) {
                if(queue.message) queue.message.delete().catch(console.log);
                client.queue.delete(interaction.guild.id);
            }
            return interaction.reply({ content: "I'm already outside voice channel!", ephemeral: true }).catch(console.log);
        }

        let { channelId } = connection.joinConfig;
        if(!channel || channel.id !== channelId) return interaction.reply({ content: `You have to join <#${channelId}> channel first!`, ephemeral: true }).catch(console.log);

        if(queue) {
            let confirm = false;
            for (let i = 0; i < interaction.member.roles.cache.toJSON().length; i++) {
                let role = interaction.member.roles.cache.toJSON()[i];
                let permissions = parseInt(role.permissions.bitfield.toString());
                for (let i = 0; i < client.permissions.length; i++) {
                    if((permissions & client.permissions[i]) === client.permissions[i]) confirm = true;
                }
            }
            if(queue.dj_user.id === interaction.user.id) confirm = true;
            if(!confirm) return interaction.reply({ content: `You don't have permission to use this command yet!`, ephemeral: true }).catch(console.log);

            if(queue.message) queue.message.delete().catch(console.log);
            client.queue.delete(interaction.guild.id);
        }
        connection.destroy();

        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setAuthor({ name: "| Leave voice channel!", iconURL: client.user.displayAvatarURL({ extension: "png", size: 1024, forceStatic: true }) });
        return interaction.reply({ embeds: [embed] }).catch(console.log);

    }
}
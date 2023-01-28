const { EmbedBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

let options = [
    {
        name: "number",
        description: "Input number 1 - 100 to control the volume.",
        type: 4,
        required: false
    }
]

module.exports = {
    data: [
        {
            name: "volume",
            description: "Check or set bot's volume.",
            options: options
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

        const { channel } = interaction.member.voice;
        const connection = getVoiceConnection(interaction.guild.id);
        if(!channel) return interaction.reply({ content: "You need to join voice channel first!", ephemeral: true }).catch(console.log);
        if(!connection) {
            client.queue.delete(interaction.guild.id);
            return interaction.reply({ content: "No songs queue available at the moment!", ephemeral: true }).catch(console.log);
        }
        const { channelId } = connection.joinConfig;
        if(channel.id !== channelId) return interaction.reply({ content: `You need to join <#${channelId}> channel first!`, ephemeral: true }).catch(console.log);

        var volume = interaction.options.get("number", false)?.value;
        let embed = new EmbedBuilder().setColor(client.config.defaultColor);

        if(!volume) embed.setAuthor({ name: `Current volume: ${queue.volume}/100`, iconURL: client.user.displayAvatarURL({ extension: "png", size: 1024, forceStatic: true }) });
        else {
            queue.volume = volume;
            embed.setAuthor({ name: `Set current volume: ${volume}/100` })
            if(queue.player.state.resource) queue.player.state.resource.volume.setVolume(volume / 100);
        }

        interaction
            .reply({ embeds: [embed] })
            .catch(console.log);
    }
}
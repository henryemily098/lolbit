const { EmbedBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

module.exports = {
    data: [
        {
            name: "skip",
            description: "Skip current song"
        },
        {
            name: "vs",
            description: "Skip current song."
        },
        {
            name: "vote-skip",
            description: "Skip current song"
        },
        {
            name: "voteskip",
            description: "Skip current song"
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

        const { channel } = interaction.member.voice;
        const connection = getVoiceConnection(interaction.guild.id);

        if(!channel) return interaction.reply({ content: "You need to join voice channel first!", ephemeral: true }).catch(console.log);
        if(!connection) {
            client.queue.delete(interaction.guild.id);
            return interaction.reply({ content: "No songs queue available at the moment!", ephemeral: true }).catch(console.log);
        }

        const { channelId } = connection.joinConfig;
        if(channel.id !== channelId) return interaction.reply({ content: `You need to join <#${channelId}> channel first!`, ephemeral: true }).catch(console.log);

        let members = interaction.guild.channels.cache.get(channelId).members;
        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setAuthor({ name: `| Vote counts: ${queue.votes.length}/${members.cache.size}`, iconURL: client.user.displayAvatarURL({ extension: "png", size: 1024, forceStatic: true }) });
        if(queue.votes.includes(interaction.user.id)) return interaction.reply({ content: "You're already vote to skip!", embeds: [embed], ephemeral: true }).catch(console.log);

        queue.votes.push(interaction.user.id);
        interaction.reply({ embeds: [embed], content: `${interaction.user.tag} vote to skip!` }).catch(console.log);
        if(queue.votes.length >= members.cache.size) queue.player.stop();

    }
}
const { EmbedBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

let options = [
    {
        name: "song_number",
        description: "Select a song from queue.",
        type: 4,
        required: true
    }
]

module.exports = {
    data: [
        {
            name: "remove",
            description: "Remove song from queue.",
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

        const { channel } = interaction.member.voice;
        const connection = getVoiceConnection(interaction.guild.id);
        if(!channel) return interaction.reply({ content: "You need to join voice channel first!", ephemeral: true }).catch(console.log);
        if(!connection) {
            client.queue.delete(interaction.guild.id);
            return interaction.reply({ content: "No songs queue available at the moment!", ephemeral: true }).catch(console.log);
        }
        const { channelId } = connection.joinConfig;
        if(channel.id !== channelId) return interaction.reply({ content: `You need to join <#${channelId}> channel first!`, ephemeral: true }).catch(console.log);

        let song_number = interaction.options.get("song_number", true).value;
        if(song_number < 1 || song_number > queue.songs.length) return interaction.reply({ content: `You need to input number ${queue.songs.length > 1 ? `between 1 - ${queue.songs.length}` : "1"}!`, ephemeral: true }).catch(console.log);

        let song = queue.songs[song_number - 1];
        let confirm = false;
        for (let i = 0; i < interaction.member.roles.cache.toJSON().length; i++) {
            let role = interaction.member.roles.cache.toJSON()[i];
            let permissions = parseInt(role.permissions.bitfield.toString());
            for (let i = 0; i < client.permissions.length; i++) {
                if((permissions & client.permissions[i]) === client.permissions[i]) confirm = true;
            }
        }
        if(queue.dj_user.id === interaction.user.id) confirm = true;
        if(song.requestedUser.id === interaction.user.id) confirm = true;
        if(!confirm) return interaction.reply({ content: `You don't have permission to use this command yet!`, ephemeral: true }).catch(console.log);

        let removedSong = queue.songs.splice(song_number - 1, 1)[0];
        if(queue.index === song_number - 1) queue.player.stop();

        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setAuthor({ name: "| Removed Song From Queue", iconURL: client.user.displayAvatarURL({ extension: "png", size: 1024, forceStatic: true }) })
            .setDescription(`[${removedSong.title}](${removedSong.url})`)
            .setThumbnail(removedSong.thumbnails.sort((a, b) => b.height - a.height)[0].url)
            .setFooter({ text: `Removed by ${interaction.user.tag}` });
        return interaction
            .reply({ embeds: [embed] })
            .catch(console.log);

    }
}
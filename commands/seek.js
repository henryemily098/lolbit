const { stream } = require("play-dl");
const { getVoiceConnection, createAudioResource } = require("@discordjs/voice");

let options = [
    {
        name: "hours",
        description: "Input hours (type 0 if the song doesn't reach hours).",
        type: 4,
        required: true
    },
    {
        name: "minutes",
        description: "Input minutes (type 0 if the song doesn't reach minutes).",
        type: 4,
        required: true
    },
    {
        name: "seconds",
        description: "Input seconds.",
        type: 4,
        required: true
    }
]

module.exports = {
    data: [
        {
            name: "seek",
            description: "Seek duration current song.",
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

        let hours = interaction.options.get("hours", true).value;
        let minutes = interaction.options.get("minutes", true).value;
        let seconds = interaction.options.get("seconds", true).value;
        
        let currentSong = queue.songs[queue.index];
        let seek = parseInt((hours * 3600) + (minutes * 60) + seconds);
        if(currentSong.duration < (seek * 1000)) return interaction.reply({ content: `You can't set duration more than ${client.parseTimeFormat(currentSong.duration)}!`, ephemeral: true }).catch(console.log);
        
        let data = null;
        if(currentSong.type === "soundcloud") return interaction.reply({ content: `I can't seek soundcloud track!`, ephemeral: true }).catch(console.log);
        if(currentSong.type === "spotify") data = await stream(currentSong.youtube_link, { seek: seek });
        if(currentSong.type === "youtube") data = await stream(currentSong.url, { seek: seek });

        const resource = createAudioResource(data.stream, { inlineVolume: true, inputType: data.type });
        resource.volume.setVolume(queue.volume / 100);
        queue.player.play(resource);

        interaction
            .reply({ content: `Seek current time song to ${client.parseTimeFormat(seek * 1000)}!`, ephemeral: true })
            .catch(console.log);

    }
}
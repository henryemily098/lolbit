const { getVoiceConnection } = require("@discordjs/voice");

let options = [
    {
        name: "song-number",
        description: "Input number of song from queue.",
        type: 4,
        required: true
    },
    {
        name: "move-to",
        description: "Input number to move the song in queue.",
        type: 4,
        required: true
    }
]

module.exports = {
    data: [
        {
            name: "move",
            description: "Move song in queue.",
            options: options
        },
        {
            name: "mv",
            description: "Move song in queue.",
            options: options
        },
        {
            name: "m",
            description: "Move song in queue.",
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
        if(!channel) return interaction.reply({ content: "You have to join voice channel first!", ephemeral: true }).catch(console.log);

        const connection = getVoiceConnection(interaction.guild.id);
        if(!connection) {
            if(queue) client.queue.delete(interaction.guild.id);
            return interaction.reply({ content: "No songs queue available at the moment!", ephemeral: true }).catch(console.log);
        }

        const { channelId } = connection.joinConfig;
        if(channelId !== channel.id) return interaction.reply({ content: `You need to join <#${channelId}> first!`, ephemeral: true }).catch(console.log);

        let confirm = false;
        for (let i = 0; i < interaction.member.roles.cache.toJSON().length; i++) {
            let role = interaction.member.roles.cache.toJSON()[i];
            let permissions = parseInt(role.permissions.bitfield.toString());
            for (let i = 0; i < client.permissions.length; i++) {
                if((permissions & client.permissions[i]) === client.permissions[i]) confirm = true;
            }
        }
        if(queue.dj_user.id === interaction.user.id) confirm = true;
        if(!confirm) return interaction.reply({ content: `You don't have permission to use this command!`, ephemeral: true }).catch(console.log);

        let song_number = interaction.options.get("song-number", true)?.value;
        let move_to = interaction.options.get("move-to", true)?.value;

        if(queue.songs.length < 2) return interaction.reply({ content: "Songs in queue must be more than 1 song to move a song!", ephemeral: true }).catch(console.log);
        if(song_number < 1 || song_number > queue.songs.length) return interaction.reply({ content: `You have to input number between 2 - ${queue.songs.length} to choose a song!`, ephemeral: true }).catch(console.log);
        if(move_to < 1 || song_number > queue.songs.length) return interaction.reply({ content: `You have to input number between 2 - ${queue.songs.length}!` }).catch(console.log);

        let choosenSong = queue.songs.splice(song_number - 1, 1)[0];
        let nextSongs = queue.songs.splice(move_to - 1, queue.songs.length - 1);

        queue.songs.push(choosenSong);
        for (let i = 0; i < nextSongs.length; i++) {
            queue.songs.push(nextSongs[i]);
        }
        
        queue.index = move_to - 1;
        interaction
            .reply({ content: `Move **[${choosenSong.title}](<${choosenSong.url}>)** to number ${move_to}!`, ephemeral: true })
            .catch(console.log);

    }
}
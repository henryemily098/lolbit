const { EmbedBuilder } = require("discord.js");
const { getVoiceConnection, createAudioResource, StreamType } = require("@discordjs/voice");
const { default:scdl } = require("soundcloud-downloader");
const { stream } = require("play-dl");

let options = [
    {
        name: "song_number",
        description: "Select song number for skip to the specific song.",
        type: 4,
        required: true
    }
]

module.exports = {
    data: [
        {
            name: "skipto",
            description: "Skip to specific song.",
            options: options
            
        },
        {
            name: "skip-to",
            description: "Skip to specific song.",
            options: options
        },
        {
            name: "jump-to",
            description: "Skip to specific song.",
            options: options
        },
        {
            name: "jumpto",
            description: "Skip to specific song.",
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

        let song_number = interaction.options.get("song_number", true).value;
        if(song_number < 1 || song_number > queue.songs.length) return interaction.reply({ content: `You need to input number ${queue.songs.length > 1 ? `between 1 - ${queue.songs.length}` : "1"}!`, ephemeral: true }).catch(console.log);

        let song = queue.songs[song_number - 1];
        queue.index = song_number - 1;

        let data = null;
        if(song.type === "soundcloud") {
            let s = await scdl.downloadFormat(song.url, scdl.FORMATS.MP3)
            data = { stream: s, type: StreamType.Arbitrary }
        };
        if(song.type === "spotify") {
            let s = await stream(song.youtube_link);
            data = { stream: s.stream, type: s.type }
        }
        if(song.type === "youtube") {
            let s = await stream(song.url, { seek: seek });
            data = { stream: s.stream, type: s.type }
        }

        const resource = createAudioResource(data.stream, { inlineVolume: true, inputType: data.type });
        resource.volume.setVolume(queue.volume / 100);
        queue.player.play(resource);

        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setAuthor({ name: `| Skip song to queue number ${song_number}`, iconURL: client.user.displayAvatarURL({ extension: "png", size: 1024, forceStatic: true }) });
        return interaction
            .reply({ embeds: [embed] })
            .catch(console.log);

    }
}
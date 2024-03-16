const {
    EmbedBuilder
} = require("discord.js");

/**
 * 
 * @param {import("discord.js").CommandInteraction} interaction 
 */
module.exports.run = async(interaction) => {
    let queue = interaction.client.player.getQueue(interaction.guildId);
    if(!queue) {
        try {
            await interaction.reply({
                content: "There's no queue available here!",
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return
    }

    let { channel } = interaction.member.voice;
    let { channel: clientVC } = interaction.guild.members.cache.get(interaction.client.user.id).voice;

    if(!channel) {
        try {
            await interaction.reply({
                content: "You have to join voice channel first!",
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }
    if(channel.id !== clientVC.id) {
        try {
            await interaction.reply({
                content: `You have to join <#${clientVC.id}> first!`,
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    let position = interaction.options.get("position", true).value;
    if(position < 1 || queue.songs.length < position) {
        try {
            await interaction.reply({
                content: `You can only input ${queue.songs.length > 1 ? "number 1" : `number between 1 - ${queue.songs.length}`}!`,
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    let confirm = false;
    let selectedSong = queue.songs[position - 1];
    for (let i = 0; i < interaction.member.roles.cache.toJSON().length; i++) {
        let role = interaction.member.roles.cache.toJSON()[i];
        let permissions = parseInt(role.permissions.bitfield.toString());
        for (let i = 0; i < interaction.client.permissions.length; i++) {
            if((permissions & interaction.client.permissions[i]) === interaction.client.permissions[i]) confirm = true;
        }
    }
    if(queue && queue.djUser && queue.djUser.id === interaction.user.id) confirm = true;
    if(interaction.user.id === selectedSong.user.id) confirm = true;
    if(!confirm) {
        try {
            await interaction.reply({
                content: `You can't remove [${selectedSong.title}](<${selectedSong.url}>) from queue!`,
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    queue.removeSong(position);
    try {
        let embed = new EmbedBuilder()
            .setColor(interaction.client.color)
            .setAuthor({
                name: "│ Removed song from queue",
                iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
            })
            .setThumbnail(selectedSong.thumbnail)
            .setDescription(`[${selectedSong.title}](${selectedSong.url})`)
            .setFooter({ text: `Requested by ${selectedSong.user.username}` });
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.log(error);
    }
}

module.exports.data = {
    name: "remove",
    description: "Remove song from queue",
    options: [
        {
            name: "position",
            description: "Input song's position",
            type: 4,
            required: true
        }
    ]
}
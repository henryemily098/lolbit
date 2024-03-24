const { EmbedBuilder } = require("discord.js");

/**
 * 
 * @param {import("discord.js").CommandInteraction} interaction 
 */
module.exports.run = async(interaction) => {
    let confirm = false;
    let queue = interaction.client.player.getQueue(interaction.guildId);

    for (let i = 0; i < interaction.member.roles.cache.toJSON().length; i++) {
        let role = interaction.member.roles.cache.toJSON()[i];
        let permissions = parseInt(role.permissions.bitfield.toString());
        for (let i = 0; i < interaction.client.permissions.length; i++) {
            if((permissions & interaction.client.permissions[i]) === interaction.client.permissions[i]) confirm = true;
        }
    }
    if(queue && queue.djUser && queue.djUser.id === interaction.user.id) confirm = true;
    if(!confirm) {
        try {
            await interaction.reply({
                content: "You can't use this command!",
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    if(!queue) {
        try {
            await interaction.reply({
                content: "There's no queue available here!",
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
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

    let nextSongs = [...queue.songs];
    let previousSongs = nextSongs.splice(0, queue.position);

    let display = [...nextSongs];
    if(queue.loop !== 0) display.push(...previousSongs);

    let songNumber = interaction.options.get("song-number", true).value;
    if(songNumber < 1 || songNumber > display.length) {
        try {
            await interaction.reply({
                content: `You can only input ${display.length > 1 ? `between 1 - ${display.length}!` : "number 1"}!`,
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    let selectedSong = display[songNumber - 1];
    let index = display.map(i => i.id).indexOf(selectedSong.id);
    queue.jumpTo(index + 1);
    try {
        let embed = new EmbedBuilder()
            .setColor(interaction.client.color)
            .setAuthor({
                name: `│ Skip to queue number ${songNumber}`,
                iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
            })
            .setDescription(`Skip to [${selectedSong.title}](${selectedSong.url})`)
            .setThumbnail(selectedSong.thumbnail);
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.log(error);
    }
}

module.exports.data = {
    name: "skipto",
    description: "Skip to specific song",
    options: [
        {
            name: "song-number",
            description: "Input song number",
            type: 4,
            required: true
        }
    ]
}
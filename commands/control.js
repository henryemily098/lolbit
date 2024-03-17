const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
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
    if(channel.id !== clientVC?.id) {
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

    let messages = interaction.client.messages[interaction.guildId];
    if(messages && messages[0]) {
        try {
            await messages[0].delete();
        } catch (error) {
            console.log(error);
        }
        delete interaction.client.messages[interaction.guildId];
    }

    try {
        let loop;
        if(queue.loop === 0) loop = "❌";
        if(queue.loop === 1) loop = "🔁";
        if(queue.loop === 2) loop = "🔂";

        let shuffleStyle;
        if(queue.shuffle) shuffleStyle = ButtonStyle.Primary;
        else shuffleStyle = ButtonStyle.Secondary;

        let song = queue.songs[queue.position];
        let row = new ActionRowBuilder()
            .setComponents([
                new ButtonBuilder()
                    .setCustomId("control-playpause")
                    .setEmoji(queue.playing ? "⏸" : "▶")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("control-loopqueue")
                    .setEmoji(loop)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("control-shufflequeue")
                    .setEmoji("🔀")
                    .setStyle(shuffleStyle),
                new ButtonBuilder()
                    .setCustomId("control-showqueue")
                    .setLabel("View Queue")
                    .setStyle(ButtonStyle.Secondary)
            ]);
        let embed = new EmbedBuilder()
            .setColor(interaction.client.color)
            .setAuthor({
                name: "│ Now playing",
                iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
            })
            .setThumbnail(song.thumbnail)
            .setDescription(`[${song.title}](${song.url})`)
            .setFooter({ text: `Requested by ${song.user.username}` });

        interaction.client.messages[interaction.guildId] = [];
        let message = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        interaction.client.messages[interaction.guildId].push(message);
        interaction.client.messages[interaction.guildId] = Array.from(new Set(interaction.client.messages[interaction.guildId]));
    } catch (error) {
        console.log(error);
    }
}

module.exports.data = {
    name: "control",
    description: "Re-send the control message"
}
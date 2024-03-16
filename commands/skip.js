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

    let embed = new EmbedBuilder().setColor(interaction.client.color);
    let members = clientVC.members.filter(member => !member.user.bot || member.user.id !== interaction.client.user.id);
    if(queue.votes.includes(interaction.user.id)) {
        try {
            embed
                .setAuthor({
                    name: `│ Total votes: ${queue.votes.length}/${members.size}`,
                    iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
                });
            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    queue.addVoteToSkip(interaction.user.id);
    try {
        embed
            .setAuthor({
                name: `│ Total votes: ${queue.votes.length}/${members.size}`,
                iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
            });
        await interaction.reply({
            embeds: [embed]
        });
    } catch (error) {
        console.log(error);
    }

    if(queue.votes.length >= members.size) {
        queue.skip();
        try {
            embed
                .setAuthor({
                    name: "│ Skip current song",
                    iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
                });
            await interaction
                .channel
                .send({
                    embeds: [embed]
                });
        } catch (error) {
            console.log(error);
        }
    }
}

module.exports.data = {
    name: "skip",
    description: "Skip current song"
}
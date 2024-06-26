const { EmbedBuilder } = require("discord.js");

/**
 * 
 * @param {import("discord.js").CommandInteraction} interaction 
 */
module.exports.run = async(interaction) => {
    let queue = interaction.client.player.getQueue(interaction.guildId);
    if(queue) {
        let confirm = false;
        for (let i = 0; i < interaction.member.roles.cache.toJSON().length; i++) {
            let role = interaction.member.roles.cache.toJSON()[i];
            let permissions = parseInt(role.permissions.bitfield.toString());
            for (let i = 0; i < interaction.client.permissions.length; i++) {
                if((permissions & interaction.client.permissions[i]) === interaction.client.permissions[i]) confirm = true;
            }
        }
        if(queue.djUser && queue.djUser.id === interaction.user.id) confirm = true;
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
    if(!clientVC) {
        if(queue) queue.delete();
        try {
            await interaction.reply({
                content: "I already left voice channel!",
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

    if(queue) queue.leave();
    else interaction.client.player.destroyConnection(interaction.guildId);

    try {
        let embed = new EmbedBuilder()
            .setColor(interaction.client.color)
            .setAuthor({
                name: "│ Leave from voice channel",
                iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
            });
        await interaction.reply({
            embeds: [embed]
        });
    } catch (error) {
        console.log(error);
    }
}

module.exports.data = {
    name: "disconnect",
    description: "Disconnect from voice channel"
}
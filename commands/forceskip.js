const {
    EmbedBuilder
} = require("discord.js");

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

    queue.skip();
    try {
        let embed = new EmbedBuilder()
            .setColor(interaction.client.color)
            .setAuthor({
                name: "│ Skip current song",
                iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
            });
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.log(error);
    }
}

module.exports.data = {
    name: "forceskip",
    description: "Skip without vote"
}
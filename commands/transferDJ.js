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

    let user = interaction.options.getUser("new-dj", true);
    if(user.bot || user.id === interaction.client.user.id) {
        try {
            await interaction.reply({
                content: user.id === interaction.client.user.discriminator
                    ? "I can't become a DJ! Please pick another user."
                    : "Bot cannot become a DJ! Please pick another user.",
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }
    queue.setDJUser(user);

    try {
        let embed = new EmbedBuilder()
            .setColor(interaction.client.color)
            .setAuthor({
                name: "DJ has been answered!",
                iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
            })
            .setDescription(`Current DJ has been transfered to <@${user.id}>`);
        await interaction.reply({
            embeds: [embed]
        });
    } catch (error) {
        console.log(error);
    }
}

module.exports.data = {
    name: "transfer-dj",
    description: "Transfer current DJ to other member in voice channel",
    options: [
        {
            name: "new-dj",
            description: "Pick a user in voice channel",
            type: 6,
            required: true
        }
    ]
}
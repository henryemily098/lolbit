const {
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

/**
 * 
 * @param {import("discord.js").CommandInteraction} interaction 
 */
module.exports.run = async(interaction) => {
    let { channel } = interaction.member.voice;
    let connection = interaction.client.player.getConnection(interaction.guildId);
    if(connection) {
        let { channelId } = connection.joinConfig;
        try {
            await interaction.reply({
                content: `I already joined voice channel: <#${channelId}>`,
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    let params = [];
    let permission = channel.permissionsFor(interaction.client.user);
    if(!permission.has(PermissionFlagsBits.ViewChannel)) params.join("View Channel");
    if(!permission.has(PermissionFlagsBits.Connect)) params.join("Connect");
    if(!permission.has(PermissionFlagsBits.Speak)) params.join("Speak");
    if(params.length) {
        try {
            await interaction.reply({
                content: `I can't join because i'm missing some permissions: ${params.join(", ")}`,
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    interaction.client.player.createConnection(channel);
    try {
        let embed = new EmbedBuilder()
            .setColor(interaction.client.color)
            .setAuthor({
                name: `│ Joined voice channel: #${channel.name}`,
                iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
            });
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.log(error);
    }
}

module.exports.data = {
    name: "join",
    description: "Make lolbit join voice channel"
}
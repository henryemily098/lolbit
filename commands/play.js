const {
    PermissionFlagsBits
} = require("discord.js");

/**
 * 
 * @param {import("discord.js").CommandInteraction} interaction 
 */
module.exports.run = async(interaction) => {

    let { channel } = interaction.member.voice;
    let connection = interaction.client.player.getConnection(interaction.guildId);

    if(!channel) {
        try {
            await interaction.reply({
                content: "You have to join voice channel first!",
                ephemeral: true
            })
        } catch (error) {
            console.log(error);
        }
        return;
    }

    if(connection && channel.id !== connection.joinConfig.channelId) {
        try {
            await interaction.reply({
                content: `You must join <#${connection.joinConfig.channelId}> first!`,
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }
    else {
        let params = [];
        let permission = channel.permissionsFor(interaction.client.user);
        
        if(!permission.has(PermissionFlagsBits.ViewChannel)) params.push("View Channel");
        if(!permission.has(PermissionFlagsBits.Connect)) params.push("Connect");
        if(!permission.has(PermissionFlagsBits.Speak)) params.push("Speak");

        if(params.length) {
            try {
                await interaction.reply({
                    content: `Missing permissions to join <#${channel.id}>: ${params.join(", ")}`,
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }
    }

    try {
        let query = interaction.options.get("query", true).value;
        interaction.client.interactionConfiguration[interaction.guildId+interaction.user.id] = interaction;
        
        await interaction.deferReply({ fetchReply: true });
        await interaction.client.player.play(
            query,
            {
                textChannel: interaction.channel,
                voiceChannel: connection ? interaction.client.channels.cache.get(connection.joinConfig.channelId) : channel,
                user: interaction.user
            }
        );
    } catch (error) {
        console.log(error);
    }

}

module.exports.data = {
    name: "play",
    description: "Play music",
    options: [
        {
            name: "query",
            description: "Playing music",
            type: 3,
            required: true
        }
    ]
}
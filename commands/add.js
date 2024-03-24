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
            })
        } catch (error) {
            console.log(error);
        }
        return;
    }
    if(channel.id !== clientVC.id) {
        try {
            await interaction.reply({
                content: `You must join <#${clientVC.id}> first!`,
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    try {
        let query = interaction.options.get("query", true).value;
        interaction.client.interactionConfiguration[interaction.guildId+interaction.user.id] = interaction;
        
        await interaction.deferReply({ fetchReply: true });
        await queue.addSong(query, {
            textChannel: interaction.channel,
            user: interaction.user
        });
    } catch (error) {
        console.log(error);        
    }
}

module.exports.data = {
    name: "add-song",
    description: "Add song to the queue",
    options: [
        {
            name: "query",
            description: "Input a valid url or title",
            type: 3,
            required: true
        }
    ]
}
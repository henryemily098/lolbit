const lyricsParse = require("lyrics-parse");
const { EmbedBuilder } = require("discord.js");

let options = [
    {
        name: "title",
        description: "Input song's title.",
        type: 3,
        required: true
    }
];

module.exports = {
    data: [
        {
            name: "lyrics",
            description: "Find song's lyrics.",
            options: options
        },
        {
            name: "find-lyrics",
            description: "Find song's lyrics.",
            options: options
        }
    ],
    /**
     * 
     * @param {import("discord.js").CommandInteraction} interaction 
     * @param {import("../src").Client} client 
     */
    async run(interaction, client) {

        let title = interaction.options.get("title", true)?.value;
        let lyrics = null;
        try {
            lyrics = await lyricsParse(title);
        } catch (error) {
            console.log(error);
        }
        if(!lyrics) return interaction.reply({ content: `Cannot find lyrics: ${title}.`, ephemeral: true }).catch(console.log);

        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setTitle(title)
            .setDescription(lyrics);
        interaction
            .reply({ embeds: [embed], ephemeral: true })
            .catch(console.log);

    }
}
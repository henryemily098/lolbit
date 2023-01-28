const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");

/**
 * 
 * @param {import("discord.js").CommandInteraction} interaction 
 * @param {import("./client")} client 
 */
async function queueControl(interaction, client) {
    let queue = client.queue.get(interaction.guild.id);

    let songs = [];
    for (let i = 0; i < queue.songs.length; i++) {
        songs.push(queue.songs[i]);
    }
    let currentSong = songs[queue.index];
    currentSong.index = queue.index;

    let embed = new EmbedBuilder()
        .setColor(client.config.defaultColor)
        .setTitle("🎶List of Songs Queue🎶")
        .setDescription(`Songs Count: ${queue.songs.length} | Page: 1/${Math.floor(queue.songs.length % 5 === 0 ? queue.songs.length / 5 : (queue.songs.length / 5)+1)}`)
        .addFields(
            {
                name: "Current Song:",
                value: `[${currentSong.title}](${currentSong.url}) - ${client.parseTimeFormat(currentSong.duration)}`
            },
            {
                name: "Queue Songs:",
                value: songs.splice(0, 5).map((song, index) => `${index+1}). [${song.title}](${song.url})`).join("\n\n")
            }
        )
    
    let actions = new ActionRowBuilder()
        .setComponents([
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("first_page")
                .setEmoji("<:First_Page:897289481588199504>")
                .setDisabled(true),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("previous_page")
                .setEmoji("<:Previous_Page:897314282872655983>")
                .setDisabled(true),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("next_page")
                .setEmoji("<:Next_Page:897289358187589663>"),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("last_page")
                .setEmoji("<:Last_Page:897289375992389694>")
                .setDisabled(true)
        ]);
    
    let message = null;
    try {
        let components = [];
        if(queue.songs.length > 5) components.push(actions);

        message = await interaction.reply({ embeds: [embed], components, fetchReply: true, ephemeral: true });
    } catch (error) {
        console.log(error);
        return interaction.reply({ content: "Something error while send queue message!", ephemeral: true }).catch(console.log);
    }

    if(queue.songs.length > 5) {
        var first = 0, second = 5,page = 1;
        let collector = message.createMessageComponentCollector({ componentType: ComponentType.Button });
    
        collector.on("collect", (e) => {
            if(!e.isButton()) return;
            const queue = client.queue.get(e.guild.id);
        
            let songs = [];
            let currentSong = queue.songs[queue.index];
            currentSong.index = queue.index;
        
            for (let i = 0; i < queue.songs.length; i++) {
                songs.push(queue.songs[i]);
            }
        
            if(e.customId === "first_page") {
                first = 0;
                second = 5;
                page = 1;
    
                actions.components[0].setDisabled(true);
                actions.components[1].setDisabled(true);
            }
            else if(e.customId === "previous_page") {
                first -= 5;
                second -= 5;
                page -= 1;
    
                if(first === 0) {
                    actions.components[0].setDisabled(true);
                    actions.components[1].setDisabled(true);
                }
                else {
                    actions.components[0].setDisabled(false);
                    actions.components[1].setDisabled(false);
                }
            }
            else if(e.customId === "next_page") {
                first += 5;
                second += 5;
                page += 1;
    
                if(second >= queue.songs.length) {
                    actions.components[2].setDisabled(true);
                    actions.components[3].setDisabled(true);
                }
                else {
                    actions.components[2].setDisabled(false);
                    actions.components[3].setDisabled(false);
                }
            }
    
            embed
                .setDescription(`Songs Count: ${queue.songs.length} | Page: ${page}/${Math.floor(queue.songs.length % 5 === 0 ? queue.songs.length / 5 : (queue.songs.length / 5)+1)}`)
                .setFields([
                    {
                        name: "Current Song:",
                        value: `${currentSong.index + 1}). [${currentSong.title}](${currentSong.url}) - ${client.parseTimeFormat(currentSong.duration)}`
                    },
                    {
                        name: "Queue Songs:",
                        value: songs.splice(first, 5).map((song, index) => `${index+1}). [${song.title}](${song.url})`).join("\n")
                    }
                ]);
            e.update({ embeds: [embed], components: [actions] }).catch(console.log);
        });
    }
}

module.exports = queueControl;
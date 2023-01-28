const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const { queue: queueControl } = require("../src");

module.exports = {
    data: [
        {
            name: "control",
            description: "Re-send the audio control message."
        },
        {
            name: "ctrl",
            description: "Re-send the audio control message."
        }
    ],
    /**
     * 
     * @param {import("discord.js").CommandInteraction} interaction 
     * @param {import("../src").Client} client 
     */
    async run(interaction, client) {
        const queue = client.queue.get(interaction.guild.id);
        if(!queue || !queue.songs.length) return interaction.reply({ content: "No songs queue available at the moment!", ephemeral: true }).catch(console.log);
        if(queue.message) queue.message.delete().catch(console.log);

        let actions = new ActionRowBuilder()
            .setComponents([
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId("player")
                    .setEmoji(queue.playing ? "⏸" : "▶️"),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId("loop")
                    .setEmoji(queue.loop === 2 ? "🔂" : (queue.loop < 1 ? "❌" : "🔁")),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("queue")
                    .setLabel("Show Queue")
            ]);

        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setAuthor({ name: `| Now Playing`, iconURL: client.user.displayAvatarURL({ extension: "png", size: 1024, forceStatic: true }) })
            .setDescription(`[${song.title}](${song.url})`)
            .setThumbnail(song.thumbnails.sort((a, b) => b.height - a.height)[0].url)
            .addFields(
                {
                    name: "Duration:",
                    value: client.parseTimeFormat(song.duration),
                    inline: true
                },
                {
                    name: "Requested By:",
                    value: song.requestedUser.tag,
                    inline: true
                }
            );
        
        let message = null;
        try {
            message = await interaction.reply({ embeds: [embed], components: [actions], fetchReply: true, ephemeral: true });
        } catch (error) {
            console.log(error);
            return interaction.reply({ content: "Something error while send queue message!", ephemeral: true }).catch(console.log);
        }

        let collector = message.createMessageComponentCollector({ componentType: ComponentType.Button });
        collector.on("collect", (e) => {
            if(!e.isButton()) return;

            let admin_permissions = ["player", "loop"];
            let queue = client.queue.get(e.guild.id);

            if(admin_permissions.includes(e.customId)) {
                let confirm = false;
                for (let i = 0; i < e.member.roles.cache.toJSON().length; i++) {
                    let role = e.member.roles.cache.toJSON()[i];
                    let permissions = parseInt(role.permissions.bitfield.toString());
                    for (let i = 0; i < client.permissions.length; i++) {
                        if((permissions & client.permissions[i]) === client.permissions[i]) confirm = true;
                    }
                }
                if(queue.dj_user.id === e.user.id) confirm = true;
                if(!confirm) return e.reply({ content: `You don't have permission to control ${e.customId.toLowerCase()}!`, ephemeral: true }).catch(console.log);
            }

            let actions = new ActionRowBuilder()
                .setComponents([
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId("player")
                        .setEmoji(queue.playing ? "⏸" : "▶️"),
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId("loop")
                        .setEmoji(queue.loop === 2 ? "🔂" : (queue.loop < 1 ? "❌" : "🔁")),
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("queue")
                        .setLabel("Show Queue")
                ]);

            if(e.customId === "loop") {
                if(queue.loop === 2) queue.loop = 0;
                else queue.loop += 1;

                let index = actions.components.map(i => i.data.custom_id).indexOf("loop");
                let component = actions.components[index];

                component.setEmoji(queue.loop === 2 ? "🔂" : (queue.loop < 1 ? "❌" : "🔁"));
                e.update({ components: [actions] }).catch(console.log);
            };
            if(e.customId === "player") {

                if(queue.playing) queue.player.pause();
                else queue.player.unpause();

                let index = actions.components.map(i => i.data.custom_id).indexOf("player");
                let component = actions.components[index];

                component.setEmoji(queue.playing ? "⏸" : "▶️");
                e.update({ components: [actions] }).catch(console.log);
            }
            else if(e.customId === "queue") queueControl(e, client);

        });

        queue.message = message;
        queue.control = collector;
        
    }
}
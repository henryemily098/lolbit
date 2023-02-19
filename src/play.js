const {
    EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle,
    ComponentType
} = require("discord.js");
const {
    getVoiceConnection, entersState, VoiceConnectionStatus,
    createAudioPlayer, createAudioResource, StreamType,
    AudioPlayerStatus
} = require("@discordjs/voice");
const queueControl = require("./queue");

const playdl = require("play-dl");
const scrape = require("scrape-youtube").search;
const scdl = require("soundcloud-downloader").default;

/**
 * 
 * @param {object} song 
 * @param {string} guildId 
 * @param {import("./client")} client 
 */
async function playHandle(song, guildId, client) {

    const queue = client.queue.get(guildId);
    const connection = getVoiceConnection(guildId);
    if(!song) {
        client.queue.delete(guildId);
        return;
    }

    let data = null;
    try {
        if(song.type === "youtube") {
            let { stream, type } = await playdl.stream(song.url);
            data = { stream, type };
        }
        else if(song.type === "spotify") {
            let results = await scrape(`${song.title} - ${song.artists.map(artist => artist.name).join(" & ")} Topic`).then(res => res.videos);
            if(!song['youtube_link']) song['youtube_link'] = results[0].link;
            
            let { stream, type } = await playdl.stream(song['youtube_link']);
            data = { stream, type };
        }
        else if(song.type === "soundcloud") data = { stream: await scdl.downloadFormat(song.url, scdl.FORMATS.MP3), type: StreamType.Arbitrary }
    } catch (error) {
        return await endedPlayer(guildId, client);
    }
    
    const resource = createAudioResource(data.stream, { inlineVolume: true, inputType: data.type });
    resource.volume.setVolume(queue.volume / 100);

    if(!queue.player) {
        const player = createAudioPlayer();
        player
            .on(AudioPlayerStatus.Playing, () => queue.playing = true)
            .on(AudioPlayerStatus.Paused, () => queue.playing = false)
            .on(AudioPlayerStatus.Idle, () => endedPlayer(guildId, client))
            .on("error", () => endedPlayer(guildId, client));
        queue.player = player;
    }
    queue.player.play(resource);

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        connection.subscribe(queue.player);
    } catch (error) {
        return await endedPlayer(guildId, client);
    }

    try {
        let actions = new ActionRowBuilder()
            .setComponents([
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId("player")
                    .setEmoji("⏸️"),
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
                    value: `[${client.parseTimeFormat(0)}]🔘▬▬▬▬▬▬▬▬▬▬▬[${client.parseTimeFormat(song.duration)}]`,
                },
                {
                    name: "Requested By:",
                    value: song.requestedUser.tag,
                    inline: true
                },
                {
                    name: "Song Author:",
                    value: song.type === "soundcloud" ? song.author.full_name : song.type === "youtube" ? song.author.name : song.type === "spotify" ? song.artists.map(artist => artist.name).join(" & ") : "",
                    inline: true
                }
            );

        let message = null;
        if(queue.loop === 2 && queue.message) {
            let msgs = await song.textChannel.messages.fetch();
            let msg = msgs.get(queue.message.id);
            if(!msg) message = await song.textChannel.send({ embeds: [embed], components: [actions] });
            else message = msg;
        } else message = await song.textChannel.send({ embeds: [embed], components: [actions] });

        let collector = message.createMessageComponentCollector({ componentType: ComponentType.Button });
        collector
            .on("collect", (e) => {
                if(!e.isButton()) return;

                let admin_permissions = ["player", "loop", "replay"];
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
        queue.interval = setInterval(() => {

            if(!queue.player.state.resource) {
                clearInterval(queue.interval);
                queue.interval = null;
                return;
            }

            let slider = "▬▬▬▬▬▬▬▬▬▬▬▬";
            let song = queue.songs[queue.index];
            let seek = Math.floor((queue.player.state.resource.playbackDuration / song.duration) * slider.length);
            
            let split = slider.split("");
            split[seek] = "🔘";
            embed.data.fields[0].value = `[${client.parseTimeFormat(queue.player.state.resource.playbackDuration)}]${split.join("")}[${client.parseTimeFormat(song.duration)}]`

            queue.message
                .edit({ embeds: [embed] })
                .catch(() => {
                    clearInterval(queue.interval);
                    queue.interval = null;
                    queue.message = null;
                    queue.control = null;
                });
            
        }, 1000);
    } catch (error) {
        console.log(error);
    }

}

/**
 * 
 * @param {string} guildId 
 * @param {import("./client")} client 
 */
async function endedPlayer(guildId, client) {

    const queue = client.queue.get(guildId);
    if(queue) {
        queue.votes = [];
        if(queue.loop === 2) playHandle(queue.songs[queue.index], guildId, client).catch(console.log);
        else {

            queue.control = null;
            if(queue.message) queue.message.delete().then(() => queue.message = null).catch(console.log);

            if(queue.loop === 1) {
                if(queue.index === (queue.songs.length - 1)) queue.index = 0;
                else queue.index += 1;
            }
            else queue.index += 1;
            playHandle(queue.songs[queue.index], guildId, client).catch(console.log);
        }
    }

}

module.exports = playHandle;
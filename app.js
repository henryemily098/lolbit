require("dotenv").config();
const fs = require("fs");
const cors = require("cors");
const http = require("http");
const fetch = require("node-fetch").default;
const express = require("express");
const {
    ClientPlayer,
    Collection
} = require("./src");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    Partials,
    REST,
    Routes
} = require("discord.js");

const app = express();
const server = http.createServer(app);
const listener = server.listen(process.env.PORT || 3005, () => console.log("[SERVER] Listen to port:", listener.address().port))
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User
    ]
});

const clientPlayer = new ClientPlayer(client, {
    googleKey: process.env.GOOGLEKEY,
    spotifyCredentials: {
        clientID: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    }
});

app.use(cors({
    origin: [
        process.env.HELPY,
        process.env.GLITCHTRAP
    ]
}));
app.get("/commands", (req, res) => res.status(200).send(client.commands.map(i => i.data)));
app.get("*", (req, res) => res.send("Ready!"));

clientPlayer.on("playSong", async(queue, song) => {
    try {
        let loop;
        if(queue.loop === 0) loop = "❌";
        if(queue.loop === 1) loop = "🔁";
        if(queue.loop === 2) loop = "🔂";

        let shuffleStyle;
        if(queue.shuffle) shuffleStyle = ButtonStyle.Primary;
        else shuffleStyle = ButtonStyle.Secondary;

        let row = new ActionRowBuilder()
            .setComponents([
                new ButtonBuilder()
                    .setCustomId("control-playpause")
                    .setEmoji(queue.playing ? "⏸" : "▶")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("control-loopqueue")
                    .setEmoji(loop)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("control-shufflequeue")
                    .setEmoji("🔀")
                    .setStyle(shuffleStyle),
                new ButtonBuilder()
                    .setCustomId("control-showqueue")
                    .setLabel("View Queue")
                    .setStyle(ButtonStyle.Secondary)
            ]);
        let embed = new EmbedBuilder()
            .setColor(client.color)
            .setAuthor({
                name: "│ Now playing",
                iconURL: client.user.displayAvatarURL({ size: 1024 })
            })
            .setThumbnail(song.thumbnail)
            .setDescription(`[${song.title}](${song.url})`)
            .setFooter({ text: `Requested by ${song.user.username}` });
        
        let message = null;
        let interaction = client.interactionConfiguration[queue.id+song.user.id];
        try {
            if(interaction) {
                message = await interaction.editReply({ embeds: [embed], components: [row] });
                delete client.interactionConfiguration[queue.id+song.user.id];
            }
            else message = await song.textChannel.send({ embeds: [embed], components: [row] });
        } catch (error) {
            console.log(error);
            message = await song.textChannel.send({ embeds: [embed], components: [row] });
        }
        client.messages[queue.id] = message;
    } catch (error) {
        console.log(error);
    }
});
clientPlayer.on("addSong", async(queue, song) => {
    try {
        let interaction = client.interactionConfiguration[queue.id+song.user.id];
        let embed = new EmbedBuilder()
            .setColor(client.color)
            .setAuthor({
                name: "│ Added to queue",
                iconURL: client.user.displayAvatarURL({ size: 1024 })
            })
            .setThumbnail(song.thumbnail)
            .setDescription(`[${song.title}](${song.url})`)
            .setFooter({ text: `Requested by ${song.user.username}` });
        await interaction.editReply({ embeds: [embed] });
        delete client.interactionConfiguration[queue.id+song.user.id];
    } catch (error) {
        console.log(error);
    }
});
clientPlayer.on("addList", async(queue, songs) => {
    try {
        let interaction = client.interactionConfiguration[queue.id+songs[0].user.id];
        let embed = new EmbedBuilder()
            .setColor(client.color)
            .setAuthor({
                name: `│ Added ${songs.length} songs to queue`,
                iconURL: client.user.displayAvatarURL({ size: 1024 })
            })
        await interaction.editReply({ embeds: [embed] });
        delete client.interactionConfiguration[queue.id+songs[0].user.id];
    } catch (error) {
        console.log(error);
    }
});
clientPlayer.on("finishSong", async(queue) => {
    if(queue) {
        let message = client.messages[queue.id];
        if(message) {
            try {
                await message.delete();
            } catch (error) {
                console.log(error);
            }
            delete client.messages[queue.id];
        }
    } 
});

client.color = "#0c0b0b";
client.player = clientPlayer;
client.commands = new Collection();
client.permissions = [
    0x2,
    0x4,
    0x8,
    0x10,
    0x20,
    0x10000000
];

client.messages = {};
client.interactionConfiguration = {};
client.pageQueue = {};

const files = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));
for (let i = 0; i < files.length; i++) {
    const command = require(`./commands/${files[i]}`);
    if(command.data) client.commands.set(command.data.name, command);
}

(async() => {
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: client.commands.map(i => i.data) }
        );
    } catch (error) {
        console.log(error);
    }
})();
client.on(Events.ClientReady, () => {
    console.log(`[SERVER] ${client.user.username} it's ready!`);
    const messageCheck = async() => {
        let guilds = null;
        try {
            guilds = await client.guilds.fetch();
        } catch (error) {
            console.log(error);
        }
        if(!guilds) return;
        for (let i = 0; i < guilds.size; i++) {
            let messages = client.messages[guilds.at(i).id];
            if(messages && messages.length > 1) {
                messages = messages.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
                for (let i1 = 1; i1 < messages.length; i1++) {
                    try {
                        await messages[i1].delete();
                    } catch (error) {
                        console.log(error);
                    }
                }
                messages.splice(1, messages.length);
            }
        }
    }
    setInterval(() => {
        messageCheck();
        checkInterval();
    }, 2500);
});
client.on(Events.InteractionCreate, async(interaction) => {
    if(interaction.isCommand()) {
        let logChannel = client.channels.cache.get("1109795504063266887");
        if(logChannel && logChannel.isTextBased()) {
            let embed = new EmbedBuilder()
                .setColor(interaction.client.color)
                .setAuthor({
                    name: `│ "/${interaction.commandName}" has been used!`,
                    iconURL: interaction.client.user.displayAvatarURL({ size: 1024 })
                })
                .setThumbnail(interaction.user.displayAvatarURL({ size: 1024 }))
                .setFields([
                    {
                        name: "Command ID:",
                        value: interaction.commandId,
                        inline: true
                    },
                    {
                        name: "User Name:",
                        value: interaction.user.username,
                        inline: true
                    },
                    {
                        name: "User ID:",
                        value: interaction.user.id,
                        inline: true
                    },
                    {
                        name: "Server Name:",
                        value: interaction.guild.name,
                        inline: true
                    },
                    {
                        name: "Server ID:",
                        value: interaction.guildId,
                        inline: true
                    },
                    {
                        name: "Date:",
                        value: `<t:${Math.floor(interaction.createdTimestamp / 1000)}:f>`,
                        inline: true
                    }
                ]);
            logChannel
                .send({ embeds: [embed] })
                .catch(console.log);
        }

        let commandName = interaction.commandName;
        let command = client.commands.get(commandName);
        if(!command) {
            try {
                await interaction.reply({
                    content: "The command it's not available!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        try {
            await command.run(interaction);
        } catch (error) {
            console.log(error);
        }
    }
    if(interaction.isButton()) {
        let queue = clientPlayer.getQueue(interaction.guildId);
        let [type, method] = interaction.customId.split("-");

        /**
         * 
         * @param {[]} array 
         * @param {number} pageNumber 
         * @param {number} pageSize 
         * @returns 
         */
        const paginate = (array, pageNumber, pageSize) => {
            const startIndex = (pageNumber - 1) * pageSize;
            return array.slice(startIndex, startIndex + pageSize);
        }

        /**
         * 
         * @param {number} milliseconds 
         * @returns return as formatted time
         */
        const msToTime = (milliseconds) => {
            let seconds = Math.floor(milliseconds / 1000);
            let minutes = Math.floor(seconds / 60);
            let hours = Math.floor(minutes / 60);
        
            seconds %= 60;
            minutes %= 60;
        
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        if(type === "control") {
            let message = client.messages[interaction.guildId];
            if(!queue || !message|| message.id !== interaction.message.id) {
                try {
                    await interaction.message.delete();
                    await interaction.reply({
                        content: `This is not current control!${message ? ` [Click Here For the player control](${message.url})!` : ""}`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.log(error);
                }
                return;
            }

            let restricts = ["shufflequeue", "playpause", "loopqueue"];
            if(restricts.includes(method)) {
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
                            content: "You can't use this button!",
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

                if(method === "playpause") {
                    if(queue.playing) queue.pause();
                    else queue.resume();
                }

                if(method === "loopqueue") {
                    let newLoop;
                    if(queue.loop === 2) newLoop = 0;
                    else newLoop = queue.loop+1;
                    queue.setLoop(newLoop);
                }

                if(method === "shufflequeue") queue.setShuffle(!queue.shuffle);

                let loop;
                if(queue.loop === 0) loop = "❌";
                if(queue.loop === 1) loop = "🔁";
                if(queue.loop === 2) loop = "🔂";

                let shuffleStyle;
                if(queue.shuffle) shuffleStyle = ButtonStyle.Primary;
                else shuffleStyle = ButtonStyle.Secondary;

                let row = new ActionRowBuilder()
                    .setComponents([
                        new ButtonBuilder()
                            .setCustomId("play-pause")
                            .setEmoji(queue.playing ? "⏸" : "▶")
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId("loop-queue")
                            .setEmoji(loop)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId("shuffle-queue")
                            .setEmoji("🔀")
                            .setStyle(shuffleStyle),
                        new ButtonBuilder()
                            .setCustomId("show-queue")
                            .setLabel("View Queue")
                            .setStyle(ButtonStyle.Secondary)
                    ]);
                try {
                    await interaction.update({ components: [row] });
                } catch (error) {
                    console.log(error);
                }
            }
            if(method === "showqueue") {
                let nextSongs = [...queue.songs];
                let previousSongs = nextSongs.splice(0, queue.position);

                let display = [...nextSongs];
                if(queue.loop !== 0) display.push(...previousSongs);

                let row = new ActionRowBuilder()    
                    .setComponents([
                        new ButtonBuilder()
                            .setCustomId("queue-left")
                            .setEmoji("897314282872655983")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("queue-right")
                            .setEmoji("897289358187589663")
                            .setStyle(ButtonStyle.Secondary)
                    ]);
                let embed = new EmbedBuilder()
                    .setColor(client.color)
                    .setAuthor({
                        name: `│ ${interaction.guild.name}'s Queue`,
                        iconURL: client.user.displayAvatarURL({ size: 1024 })
                    })
                    .setThumbnail(queue.songs[queue.position].thumbnail)
                    .setDescription(
                        paginate(display, 1, 5).map((song, index) => {
                            if(queue.position === song.position) return `**Current Song**\n[${song.title}](${song.url}) - [${msToTime(song.duration)}]\nRequested by ${song.user.username}${display.length > 1 ? "\n\n**Next Songs:**" : ""}`
                            else return `${index+1}) [${song.title.length > 25 ? `${song.title.substring(0, 22)}...` : song.title}](${song.url}) - [${msToTime(song.duration)}]\nRequested by ${song.user.username}\n${index !== (display.length - 1) ? "---" : ""}`
                        })
                        .join("\n")
                    )
                    .setFooter({
                        text: `Page 1/${Math.ceil(display.length / 5)} │ Total songs: ${queue.loop === 0 ? display.length : queue.songs.length}`
                    });
                try {
                    let body = {
                        embeds: [embed],
                        fetchReply: true,
                        ephemeral: true
                    }
                    if(display.length > 5) body["components"] = [row];
                    await interaction.reply(body);
                    client.pageQueue[interaction.guildId+interaction.user.id] = {
                        number: 1,
                        index: 0
                    };
                } catch (error) {
                    console.log(error);
                }
                return;
            }
        }
        if(type === "queue") {
            let nextSongs = [...queue.songs];
            let previousSongs = nextSongs.splice(0, queue.position);

            let display = [...nextSongs];
            if(queue.loop !== 0) display.push(...previousSongs);

            let page = client.pageQueue[interaction.guildId+interaction.user.id];
            if(!page) {
                try {
                    await interaction.reply({
                        content: "Queue message it's not detected!",
                        ephemeral: true
                    });
                } catch (error) {
                    console.log(error);
                }
                return;
            }

            let { number, index:indexPage } = page;
            if(display.length > 5) {
                if(method === "left") {
                    number--;
                    indexPage-=5;
                }
                else if(method === "right") {
                    number++;
                    indexPage+=5;
                }
                client.pageQueue[interaction.guildId+interaction.message.id] = { number, index: indexPage };
            }
            else {
                number = 1;
                indexPage = 0;
            }

            let filtered = paginate(display, number, 5);
            let row = new ActionRowBuilder()    
                .setComponents([
                    new ButtonBuilder()
                        .setCustomId("queue-left")
                        .setEmoji("897314282872655983")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(number === 1),
                    new ButtonBuilder()
                        .setCustomId("queue-right")
                        .setEmoji("897289358187589663")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(number >= Math.ceil(display.length / 5))
                ]);
            let embed = new EmbedBuilder()
                .setColor(client.color)
                .setAuthor({
                    name: `│ ${interaction.guild.name}'s Queue`,
                    iconURL: client.user.displayAvatarURL({ size: 1024 })
                })
                .setThumbnail(queue.songs[queue.position].thumbnail)
                .setDescription(
                    filtered.map((song, index) => {
                        if(queue.position === song.position) return `**Current Song**\n[${song.title}](${song.url}) - [${msToTime(song.duration)}]\nRequested by ${song.user.username}${display.length > 1 ? "\n\n**Next Songs:**" : ""}`
                        else return `${index+indexPage+1}) [${song.title.length > 25 ? `${song.title.substring(0, 22)}...` : song.title}](${song.url}) - [${msToTime(song.duration)}]\nRequested by ${song.user.username}\n${index !== (display.length - 1) ? "---" : ""}`
                    })
                    .join("\n")
                )
                .setFooter({
                    text: `Page: ${number}/${Math.ceil(display.length / 5)} │ Total songs: ${queue.loop === 0 ? display.length : queue.songs.length}`
                });
            try {
                let body = {
                    embeds: [embed]
                }
                if(display.length > 5) body["components"] = [row];
                await interaction.update(body);
            } catch (error) {
                console.log(error);
            }
        }
    }
});
client.login(process.env.TOKEN);

function checkInterval() {
    let urls = [
        process.env.HELPY
    ];
    urls.forEach(async url => {
        try {
            await fetch(url);
            console.log(`Status of ${url}: work!`);
        } catch (error) {
        }
    })
}
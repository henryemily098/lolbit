require("dotenv").config();
const fs = require("fs");
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

clientPlayer.on("playSong", async(queue, song) => {
    try {
        let loop;
        if(queue.loop === 0) loop = "❌";
        if(queue.loop === 1) loop = "🔁";
        if(queue.loop === 2) loop = "🔂";

        let shuffleStyle;
        if(queue.shuffle) shuffleStyle = ButtonStyle.Primary;
        else shuffleStyle = ButtonStyle.Secondary;

        let interaction = client.interactionConfiguration[queue.id+song.user.id];
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
        if(!client.messages[queue.id]) {
            client.messages[queue.id] = [];
            if(interaction) {
                message = await interaction.editReply({ embeds: [embed], components: [row] });
                delete client.interactionConfiguration[queue.id+song.user.id];
            }
            else message = await song.textChannel.send({ embeds: [embed], components: [row] });

            client.messages[queue.id].push(message);
            client.messages[queue.id] = Array.from(new Set(client.messages[queue.id]));
        }
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
clientPlayer.on("finishSong", async(queue) => {
    try {
        let messages = client.messages[queue.id];
        if(messages && messages[0]) {
            await messages[0].delete();
            delete client.messages[queue.id];
        }
    } catch (error) {
        console.log(error);
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
    setInterval(messageCheck, 2500);
});
client.on(Events.InteractionCreate, async(interaction) => {
    if(interaction.isCommand()) {
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
        let messages = client.messages[interaction.guildId];
        if(!queue || !messages[0] || messages[0].id !== interaction.message.id) {
            try {
                await interaction.message.delete();
                await interaction.reply({
                    content: `This is not current control!${controlMessage ? ` [Click Here For the player control](<${controlMessage.url}>)!` : ""}`,
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let restricts = ["shuffle-queue", "play-pause", "loop-queue"];
        if(restricts.includes(interaction.customId)) {
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

            if(interaction.customId === "play-pause") {
                if(queue.playing) queue.pause();
                else queue.resume();
            }

            if(interaction.customId === "loop-queue") {
                let newLoop;
                if(queue.loop === 2) newLoop = 0;
                else newLoop = queue.loop+1;
                queue.setLoop(newLoop);
            }

            if(interaction.customId === "shuffle-queue") queue.setShuffle(!queue.shuffle);

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
        if(interaction.customId === "show-queue") {
            let nextSongs = [...queue.songs];
            let previousSongs = nextSongs.splice(0, queue.position);

            let display = [...nextSongs];
            if(queue.loop !== 0) display.push(...previousSongs);
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

            let embed = new EmbedBuilder()
                .setColor(client.color)
                .setAuthor({
                    name: `│ ${interaction.guild.name}'s Queue`,
                    iconURL: client.user.displayAvatarURL({ size: 1024 })
                })
                .setDescription(
                    display.map((song, index) => {
                        if(index === 0) return `**Current Song**\n[${song.title}](${song.url}) - [${msToTime(song.duration)}]\nRequested by ${song.user.username}${queue.songs.length > 1 ? "\n\n**Next Songs:**" : ""}`
                        else return `${index}) [${song.title.length > 25 ? `${song.title.substring(0, 22)}...` : song.title}](${song.url}) - [${msToTime(song.duration)}]\nRequested by ${song.user.username}\n${index !== (queue.songs.length - 1) ? "---" : ""}`
                    })
                    .join("\n")
                )
                .setFooter({
                    text: `Total songs: ${queue.songs.length}`
                })
            try {
                await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }
    }
});
client.login(process.env.TOKEN);
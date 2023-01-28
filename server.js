require("dotenv").config();
const fs = require("fs");
const { Server, Client } = require("./src");
const { Events, REST, Routes } = require("discord.js");

const client = new Client().setToken(process.env.TOKEN);
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
const server = new Server(3000);

const files = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));
for (let i = 0; i < files.length; i++) {
    const command = require(`./commands/${files[i]}`);
    if(command.data && command.data.length) {
        for (let i = 0; i < command.data.length; i++) {
            let data = command.data[i];
            client.app_commands.push(data);
            client.commands.set(data.name, command);
        }
    }
}

(async() => {

    try {

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: client.app_commands }
        );
        
    } catch (error) {
        console.log(error);
    }

})();

server.on("listening", () => console.log("Listen to port:", 3000));
server.get("/", (req, res) => res.send("Hello World"));
server.get("/callback", (req, res) => {
    let { guild_id } = req.query;
    if(guild_id) return res.redirect(`https://discord.com/channels/${guild_id}`);
    else return res.redirect('https://discord.com/channels/@me');
});

client.on(Events.ClientReady, () => console.log("Ready!"));
client.on(Events.InteractionCreate, async(interaction) => {

    if(!interaction.inGuild()) return;
    if(!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if(command) {
        try {
            await command.run(interaction, client);
        } catch (error) {
            console.log(error);
            if(interaction.deferred) interaction.editReply({ content: "There's something wrong while running the command!" }).catch(console.log);
            else interaction.reply({ content: "There's something wrong while running the command!", ephemeral: true }).catch(console.log);
        }
    }
    
});
import { handleHiFiCommand } from "./utilities/commands";
import { Client } from "discord.js";
const interactions = require("discord-slash-commands-client");

const auth = require('../auth.json');

const client = new Client();
const clientInteractions = new interactions.Client(auth.discordToken, auth.discordBotClientID);

client.on('ready', () => {
    console.log(`Spatial-Standup Bot online! Bot's tag: \`${client.user.tag}\`.\n`);

    console.log(`Creating slash command...`);
    clientInteractions
        .createCommand({
            name: "hifi",
            description: "Links to this channel's Spatial Standup.",
        })
        .then((response: any) => {
            console.log(`Successfully created slash command! Response:\n${JSON.stringify(response, null, 4)}`);
        })
        .catch((error: any) => {
            console.error(`Couldn't create slash command. Error:\n${JSON.stringify(error, null, 4)}`);
        });
});

client.on("interactionCreate", (interaction) => {
    if (interaction.name === "hifi") {
        handleHiFiCommand({ interaction: interaction, guild: interaction.guild, channel: interaction.channel });
    }
});

client.login(auth.discordToken);

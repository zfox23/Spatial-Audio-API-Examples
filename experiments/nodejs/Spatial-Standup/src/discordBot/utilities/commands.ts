import { Guild, MessageEmbed, TextChannel } from "discord.js";
const crypto = require('crypto');
const axios = require("axios");
const auth = require('../../auth.json');

export async function handleHiFiCommand({ interaction, guild, channel }: { interaction: any, guild: Guild, channel: TextChannel }) {
    let stringToHash = guild.id + channel.id;

    let hash = crypto.createHash('md5').update(stringToHash).digest('hex');

    const spaceURL = `https://experiments.highfidelity.com/spatial-standup/${hash}/?config=/spatial-standup/watchParty.json`;

    let embed = new MessageEmbed()
        .addField(`Your High Fidelity Spatial Standup`, spaceURL, false)
        .setURL(spaceURL)
        .setFooter("This Spatial Standup is specific to this Discord Server and Discord Channel.")
        .setColor(`#FF0000`);
    channel.send(embed);

    let res;
    try {
        res = await axios.post(`https://discord.com/api/v8/interactions/${interaction.id}/${interaction.token}/callback`, {
            "type": 4,
            "data": {
                "content": "Your Spatial Standup details, as requested."
            }});
        console.log(`Successfully responded to slash command!`);
    } catch (e) {
        console.error(`Error when responding to slash command:\n${e}`);
    }
}

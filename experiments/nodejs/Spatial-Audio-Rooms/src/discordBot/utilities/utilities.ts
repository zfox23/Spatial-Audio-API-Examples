import { Message } from "discord.js";

export function handleErrorMessage(msg: Message, functionName: string, errorMessage: string, sendMessageToChannel: boolean = false) {
    console.error(`Error in \`${functionName}()\` for Guild \`${msg.guild}\`:\n${errorMessage}\n`);
    if (sendMessageToChannel) {
        msg.channel.send(errorMessage);
    }
}

export function handleSuccessMessage(msg: Message, functionName: string, successMessage: string, sendMessageToChannel: boolean = false) {
    console.log(`Success in \`${functionName}()\` for Guild \`${msg.guild}\`:\n${successMessage}\n`);
    if (sendMessageToChannel) {
        msg.channel.send(successMessage);
    }
}

export function handleStatusMessage(msg: Message, functionName: string, statusMessage: string, sendMessageToChannel: boolean = false) {
    console.log(`Status in \`${functionName}()\` for Guild \`${msg.guild}\`:\n${statusMessage}\n`);
    if (sendMessageToChannel) {
        msg.channel.send(statusMessage);
    }
}

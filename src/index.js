import { Client, IntentsBitField, Collection, MessageFlags } from "discord.js";

import "dotenv/config";
import db from "./services/firebase.js";

// import commands in ./commands/
import glaze from "./commands/glaze.js";
import diss from "./commands/diss.js";
import leaderboard from "./commands/leaderboard.js";
import recap from "./commands/recap.js";
import { whosent, guesswhosent } from "./commands/whosent.js";

// import utils in ./utils/
import { startReminderCron } from "./utils/reminder.js";

// import events in ./events/
import handleMessage from "./events/messageCreate.js";

const commandHandlers = {
  glaze,
  diss,
  recap,
  whosent,
};

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.cooldowns = new Collection();

const commandCooldowns = {
  leaderboard: 10,
  whosent: 15,
  guesswhosent: 5,
  glaze: 30,
  diss: 30,
  gameleaderboard: 10,
  recap: 20,
};

client.on("ready", async (c) => {
  console.log(`✅ ${c.user.tag} is online.`);

  startReminderCron(client);
});

client.on("messageCreate", async (msg) => {
  await handleMessage(msg, db);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { cooldowns } = interaction.client;
  let command = interaction.commandName;
  if (!cooldowns.has(command)) {
    cooldowns.set(command, new Collection());
  }
  const now = Date.now();
  const timestamps = cooldowns.get(command);
  const defaultCooldownDuration = 3;
  const cooldownAmount =
    (commandCooldowns[command] ?? defaultCooldownDuration) * 1_000;

  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

    if (now < expirationTime) {
      return interaction.reply({
        content: `Bro chill out wait a bit longer 😭🙏`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  if (commandHandlers[command]) {
    return commandHandlers[command](interaction, client);
  }
  if (["leaderboard", "gameleaderboard", "strokes"].includes(command)) {
    return leaderboard(interaction, db);
  }
  if (interaction.commandName === "guesswhosent") {
    return guesswhosent(interaction, db);
  }
});

client.login(process.env.TOKEN);

const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const PORT = 3000;
require('dotenv').config(); // 👈 must be at the top
const fs = require('fs');
const { QuickDB } = require("quick.db");
const db = new QuickDB();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// Slash command handler
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ There was an error.', ephemeral: true });
    }
  }

  // Modal Submission Handler
  if (interaction.isModalSubmit()) {
    const [type, channelId] = interaction.customId.split('_');
    const channel = await interaction.guild.channels.fetch(channelId);
    const sticky = await db.get(`sticky_${channelId}`);

    if (!channel) return interaction.reply({ content: 'Channel not found.', ephemeral: true });

    const newContent = interaction.fields.getTextInputValue('stickyContent');

    // If modal input is empty: delete sticky
    if (!newContent.trim()) {
      if (sticky) {
        const oldMsg = await channel.messages.fetch(sticky.messageId).catch(() => {});
        if (oldMsg) await oldMsg.delete();
        await db.delete(`sticky_${channelId}`);
      }
      return interaction.reply({ content: '🗑️ Sticky removed from this channel.', ephemeral: true });
    }

    // If sticky exists, delete old
    if (sticky) {
      const oldMsg = await channel.messages.fetch(sticky.messageId).catch(() => {});
      if (oldMsg) await oldMsg.delete();
    }

    const sent = await channel.send(newContent);
    await db.set(`sticky_${channelId}`, {
      messageId: sent.id,
      content: newContent,
      channelId
    });

    return interaction.reply({ content: '✅ Sticky updated.', ephemeral: true });
  }
});

// Auto resend sticky
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const sticky = await db.get(`sticky_${message.channel.id}`);
  if (!sticky) return;

  // Slight delay to ensure the user message appears before sticky is re-sent
  setTimeout(async () => {
    try {
      // Delete old sticky (if it exists)
      const prev = await message.channel.messages.fetch(sticky.messageId).catch(() => {});
      if (prev) await prev.delete();

      // Repost sticky
      const newSticky = await message.channel.send(sticky.content);
      await db.set(`sticky_${message.channel.id}.messageId`, newSticky.id);
    } catch (err) {
      console.error('Sticky re-send error:', err);
    }
  }, 500); // 0.5s delay for smoother timing
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Keep-alive server
express().get('/', (_, res) => res.send('Bot is online')).listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

client.login(process.env.TOKEN);
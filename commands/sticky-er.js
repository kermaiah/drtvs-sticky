const {
  SlashCommandBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sticky-er')
    .setDescription('Create or edit a sticky message')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to apply sticky message to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    // ✅ Guard against missing or invalid channel
    if (!channel) {
      return interaction.reply({
        content: '❌ Channel not found. Please select a valid text channel.',
        flags: 64 // equivalent to ephemeral: true
      });
    }

    const sticky = await db.get(`sticky_${channel.id}`);

    const modal = new ModalBuilder()
      .setCustomId(`stickyModal_${channel.id}`)
      .setTitle('Sticky Message');

    const messageInput = new TextInputBuilder()
      .setCustomId('stickyContent')
      .setLabel('Sticky content (leave blank to remove)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setValue(sticky?.content || '');

    const row = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

    // ✅ Optional fallback to prevent "did not respond" timeout
    setTimeout(() => {
      if (!interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '✏️ Please complete the modal to continue.', flags: 64 }).catch(() => {});
      }
    }, 3000);
  }
};

import assert from "assert";
import dotenv from "dotenv";
import { Client, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { converse } from "./converse.js";
import { readFile } from "fs/promises";
import { search } from "./wikipedia.js";
dotenv.config();
assert(process.env.OPENAI_API_KEY, "OPENAI_API_KEY is required");
assert(process.env.DISCORD_TOKEN, "DISCORD_TOKEN is required");
assert(process.env.GUILD_SNOWFLAKE, "GUILD_SNOWFLAKE is required");
assert(process.env.ADMIN_SNOWFLAKE, "ADMIN_SNOWFLAKE is required");
assert(process.env.GUILD_IDS, "GUILD_IDS is required");

const users = new Map<string, Date>();

type Preamble = { snowflakes: string[]; name: string; preamble: string };
type Preambles = Preamble[];

const client = new Client({ intents: [] });

async function main() {
  client.once("ready", async () => {
    console.log("Loading...");
    await client.application?.commands.create(
      new SlashCommandBuilder()
        .setName("ask")
        .setDescription("Ask a question, optionally about a particular channel")
        .addStringOption((option) =>
          option
            .setName("question")
            .setDescription("The question to ask")
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to ask a question about")
            .setRequired(false)
        )
    );
    await client.application?.commands.create(
      new SlashCommandBuilder()
        .setName("wikipedia")
        .setDescription("Search Wikipedia")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("The query to search for")
            .setRequired(true)
        )
    );
    console.log("Ready!");
  });
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const lastUse = users.get(interaction.user.id);
    if (lastUse && lastUse.getTime() + 1000 * 60 > Date.now()) {
      await interaction.reply({
        content: "Please wait a minute before asking another question",
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === "ask") {
      if (process.env.GUILD_IDS?.split(",").includes(interaction.guildId!)) {
        await ask(interaction);
      } else {
        await interaction.reply({
          content: `Sorry, this server hasn't been whitelisted to use this action, as it costs money. Contact <@${process.env.ADMIN_SNOWFLAKE}> to possibly add it.`,
          ephemeral: true,
        });
      }
    }
    if (interaction.commandName === "wikipedia") {
      await wikipedia(interaction);
    }
  });
  client.login(process.env.DISCORD_TOKEN!);
}

main();

async function ask(interaction: CommandInteraction) {
  const option = interaction.options.get("channel");
  const aboutChannel = option?.channel?.id;
  const about = aboutChannel ?? interaction.guildId!;

  const question = `${interaction.options.get("question")?.value}`;
  if (!question || question.length > 2048) {
    await interaction.reply({
      content: "Please provide a question in fewer than 2048 characters",
      ephemeral: true,
    });
    return;
  }

  const preambles = JSON.parse(
    await readFile("preambles.json", "utf-8")
  ) as Preambles;

  const preamble = preambles.find((preamble) =>
    preamble.snowflakes.includes(`${about}`)
  );

  if (!preamble) {
    await interaction.reply({
      content: `Sorry, I don't know about that topic. Ask the server/channel owner to contact <@${process.env.ADMIN_SNOWFLAKE}> to add it.`,
      ephemeral: true,
    });
    return;
  }

  users.set(interaction.user.id, new Date());

  const reply = await interaction.reply("Thinking...");

  const response = await converse(
    interaction.user.id,
    preamble.preamble,
    question
  );

  await reply.edit({
    embeds: [
      {
        title: aboutChannel
          ? `Question about <#${aboutChannel}>`
          : `Question about ${preamble.name}`,
        description: question,
        color: 0x00a67e,
        footer: {
          text: "My answers are not perfect - I am just ChatGPT.",
        },
      },
    ],
    content: response.text.replace(
      /As an AI language model.+?\.( However,)*/,
      "||$&||"
    ),
  });
}

async function wikipedia(interaction: CommandInteraction) {
  const query = interaction.options.get("query")?.value;
  if (!query || typeof query !== "string") {
    await interaction.reply({
      content: "Please provide a query",
      ephemeral: true,
    });
    return;
  }

  const { title, description } = await search(query);

  await interaction.reply({
    embeds: [{ title, description, color: 0xffffff }],
  });
}

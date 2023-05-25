#!/usr/bin/env node

import fetch from "node-fetch";
import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import { program } from "commander";
import { createParser } from "eventsource-parser";

const dbBasePath = ".local/share/llm";
const dbName = "log.db";
const API_URL = "https://api.openai.com/v1/chat/completions";

const CODE_SYSTEM_PROMPT = `
You are an expert code generating tool. Return just the code, with no explanation
or context. The code has to be well commented.
`.trim();

async function main() {
  program
    .name("llm")
    .description(
      `
LLM CLI simplifies using LLM models, like OpenAI's GPT-3 and GPT-4, in your terminal.

Prompt can be multiple words and handle files by using {{f ./file.txt }}

Examples:

llm -c 'write me a hello world in JavaScript'
llm 'explain me the following code: {{f ./index.js }}'
llm 'Hello, AI! How are you today?' --system 'You are a chatbot'

`.trim()
    )
    .option(
      "-c, --code",
      "Set System prompt of the conversation especially for code output"
    )
    .option("-n, --no-log", "Skip log to database")
    .option("--system <system>", "The System prompt of the conversation")
    .option("-4, --gpt4", "Use GPT-4 Model")
    .option("-m, --model <model>", "Use Model by name")
    .option("-s, --stream", "Stream output")
    .arguments("[prompt...]")
    .action(async (prompt) => {
      const args = program.opts();
      let model = "gpt-3.5-turbo";
      let finalPrompt = "";

      if (!prompt.length) {
        // Read from stdin instead
        finalPrompt = await readFromStdin();
      } else {
        finalPrompt = prompt.join(" ");
      }

      if (!finalPrompt.length) {
        finalPrompt = parse(finalPrompt);
        console.error("No prompt provided");
        process.exit(1);
      }

      const expandedPrompt = await parsePrompt(finalPrompt);

      if (args.gpt4) {
        model = "gpt-4";
      }

      if (args.code && args.system) {
        console.error("Can't use --code and --system together");
        process.exit(1);
      }
      const messages = [];
      let system = "";

      if (args.code) {
        system = CODE_SYSTEM_PROMPT;
      } else if (args.system) {
        system = args.system;
      } else {
        system = `You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible. Knowledge cutoff: 2021-09-01. Current date: ${new Date()
          .toISOString()
          .slice(0, 10)}`;
      }

      const logger = ({ response, data }) => {
        if (args.log) {
          log({
            prompt: expandedPrompt,
            model,
            system,
            response,
            data,
          });
        }
      };

      messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: expandedPrompt });

      if (expandedPrompt !== finalPrompt) {
        console.log(`\n ⏳ loading prompt: ${finalPrompt} (expanded)\n\n`);
      } else {
        console.log(`\n ⏳ loading prompt: ${finalPrompt}\n\n`);
      }

      const payload = {
        model, // model-name
        // temperature: 0, // to have no randomnes
        messages,
        // max_tokens: 1024,
        // n: 1,
        // stop: "\n",
        stream: args.stream || false,
      };

      const requestHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getOpenaiApiKey()}`,
      };

      if (process.env.OPENAI_API_ORG) {
        requestHeaders["OpenAI-Organization"] = process.env.OPENAI_API_ORG;
      }

      if (args.stream) {
        const stream = await OpenAIStream(payload, requestHeaders, logger);
        for await (const chunk of stream) {
          process.stdout.write(chunk);
        }
      } else {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        let response = data.choices[0].message.content.trim();

        logger({
          response,
          data,
        });

        if (args.code) {
          console.log(`\n${unwrapMarkdown(response)}\n\n`);
        } else {
          console.log(response);
        }
      }
    });

  program
    .command("init-db")
    .description(`create ~/${dbBasePath}/${dbName} SQLite database`)
    .action(() => {
      const logPath = getLogDbPath();
      if (!fs.existsSync(logPath)) {
        // Ensure directory exists
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        const db = new sqlite3.Database(logPath);
        db.run(
          `CREATE TABLE log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT,
            system TEXT,
            prompt TEXT,
            response TEXT,
            model TEXT,
            data TEXT,
            timestamp TEXT
          )`
        );
        db.close();
        console.log(`Database created at ${logPath}`);
      } else {
        console.log(`Database already exists at ${logPath}`);
      }
    });

  program.parse(process.argv);
}

async function readFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString().trim();
}

function getOpenaiApiKey() {
  // Expand this to home directory / ~.openai-api-key.txt
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  const keyPath = path.join(process.env.HOME, ".openai-api-key.txt");
  // If the file exists, read it
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, "utf8").trim();
  }
  console.error(
    "There is no OpenAI API key detected. To proceed, either configure the OPENAI_API_KEY environment variable or generate a ~/.openai-api-key.txt file."
  );
  process.exit(1);
}

function getLogDbPath() {
  return path.join(process.env.HOME, dbBasePath, dbName);
}

function log({ system, prompt, response, model, data }) {
  const provider = "OpenAI ChatGPT";
  const logPath = getLogDbPath();
  if (!fs.existsSync(logPath)) {
    console.warn("Couldn't find log database. Run `llm init-db` to create it.");
    return;
  }
  const db = new sqlite3.Database(logPath);
  db.run(
    `INSERT INTO log(provider, system, prompt, response, model, data, timestamp) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [
      provider,
      system,
      prompt,
      response,
      model,
      JSON.stringify(data),
      new Date().toISOString(),
    ],
    function (err) {
      if (err) {
        return console.log(err.message);
      }
    }
  );
}

// If the first and last lines consist of triple backticks, please remove them.
function unwrapMarkdown(content) {
  const lines = content.split("\n");
  if (lines[0].trim().startsWith("```")) {
    lines.shift();
  }
  if (lines[lines.length - 1].trim() === "```") {
    lines.pop();
  }
  return lines.join("\n");
}

// Replace ${file} with the contents of the file  (e.g. "give me a summary of the following text: {{my-file.txt}}")
async function parsePrompt(prompt) {
  const regex = /{{[ ]?f([^}]+)}}/g;
  let match;
  let newPrompt = prompt;
  while ((match = regex.exec(prompt)) !== null) {
    const filePath = match[1].trim();
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8").trim();
      newPrompt = newPrompt.replace(match[0], fileContent);
    } else {
      throw new Error(`File not found: ${filePath}`);
    }
  }
  return newPrompt;
}

async function OpenAIStream(payload, requestHeaders, logger) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let counter = 0;
  let data = {};
  let response = "";

  const res = await fetch(API_URL, {
    headers: requestHeaders,
    method: "POST",
    body: JSON.stringify(payload),
  });
  const stream = new ReadableStream({
    async start(controller) {
      // callback
      function onParse(event) {
        if (event.type === "event") {
          const eventData = event.data;
          // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
          if (eventData === "[DONE]") {
            logger({
              response,
              data,
            });

            controller.close();
            return;
          }
          try {
            const json = JSON.parse(eventData);
            const text = json.choices[0].delta?.content || "";
            response += text;
            data = json;
            if (counter < 2 && (text.match(/\n/) || []).length) {
              return;
            }
            const queue = encoder.encode(text);
            controller.enqueue(queue);
            counter++;
          } catch (e) {
            controller.error(e);
          }
        }
      }
      // stream response (SSE) from OpenAI may be fragmented into multiple chunks
      // this ensures we properly read chunks and invoke an event for each SSE event stream
      const parser = createParser(onParse);
      for await (const chunk of res.body) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return stream;
}

main();

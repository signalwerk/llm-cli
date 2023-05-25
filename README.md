# LLM CLI

LLM CLI simplifies using LLM models, like OpenAI's GPT-3 and GPT-4, in your terminal.

This tool represents a JavaScript adaptation of the original [LLM](https://github.com/simonw/llm) tool.

### Basic Usage

```bash
llm [options] [command] [prompt...]
```

You can pass your text as a prompt directly to the `llm` command. You can also provide multiple words and even use file contents as a prompt by using the syntax `{{f ./file.txt }}`.

Example:

```bash
llm 'Hello, AI! How are you today?'
```

### Options

The LLM CLI supports various options for controlling its behavior:

- `-c, --code`: This option sets the System prompt of the conversation, especially for code output.

```bash
llm -c 'write me a hello world in JavaScript'
```

- `-n, --no-log`: This option allows you to skip logging to the database.
- `--system <system>`: This option sets the System prompt of the conversation.
- `-4, --gpt4`: This option allows you to use the GPT-4 Model.
- `-m, --model <model>`: This option allows you to specify the model by its name.
- `-s, --stream`: This option streams the output.
- `-h, --help`: This option displays help for the command.

### Command – Log Database

The LLM CLI logs all conversations to a SQLite database. The database is located at `~/.local/share/llm/log.db`.

- `init-db`: This command creates an empty SQLite database at `~/.local/share/llm/log.db`.

```bash
llm init-db
```

## Installation

The following instructions will guide you through the process of installing LLM CLI.

**Prerequisites:**

1. Ensure you have Node.js installed on your machine. If not, you can download it from the [official Node.js website](https://nodejs.org).
2. You should have `git` installed. If not, check this [link](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) for installation details.

**Steps to Install:**

1. Clone the repository to your local machine. Open your terminal and type in the following command:

```bash
git clone git@github.com:signalwerk/llm-cli.git
```

2. Change the current working directory to the cloned repository:

```bash
cd llm-cli
```

3. Install the project dependencies:

```bash
npm ci
```

4. Add `llm` command to your shell environment. If you're using zsh, you can do this by adding the following line to your `~/.zshrc` file:

```bash
echo "alias llm='node $(pwd)/index.mjs'" >> ~/.zshrc
```

5. Refresh your shell environment to reflect the changes:

```bash
source ~/.zshrc
```

After completing the above steps, you should now have `llm` command available in your terminal.
To see the usage instructions for the command run `llm --help`.

**Note**: If you're using a different shell (like bash), replace `.zshrc` with your shell's configuration file (like `.bashrc` or `.bash_profile`).

## Contribute

The LLM CLI is an open-source project. Contributions are welcome and appreciated. For bug reports, feature requests, or any other changes, please open an issue.

## License

LLM CLI is licensed under the [MIT License](https://opensource.org/license/mit/).

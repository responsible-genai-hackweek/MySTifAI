### Install OpenCode

```
curl -fsSL https://opencode.ai/install | bash
```

### Install Ollama

```
curl -fsSL https://ollama.com/install.sh | sh
ollama --version
```

### Download model

```
ollama pull qwen3:8b
ollama list
```

### Configure and Run Ollama

Create a new model with a 32k context window
```
ollama create qwen3-32k -f ./Modelfile
ollama show --modelfile qwen3-32k
```

Run the new model
```
ollama run qwen3-32k
```

### Test raw responses

```
curl http://localhost:11434/api/tags
curl http://localhost:11434/api/generate -d '{"model":"qwen3-32k","prompt":"hello"}'
```

### Add Ollama to OpenCode

Edit ~/.config/opencode/opencode.json:
```
{
    "$schema": "https://opencode.ai/config.json",
    "provider": {
        "ollama": {
            "npm": "@ai-sdk/openai-compatible",
            "name": "Ollama (local)",
            "options": {
                "baseURL": "http://localhost:11434/v1"
            },
            "models": {
                "qwen3-32k": {}
            }
        }
    }
}
```